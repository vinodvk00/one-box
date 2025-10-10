import { Request, Response } from 'express';
import { google } from 'googleapis';
import { nanoid } from 'nanoid';
import { accountRepository, oauthRepository, userService } from '../core/container';
import { encrypt } from '../services/shared/encryption.service';
import { ImapFlow } from 'imapflow';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

/**
 * POST /auth/accounts/connect/gmail
 * Initiate Gmail OAuth connection (for adding email account)
 */
export const connectGmailAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to connect accounts'
            });
            return;
        }

        req.session.pendingAccountConnection = true;

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/gmail.readonly'],
            prompt: 'consent'
        });

        res.json({
            success: true,
            authUrl
        });
    } catch (error) {
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to initiate Gmail connection'
        });
    }
};

/**
 * GET /auth/accounts/gmail/callback
 * Handle Gmail OAuth callback (for adding email account)
 */
export const handleGmailAccountCallback = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, error } = req.query;
        const userId = req.session?.userId;

        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to connect accounts'
            });
            return;
        }

        if (!req.session.pendingAccountConnection) {
            res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid request - no pending connection'
            });
            return;
        }

        if (error) {
            delete req.session.pendingAccountConnection;
            res.status(400).json({
                error: 'OAuth Error',
                message: `OAuth authorization failed: ${error}`
            });
            return;
        }

        if (!code || typeof code !== 'string') {
            delete req.session.pendingAccountConnection;
            res.status(400).json({
                error: 'Bad Request',
                message: 'Authorization code is required'
            });
            return;
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        if (!userInfo.data.email) {
            delete req.session.pendingAccountConnection;
            res.status(400).json({
                error: 'OAuth Error',
                message: 'Failed to get email from Google'
            });
            return;
        }

        const existingAccounts = await accountRepository.getByUserId(userId);
        const alreadyConnected = existingAccounts.some(
            (account: any) => account.email === userInfo.data.email
        );

        if (alreadyConnected) {
            delete req.session.pendingAccountConnection;
            res.status(400).json({
                error: 'Already Connected',
                message: 'This email account is already connected'
            });
            return;
        }

        const accountId = `acc_${nanoid(12)}`;
        const isPrimary = existingAccounts.length === 0;

        await accountRepository.store({
            id: accountId,
            userId,
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
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token || undefined,
            tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
            scope: ['https://www.googleapis.com/auth/gmail.readonly'],
            createdAt: new Date()
        });

        if (isPrimary) {
            await userService.updateUser(userId, { primaryEmailAccountId: accountId });
        }

        delete req.session.pendingAccountConnection;

        res.json({
            success: true,
            account: {
                id: accountId,
                email: userInfo.data.email,
                authType: 'oauth',
                isPrimary,
                isActive: true
            },
            message: 'Gmail account connected successfully'
        });
    } catch (error: any) {
        delete req.session?.pendingAccountConnection;

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to connect Gmail account'
        });
    }
};

/**
 * POST /auth/accounts/connect/imap
 * Connect IMAP account
 */
export const connectImapAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.session?.userId;
        const { email, password, imapHost, imapPort, secure } = req.body;

        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to connect accounts'
            });
            return;
        }

        try {
            const client = new ImapFlow({
                host: imapHost,
                port: imapPort,
                secure,
                auth: {
                    user: email,
                    pass: password
                },
                logger: false
            });

            await client.connect();
            await client.logout();
        } catch (error: any) {
            res.status(400).json({
                error: 'IMAP Connection Failed',
                message: `Failed to connect to IMAP server: ${error.message}`
            });
            return;
        }

        const existingAccounts = await accountRepository.getByUserId(userId);
        const alreadyConnected = existingAccounts.some((account: any) => account.email === email);

        if (alreadyConnected) {
            res.status(400).json({
                error: 'Already Connected',
                message: 'This email account is already connected'
            });
            return;
        }

        const encryptedPassword = encrypt(password);

        const accountId = `acc_${nanoid(12)}`;
        const isPrimary = existingAccounts.length === 0;

        await accountRepository.store({
            id: accountId,
            userId,
            email,
            authType: 'imap',
            isPrimary,
            isActive: true,
            imapConfig: {
                host: imapHost,
                port: imapPort,
                secure,
                password: encryptedPassword
            },
            syncStatus: 'idle',
            createdAt: new Date()
        });

        if (isPrimary) {
            await userService.updateUser(userId, { primaryEmailAccountId: accountId });
        }

        res.status(201).json({
            success: true,
            account: {
                id: accountId,
                email,
                authType: 'imap',
                isPrimary,
                isActive: true
            },
            message: 'IMAP account connected successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to connect IMAP account'
        });
    }
};

/**
 * GET /auth/accounts
 * List connected email accounts
 */
export const listConnectedAccounts = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to view accounts'
            });
            return;
        }

        const accounts = await accountRepository.getByUserId(userId);

        res.json({
            accounts: accounts.map((account: any) => ({
                id: account.id,
                email: account.email,
                authType: account.authType,
                isPrimary: account.isPrimary,
                isActive: account.isActive,
                syncStatus: account.syncStatus,
                lastSyncAt: account.lastSyncAt,
                createdAt: account.createdAt
            })),
            total: accounts.length
        });
    } catch (error) {
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to list accounts'
        });
    }
};

/**
 * PATCH /auth/accounts/:accountId/set-primary
 * Set account as primary
 */
export const setPrimaryAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.session?.userId;
        const { accountId } = req.params;

        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to manage accounts'
            });
            return;
        }

        const account = await accountRepository.getById(accountId);
        if (!account || account.userId !== userId) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Account not found'
            });
            return;
        }

        await accountRepository.updateByUserId(userId, { isPrimary: false });

        await accountRepository.updateById(accountId, { isPrimary: true });

        await userService.updateUser(userId, { primaryEmailAccountId: accountId });

        res.json({
            success: true,
            message: 'Primary account updated'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to set primary account'
        });
    }
};

/**
 * PATCH /auth/accounts/:accountId/toggle
 * Toggle account active status
 */
export const toggleAccountStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.session?.userId;
        const { accountId } = req.params;

        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to manage accounts'
            });
            return;
        }

        const account = await accountRepository.getById(accountId);
        if (!account || account.userId !== userId) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Account not found'
            });
            return;
        }

        const newStatus = !account.isActive;
        await accountRepository.updateById(accountId, { isActive: newStatus });

        res.json({
            success: true,
            email: account.email,
            isActive: newStatus,
            message: `Account ${newStatus ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to toggle account status'
        });
    }
};

/**
 * DELETE /auth/accounts/:accountId
 * Remove account
 */
export const removeAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.session?.userId;
        const { accountId } = req.params;

        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to manage accounts'
            });
            return;
        }

        const account = await accountRepository.getById(accountId);
        if (!account || account.userId !== userId) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Account not found'
            });
            return;
        }

        const userAccounts = await accountRepository.getByUserId(userId);

        // If this is primary and other accounts exist, set another as primary
        // todo: change to prompt user to select new primary if multiple exist by verifying password
        if (account.isPrimary && userAccounts.length > 1) {
            const otherAccount = userAccounts.find((a: any) => a.id !== accountId);
            if (otherAccount) {
                await accountRepository.updateById(otherAccount.id, { isPrimary: true });
                await userService.updateUser(userId, { primaryEmailAccountId: otherAccount.id });
            }
        } else if (account.isPrimary) {
            await userService.updateUser(userId, { primaryEmailAccountId: undefined });
        }

        if (account.authType === 'oauth') {
            await oauthRepository.deleteTokens(account.email);
        }

        await accountRepository.deleteById(accountId);

        res.json({
            success: true,
            message: 'Account removed successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to remove account'
        });
    }
};
