import { Request, Response } from 'express';
import { oauthService, accountRepository, oauthRepository } from '../core/container';

export const initiateGmailOAuth = async (req: Request, res: Response) => {
    try {
        const client = oauthService.createOAuthClient();
        const authUrl = oauthService.generateAuthUrl(client);

        const acceptHeader = req.headers['accept'] || '';
        const isAjaxRequest = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
            (acceptHeader.includes('application/json') && !acceptHeader.includes('text/html'));

        if (isAjaxRequest) {
            res.json({
                success: true,
                authUrl
            });
        } else {
            res.redirect(authUrl);
        }
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

        const client = oauthService.createOAuthClient();
        const tokens = await oauthService.exchangeCodeForTokens(client, code);

        const email = await oauthService.getUserEmailFromToken(tokens.accessToken);

        const isLoginFlow = !req.session?.userId;

        if (isLoginFlow) {
            const { google } = await import('googleapis');
            const { authService, userService } = await import('../core/container');
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

            const user = await authService.findOrCreateOAuthUser({
                email: userInfo.data.email,
                name: userInfo.data.name,
                oauthProvider: 'google'
            });

            const existingAccounts = await accountRepository.getByUserId(user.id);
            const gmailAccountExists = existingAccounts.some(
                (account: any) => account.email === userInfo.data.email && account.authType === 'oauth'
            );

            if (!gmailAccountExists) {
                const accountId = `acc_${nanoid(12)}`;
                const isPrimary = existingAccounts.length === 0;

                await accountRepository.store({
                    id: accountId,
                    userId: user.id,
                    email: userInfo.data.email,
                    authType: 'oauth',
                    isPrimary,
                    isActive: true,
                    syncStatus: 'idle',
                    createdAt: new Date()
                });

                await oauthRepository.storeTokens({
                    id: `oauth_${userInfo.data.email}`,
                    email: userInfo.data.email,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken || undefined,
                    tokenExpiry: tokens.expiryDate ? new Date(tokens.expiryDate) : undefined,
                    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
                    createdAt: new Date()
                });

                if (isPrimary) {
                    await userService.updateUser(user.id, { primaryEmailAccountId: accountId });
                }
            }

            await userService.updateLastLogin(user.id);

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
            // Account connection flow (user already logged in)
            const userId = req.session.userId!;
            const { nanoid } = await import('nanoid');

            const existingConnection = await oauthService.hasValidOAuthConnection(email);
            if (existingConnection) {
                await oauthService.disconnectOAuthAccount(email);
            }

            // Create account record with proper userId
            const accountId = `acc_${nanoid(12)}`;
            const existingAccounts = await accountRepository.getByUserId(userId);
            const isPrimary = existingAccounts.length === 0;

            await accountRepository.store({
                id: accountId,
                userId: userId,
                email: email,
                authType: 'oauth',
                isPrimary,
                isActive: true,
                syncStatus: 'idle',
                createdAt: new Date()
            });

            // Store OAuth tokens
            await oauthRepository.storeTokens({
                id: `oauth_${email}`,
                email: email,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken || undefined,
                tokenExpiry: tokens.expiryDate ? new Date(tokens.expiryDate) : undefined,
                scope: tokens.scope || ['https://www.googleapis.com/auth/gmail.readonly'],
                createdAt: new Date()
            });

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
            accounts = await accountRepository.getByUserId(userId);
        } else {
            accounts = await accountRepository.getAll();
        }

        const accountList = accounts.map((account: any) => ({
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

        const account = await accountRepository.getByEmail(email);

        if (!account) {
            return res.status(404).json({
                error: 'Account not found'
            });
        }

        let tokenValid = true;
        if (account.authType === 'oauth') {
            tokenValid = await oauthService.validateTokens(email);
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

        const userAccounts = await accountRepository.getByUserId(userId);
        const accountsToDelete = userAccounts.filter((acc: any) => acc.email === email);

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

            await accountRepository.deleteById(account.id);
        }

        await oauthService.disconnectOAuthAccount(email);

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

        const account = await accountRepository.getByEmail(email);

        if (!account) {
            return res.status(404).json({
                error: 'Account not found'
            });
        }

        const newStatus = !account.isActive;

        await accountRepository.updateByEmail(email, {
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

        const account = await accountRepository.getByEmail(email);

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

        const authUrl = await oauthService.forceReconnectAccount(email);

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
        await oauthService.cleanupInvalidTokens();

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