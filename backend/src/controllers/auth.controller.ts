import { Request, Response } from 'express';
import {
    createOAuthClient,
    generateAuthUrl,
    exchangeCodeForTokens,
    getUserEmailFromToken,
    storeUserOAuthData,
    disconnectOAuthAccount,
    hasValidOAuthConnection,
    validateTokens,
    forceReconnectAccount,
    cleanupInvalidTokens
} from '../services/oauth.service';
import {
    getAllAccountConfigs,
    getAccountConfig,
    updateAccountConfig
} from '../services/oauth-storage.service';

export const initiateGmailOAuth = async (req: Request, res: Response) => {
    try {
        const client = createOAuthClient();
        const authUrl = generateAuthUrl(client);

        res.redirect(authUrl);
    } catch (error) {
        console.error('Failed to initiate OAuth flow:', error);
        res.status(500).json({
            error: 'Failed to initiate OAuth flow',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const handleOAuthCallback = async (req: Request, res: Response) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
        const { code, error: oauthError, state } = req.query;

        if (oauthError) {
            const isLoginFlow = !req.session?.userId;
            const redirectPath = isLoginFlow ? '/auth/callback' : '/settings';
            const errorRedirectUrl = `${frontendUrl}${redirectPath}?error=${encodeURIComponent(`Google returned error: ${oauthError}`)}`;
            return res.redirect(errorRedirectUrl);
        }

        if (!code || typeof code !== 'string') {
            const isLoginFlow = !req.session?.userId;
            const redirectPath = isLoginFlow ? '/auth/callback' : '/settings';
            const errorRedirectUrl = `${frontendUrl}${redirectPath}?error=${encodeURIComponent('No authorization code received from Google')}`;
            return res.redirect(errorRedirectUrl);
        }

        const client = createOAuthClient();
        const tokens = await exchangeCodeForTokens(client, code);

        const email = await getUserEmailFromToken(tokens.accessToken);

        const isLoginFlow = !req.session?.userId;

        if (isLoginFlow) {
            const { google } = await import('googleapis');
            const { findOrCreateOAuthUser } = await import('../services/auth.service');
            const { updateLastLogin, updateUser } = await import('../services/user.service');
            const { getAccountConfigsByUserId, storeAccountConfig } = await import('../services/oauth-storage.service');
            const { storeOAuthTokens } = await import('../services/oauth-storage.service');
            const { nanoid } = await import('nanoid');

            const oauth2Client = client;
            oauth2Client.setCredentials({
                access_token: tokens.accessToken,
                refresh_token: tokens.refreshToken,
                expiry_date: tokens.expiryDate
            });

            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();

            if (!userInfo.data.email || !userInfo.data.name) {
                res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('Failed to get user info from Google')}`);
                return;
            }

            const user = await findOrCreateOAuthUser({
                email: userInfo.data.email,
                name: userInfo.data.name,
                oauthProvider: 'google'
            });

            const existingAccounts = await getAccountConfigsByUserId(user.id);
            const gmailAccountExists = existingAccounts.some(
                account => account.email === userInfo.data.email && account.authType === 'oauth'
            );

            if (!gmailAccountExists) {
                const accountId = `acc_${nanoid(12)}`;
                const isPrimary = existingAccounts.length === 0;

                await storeAccountConfig({
                    id: accountId,
                    userId: user.id,
                    email: userInfo.data.email,
                    authType: 'oauth',
                    isPrimary,
                    isActive: true,
                    syncStatus: 'idle',
                    createdAt: new Date()
                });

                await storeOAuthTokens({
                    id: `oauth_${userInfo.data.email}`,
                    email: userInfo.data.email,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken || undefined,
                    tokenExpiry: tokens.expiryDate ? new Date(tokens.expiryDate) : undefined,
                    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
                    createdAt: new Date()
                });

                if (isPrimary) {
                    await updateUser(user.id, { primaryEmailAccountId: accountId });
                }
            }

            await updateLastLogin(user.id);

            req.session.userId = user.id;
            req.session.email = user.email;
            req.session.role = user.role;

            req.session.save((err) => {
                if (err) {
                    res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('Failed to create session')}`);
                    return;
                }

                res.redirect(`${frontendUrl}/auth/callback?success=true`);
            });
        } else {
            const existingConnection = await hasValidOAuthConnection(email);
            if (existingConnection) {
                await disconnectOAuthAccount(email);
            }

            await storeUserOAuthData(email, tokens);

            const redirectUrl = `${frontendUrl}/settings?oauth=success&email=${encodeURIComponent(email)}`;
            res.redirect(redirectUrl);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        const isLoginFlow = !req.session?.userId;
        const redirectPath = isLoginFlow ? '/auth/callback' : '/settings';
        const errorRedirectUrl = `${frontendUrl}${redirectPath}?error=${encodeURIComponent(`OAuth callback failed: ${errorMessage}`)}`;
        res.redirect(errorRedirectUrl);
    }
};

export const getConnectedAccounts = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        let accounts;
        if (userId) {
            const { getAccountConfigsByUserId } = await import('../services/oauth-storage.service');
            accounts = await getAccountConfigsByUserId(userId);
        } else {
            accounts = await getAllAccountConfigs();
        }

        const accountList = accounts.map(account => ({
            id: account.id,
            email: account.email,
            authType: account.authType,
            isActive: account.isActive,
            syncStatus: account.syncStatus,
            createdAt: account.createdAt,
            lastSyncAt: account.lastSyncAt
        }));

        res.json({
            accounts: accountList,
            total: accountList.length
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch accounts',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getAccountDetails = async (req: Request, res: Response) => {
    try {
        let { email } = req.params;

        email = decodeURIComponent(email);

        if (!email) {
            return res.status(400).json({
                error: 'Email parameter required'
            });
        }

        const account = await getAccountConfig(email);

        if (!account) {
            return res.status(404).json({
                error: 'Account not found'
            });
        }

        let tokenValid = true;
        if (account.authType === 'oauth') {
            tokenValid = await validateTokens(email);
        }

        res.json({
            id: account.id,
            email: account.email,
            authType: account.authType,
            isActive: account.isActive,
            syncStatus: account.syncStatus,
            createdAt: account.createdAt,
            lastSyncAt: account.lastSyncAt,
            tokenValid
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch account details',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const disconnectAccount = async (req: Request, res: Response) => {
    try {
        let { email } = req.params;

        email = decodeURIComponent(email);

        if (!email) {
            return res.status(400).json({
                error: 'Email parameter required'
            });
        }

        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'You must be logged in to disconnect accounts'
            });
        }

        const { getAccountConfigsByUserId, deleteAccountConfigById } = await import('../services/oauth-storage.service');
        const userAccounts = await getAccountConfigsByUserId(userId);
        const accountsToDelete = userAccounts.filter(acc => acc.email === email);

        if (accountsToDelete.length === 0) {
            return res.status(404).json({
                error: 'Account not found',
                message: 'No account found with this email address for your user'
            });
        }

        for (const account of accountsToDelete) {
            if (account.authType !== 'oauth') {
                return res.status(400).json({
                    error: 'Cannot disconnect IMAP accounts',
                    message: 'IMAP accounts are managed via environment variables'
                });
            }

            await deleteAccountConfigById(account.id);
        }

        await disconnectOAuthAccount(email);

        res.json({
            success: true,
            message: `Account ${email} disconnected successfully`,
            deletedCount: accountsToDelete.length
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to disconnect account',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const toggleAccountStatus = async (req: Request, res: Response) => {
    try {
        let { email } = req.params;

        email = decodeURIComponent(email);

        if (!email) {
            return res.status(400).json({
                error: 'Email parameter required'
            });
        }

        const account = await getAccountConfig(email);

        if (!account) {
            return res.status(404).json({
                error: 'Account not found'
            });
        }

        const newStatus = !account.isActive;

        await updateAccountConfig(email, {
            isActive: newStatus,
            syncStatus: newStatus ? 'idle' : 'disconnected'
        });

        res.json({
            success: true,
            email,
            isActive: newStatus,
            message: `Account ${newStatus ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to toggle account status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const forceReconnectOAuth = async (req: Request, res: Response) => {
    try {
        let { email } = req.params;

        email = decodeURIComponent(email);

        if (!email) {
            return res.status(400).json({
                error: 'Email parameter required'
            });
        }

        const account = await getAccountConfig(email);

        if (!account) {
            return res.status(404).json({
                error: 'Account not found'
            });
        }

        if (account.authType !== 'oauth') {
            return res.status(400).json({
                error: 'Cannot force reconnect IMAP accounts',
                message: 'IMAP accounts are managed via environment variables'
            });
        }

        const authUrl = await forceReconnectAccount(email);

        res.json({
            success: true,
            message: `Force reconnect initiated for ${email}`,
            authUrl,
            redirectToAuth: true
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to force reconnect account',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const cleanupInvalidOAuthTokens = async (req: Request, res: Response) => {
    try {
        await cleanupInvalidTokens();

        res.json({
            success: true,
            message: 'Invalid OAuth tokens cleanup completed successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to cleanup invalid OAuth tokens',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};