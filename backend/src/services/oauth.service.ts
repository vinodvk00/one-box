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
    deleteAccountConfig,
    getAllAccountConfigs
} from './oauth-storage.service';

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

const getOAuthConfig = (): GoogleOAuthConfig => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Missing required OAuth environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI');
    }

    return {
        clientId,
        clientSecret,
        redirectUri
    };
};

export const createOAuthClient = (): OAuth2Client => {
    const config = getOAuthConfig();
    return new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
    );
};

export const generateAuthUrl = (client: OAuth2Client, forceReauth: boolean = false): string => {
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: GMAIL_SCOPES,
        prompt: forceReauth ? 'consent' : 'select_account',
        include_granted_scopes: false
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

    try {
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
    } catch (error) {
        console.error('Token refresh failed:', error);
        throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    console.log(`💾 Starting to store OAuth data for ${email}...`);
    console.log(`🔑 Tokens received:`, {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
        expiryDate: tokens.expiryDate,
        scopes: tokens.scope
    });

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

    console.log(`💾 Storing token document:`, {
        id: tokenDoc.id,
        email: tokenDoc.email,
        hasAccessToken: !!tokenDoc.accessToken,
        hasRefreshToken: !!tokenDoc.refreshToken,
        tokenExpiry: tokenDoc.tokenExpiry
    });

    await storeOAuthTokens(tokenDoc);
    console.log(`✅ Token document stored successfully for ${email}`);

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

    return tokens.accessToken;
};

export const disconnectOAuthAccount = async (email: string): Promise<void> => {
    try {
        console.log(`🔌 Disconnecting OAuth account: ${email}`);

        await deleteOAuthTokens(email);
        console.log(`🗑️ Deleted OAuth tokens for ${email}`);

        await deleteAccountConfig(email);
        console.log(`🗑️ Deleted account config for ${email}`);

    } catch (error) {
        console.error(`Failed to disconnect OAuth account ${email}:`, error);
        throw error;
    }
};

export const hasValidOAuthConnection = async (email: string): Promise<boolean> => {
    try {
        console.log(`🔍 Checking OAuth connection for ${email}...`);

        const tokens = await getOAuthTokens(email);
        const config = await getAccountConfig(email);

        console.log(`📋 OAuth check for ${email}:`, {
            hasTokens: !!tokens,
            hasConfig: !!config,
            isActive: config?.isActive,
            tokenDetails: tokens ? {
                id: tokens.id,
                hasAccessToken: !!tokens.accessToken,
                hasRefreshToken: !!tokens.refreshToken,
                createdAt: tokens.createdAt
            } : null,
            configDetails: config ? {
                id: config.id,
                authType: config.authType,
                syncStatus: config.syncStatus
            } : null
        });

        if (!tokens || !config) {
            console.log(`❌ Missing tokens or config for ${email}`);
            return false;
        }

        if (!config.isActive) {
            console.log(`❌ Account ${email} is not active`);
            return false;
        }

        console.log(`✅ Basic OAuth connection valid for ${email}`);
        return true;
    } catch (error) {
        console.error(`Error checking OAuth connection for ${email}:`, error);
        return false;
    }
};

export const validateTokens = async (email: string): Promise<boolean> => {
    try {
        console.log(`🔍 Validating tokens for ${email}...`);

        const tokens = await getOAuthTokens(email);
        if (!tokens) {
            console.log(`❌ No tokens found for ${email}`);
            return false;
        }

        const now = new Date();
        const expiryTime = tokens.tokenExpiry ? new Date(tokens.tokenExpiry) : new Date(now.getTime() + 60 * 60 * 1000);

        if (expiryTime <= now) {
            console.log(`⏰ Tokens expired for ${email}, attempting refresh...`);

            if (!tokens.refreshToken) {
                console.log(`❌ No refresh token available for ${email}`);
                return false;
            }

            try {
                await refreshAccessToken(tokens.refreshToken);
                console.log(`✅ Successfully refreshed tokens for ${email}`);
            } catch (refreshError) {
                console.error(`❌ Token refresh failed for ${email}:`, refreshError);
                return false;
            }
        }

        const accessToken = await getValidAccessToken(email);
        const client = createOAuthClient();
        client.setCredentials({ access_token: accessToken });

        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const response = await oauth2.userinfo.get();

        if (response.data.email !== email) {
            console.log(`❌ Token validation failed: email mismatch for ${email}`);
            return false;
        }

        console.log(`✅ Token validation successful for ${email}`);
        return true;
    } catch (error: any) {
        console.error(`❌ Token validation failed for ${email}:`, error);

        if (error.status === 401 || error.code === 401) {
            console.log(`🔑 Authentication failed for ${email} - tokens are invalid`);
            try {
                await disconnectOAuthAccount(email);
                console.log(`🗑️ Cleaned up invalid tokens for ${email}`);
            } catch (cleanupError) {
                console.error(`Failed to cleanup tokens for ${email}:`, cleanupError);
            }
        }

        return false;
    }
};

export const checkTokenScopes = async (email: string): Promise<{ hasFullAccess: boolean; scopes: string[] }> => {
    try {
        const tokens = await getOAuthTokens(email);
        if (!tokens) {
            return { hasFullAccess: false, scopes: [] };
        }

        const tokenScopes = tokens.scope || [];
        const hasFullAccess = tokenScopes.includes('https://www.googleapis.com/auth/gmail.readonly');

        return {
            hasFullAccess,
            scopes: tokenScopes
        };
    } catch (error) {
        console.error(`Failed to check token scopes for ${email}:`, error);
        return { hasFullAccess: false, scopes: [] };
    }
};

export const forceReconnectAccount = async (email: string): Promise<string> => {
    try {
        console.log(`🔄 Force reconnecting account: ${email}`);

        await disconnectOAuthAccount(email);

        const client = createOAuthClient();
        const authUrl = generateAuthUrl(client, true);

        console.log(`✅ Generated new auth URL for ${email}`);
        return authUrl;
    } catch (error) {
        console.error(`Failed to force reconnect ${email}:`, error);
        throw error;
    }
};

export const cleanupInvalidTokens = async (): Promise<void> => {
    try {
        console.log('🧹 Starting cleanup of invalid OAuth tokens...');

        const accounts = await getAllAccountConfigs();
        const oauthAccounts = accounts.filter(account => account.authType === 'oauth');

        let cleanedCount = 0;

        for (const account of oauthAccounts) {
            try {
                const isValid = await validateTokens(account.email);
                if (!isValid) {
                    console.log(`🗑️ Cleaning up invalid tokens for ${account.email}`);
                    await disconnectOAuthAccount(account.email);
                    cleanedCount++;
                }
            } catch (error) {
                console.error(`Error validating tokens for ${account.email}:`, error);
            }
        }

        console.log(`✅ Cleanup complete. Removed ${cleanedCount} invalid token sets.`);
    } catch (error) {
        console.error('Failed to cleanup invalid tokens:', error);
        throw error;
    }
};