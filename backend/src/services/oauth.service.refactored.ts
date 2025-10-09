import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { GoogleOAuthConfig, TokenSet, OAuthTokenDocument, AccountConfigDocument } from '../types/auth.types';
import { IOAuthRepository } from '../repositories/interfaces/oauth.interface';
import { IAccountRepository } from '../repositories/interfaces/account.interface';

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * OAuth Service (Refactored with Dependency Injection)
 */
export class OAuthService {
    constructor(
        private oauthRepo: IOAuthRepository,
        private accountRepo: IAccountRepository
    ) {}

    private getOAuthConfig(): GoogleOAuthConfig {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Missing required OAuth environment variables');
        }

        return { clientId, clientSecret, redirectUri };
    }

    /**
     * Create OAuth2 client
     */
    createOAuthClient(): OAuth2Client {
        const config = this.getOAuthConfig();
        return new google.auth.OAuth2(
            config.clientId,
            config.clientSecret,
            config.redirectUri
        );
    }

    /**
     * Generate OAuth authorization URL
     */
    generateAuthUrl(client: OAuth2Client, forceReauth: boolean = false): string {
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: GMAIL_SCOPES,
            prompt: forceReauth ? 'consent' : 'select_account',
            include_granted_scopes: false
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(client: OAuth2Client, code: string): Promise<TokenSet> {
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
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
        const client = this.createOAuthClient();
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
            throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get user email from access token
     */
    async getUserEmailFromToken(accessToken: string): Promise<string> {
        try {
            const client = this.createOAuthClient();
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
            throw new Error(`Failed to retrieve user email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Store OAuth tokens and account configuration
     */
    async storeUserOAuthData(email: string, tokens: TokenSet): Promise<void> {
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

        await this.oauthRepo.storeTokens(tokenDoc);

        const configDoc: AccountConfigDocument = {
            id: accountId,
            userId: 'legacy',
            email,
            authType: 'oauth',
            isPrimary: false,
            isActive: true,
            createdAt: now,
            syncStatus: 'idle'
        };

        await this.accountRepo.store(configDoc);
    }

    /**
     * Get valid access token (refresh if needed)
     */
    async getValidAccessToken(email: string): Promise<string> {
        const tokens = await this.oauthRepo.getTokens(email);

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
                const newTokens = await this.refreshAccessToken(tokens.refreshToken);

                await this.oauthRepo.updateTokens(email, {
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
    }

    /**
     * Disconnect OAuth account
     */
    async disconnectOAuthAccount(email: string): Promise<void> {
        try {
            const { clearTokenCache } = await import('./gmail.service');
            clearTokenCache(email);

            await this.oauthRepo.deleteTokens(email);
            await this.accountRepo.deleteByEmail(email);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Check if user has valid OAuth connection
     */
    async hasValidOAuthConnection(email: string): Promise<boolean> {
        try {
            const tokens = await this.oauthRepo.getTokens(email);
            const config = await this.accountRepo.getByEmail(email);

            if (!tokens || !config) {
                return false;
            }

            if (!config.isActive) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate OAuth tokens
     */
    async validateTokens(email: string): Promise<boolean> {
        try {
            const tokens = await this.oauthRepo.getTokens(email);
            if (!tokens) {
                return false;
            }

            const now = new Date();
            const expiryTime = tokens.tokenExpiry ? new Date(tokens.tokenExpiry) : new Date(now.getTime() + 60 * 60 * 1000);

            if (expiryTime <= now) {
                if (!tokens.refreshToken) {
                    return false;
                }

                try {
                    await this.refreshAccessToken(tokens.refreshToken);
                } catch (refreshError) {
                    return false;
                }
            }

            const accessToken = await this.getValidAccessToken(email);
            const client = this.createOAuthClient();
            client.setCredentials({ access_token: accessToken });

            const oauth2 = google.oauth2({ version: 'v2', auth: client });
            const response = await oauth2.userinfo.get();

            if (response.data.email !== email) {
                return false;
            }

            return true;
        } catch (error: any) {
            if (error.status === 401 || error.code === 401) {
                try {
                    await this.disconnectOAuthAccount(email);
                } catch (cleanupError) {
                    // Ignore cleanup errors
                }
            }

            return false;
        }
    }

    /**
     * Check token scopes
     */
    async checkTokenScopes(email: string): Promise<{ hasFullAccess: boolean; scopes: string[] }> {
        try {
            const tokens = await this.oauthRepo.getTokens(email);
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
            return { hasFullAccess: false, scopes: [] };
        }
    }

    /**
     * Force reconnect account
     */
    async forceReconnectAccount(email: string): Promise<string> {
        try {
            await this.disconnectOAuthAccount(email);

            const client = this.createOAuthClient();
            const authUrl = this.generateAuthUrl(client, true);

            return authUrl;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Cleanup invalid tokens
     */
    async cleanupInvalidTokens(): Promise<void> {
        try {
            const accounts = await this.accountRepo.getAll();
            const oauthAccounts = accounts.filter(account => account.authType === 'oauth');

            for (const account of oauthAccounts) {
                try {
                    const isValid = await this.validateTokens(account.email);
                    if (!isValid) {
                        await this.disconnectOAuthAccount(account.email);
                    }
                } catch (error) {
                    // Continue with next account
                }
            }
        } catch (error) {
            throw error;
        }
    }
}
