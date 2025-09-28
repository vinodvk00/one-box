import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { GoogleOAuthConfig, TokenSet, OAuthTokenDocument, AccountConfigDocument } from '../types/auth.types';
import {
    storeOAuthTokens,
    getOAuthTokens,
    updateOAuthTokens,
    deleteOAuthTokens,
    storeAccountConfig,
    getAccountConfig,
    updateAccountConfig,
    deleteAccountConfig
} from './oauth-storage.service';

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.metadata',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

const getOAuthConfig = (): GoogleOAuthConfig => ({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!
});

export const createOAuthClient = (): OAuth2Client => {
    const config = getOAuthConfig();
    return new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
    );
};

export const generateAuthUrl = (client: OAuth2Client): string => {
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: GMAIL_SCOPES,
        prompt: 'consent',
        include_granted_scopes: true
    });
};

export const exchangeCodeForTokens = async (
    client: OAuth2Client,
    code: string
): Promise<TokenSet> => {
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
        throw new Error('No access token received from Google');
    }

    return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiryDate: tokens.expiry_date || undefined,
        scope: tokens.scope?.split(' ') || GMAIL_SCOPES
    };
};

export const refreshAccessToken = async (refreshToken: string): Promise<TokenSet> => {
    const client = createOAuthClient();
    client.setCredentials({
        refresh_token: refreshToken
    });

    const { credentials } = await client.refreshAccessToken();

    if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
    }

    return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken,
        expiryDate: credentials.expiry_date || undefined,
        scope: credentials.scope?.split(' ') || GMAIL_SCOPES
    };
};

export const getUserEmailFromToken = async (accessToken: string): Promise<string> => {
    try {
        const client = createOAuthClient();
        client.setCredentials({
            access_token: accessToken,
            token_type: 'Bearer'
        });

        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const { data } = await oauth2.userinfo.get();

        if (!data.email) {
            throw new Error('No email found in user info response');
        }

        return data.email;
    } catch (error) {
        console.error('Failed to get user email:', error);
        throw new Error(`Failed to retrieve user email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

export const storeUserOAuthData = async (
    email: string,
    tokens: TokenSet
): Promise<void> => {
    const accountId = `oauth_${email}`;
    const now = new Date();

    const tokenDoc: OAuthTokenDocument = {
        id: accountId,
        email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiryDate ? new Date(tokens.expiryDate) : undefined,
        scope: tokens.scope || GMAIL_SCOPES,
        createdAt: now,
        lastUsed: now
    };

    await storeOAuthTokens(tokenDoc);

    const configDoc: AccountConfigDocument = {
        id: accountId,
        email,
        authType: 'oauth',
        isActive: true,
        createdAt: now,
        syncStatus: 'idle'
    };

    await storeAccountConfig(configDoc);
};

export const getValidAccessToken = async (email: string): Promise<string> => {
    const tokens = await getOAuthTokens(email);

    if (!tokens) {
        throw new Error(`No OAuth tokens found for ${email}`);
    }

    const now = new Date();
    const expiryTime = tokens.tokenExpiry ? new Date(tokens.tokenExpiry) : new Date(now.getTime() + 60 * 60 * 1000);
    const bufferTime = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiryTime <= bufferTime) {
        if (!tokens.refreshToken) {
            throw new Error(`No refresh token available for ${email}`);
        }

        try {
            const newTokens = await refreshAccessToken(tokens.refreshToken);

            await updateOAuthTokens(email, {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                tokenExpiry: newTokens.expiryDate ? new Date(newTokens.expiryDate) : undefined
            });

            return newTokens.accessToken;
        } catch (error) {
            throw new Error(`Failed to refresh token for ${email}: ${error}`);
        }
    }

    await updateOAuthTokens(email, {});

    return tokens.accessToken;
};

export const disconnectOAuthAccount = async (email: string): Promise<void> => {
    await deleteOAuthTokens(email);
    await deleteAccountConfig(email);
};

export const hasValidOAuthConnection = async (email: string): Promise<boolean> => {
    try {
        const tokens = await getOAuthTokens(email);
        const config = await getAccountConfig(email);

        return !!(tokens && config && config.isActive);
    } catch (error) {
        return false;
    }
};

export const validateTokens = async (email: string): Promise<boolean> => {
    try {
        const accessToken = await getValidAccessToken(email);
        const client = createOAuthClient();
        client.setCredentials({ access_token: accessToken });

        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        await oauth2.userinfo.get();

        return true;
    } catch (error) {
        console.error(`Token validation failed for ${email}:`, error);
        return false;
    }
};