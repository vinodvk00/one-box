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

        console.log('🔗 OAuth flow initiated, redirecting to Google...');
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
        const { code, error: oauthError } = req.query;

        if (oauthError) {
            console.error('OAuth error:', oauthError);
            const errorRedirectUrl = `${frontendUrl}/settings?oauth=error&message=${encodeURIComponent(`Google returned error: ${oauthError}`)}`;
            return res.redirect(errorRedirectUrl);
        }

        if (!code || typeof code !== 'string') {
            const errorRedirectUrl = `${frontendUrl}/settings?oauth=error&message=${encodeURIComponent('No authorization code received from Google')}`;
            return res.redirect(errorRedirectUrl);
        }

        console.log('🔄 Processing OAuth callback...');

        const client = createOAuthClient();
        const tokens = await exchangeCodeForTokens(client, code);

        const email = await getUserEmailFromToken(tokens.accessToken);

        const existingConnection = await hasValidOAuthConnection(email);
        if (existingConnection) {
            console.log(`⚠️  Account ${email} already connected, updating tokens...`);
            await disconnectOAuthAccount(email);
        }

        await storeUserOAuthData(email, tokens);

        console.log(`✅ OAuth connection established for ${email}`);

        const redirectUrl = `${frontendUrl}/settings?oauth=success&email=${encodeURIComponent(email)}`;
        res.redirect(redirectUrl);

    } catch (error) {
        console.error('OAuth callback failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorRedirectUrl = `${frontendUrl}/settings?oauth=error&message=${encodeURIComponent(`OAuth callback failed: ${errorMessage}`)}`;
        res.redirect(errorRedirectUrl);
    }
};

export const getConnectedAccounts = async (req: Request, res: Response) => {
    try {
        const accounts = await getAllAccountConfigs();

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
        console.error('Failed to fetch connected accounts:', error);
        res.status(500).json({
            error: 'Failed to fetch accounts',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getAccountDetails = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;

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
        console.error('Failed to fetch account details:', error);
        res.status(500).json({
            error: 'Failed to fetch account details',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const disconnectAccount = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;

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
                error: 'Cannot disconnect IMAP accounts',
                message: 'IMAP accounts are managed via environment variables'
            });
        }

        await disconnectOAuthAccount(email);

        console.log(`🔌 Disconnected OAuth account: ${email}`);

        res.json({
            success: true,
            message: `Account ${email} disconnected successfully`
        });
    } catch (error) {
        console.error('Failed to disconnect account:', error);
        res.status(500).json({
            error: 'Failed to disconnect account',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const toggleAccountStatus = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;

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

        console.log(`🔄 Account ${email} ${newStatus ? 'activated' : 'deactivated'}`);

        res.json({
            success: true,
            email,
            isActive: newStatus,
            message: `Account ${newStatus ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        console.error('Failed to toggle account status:', error);
        res.status(500).json({
            error: 'Failed to toggle account status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const forceReconnectOAuth = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;

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

        console.log(`🔄 Force reconnect initiated for ${email}`);

        res.json({
            success: true,
            message: `Force reconnect initiated for ${email}`,
            authUrl,
            redirectToAuth: true
        });
    } catch (error) {
        console.error('Failed to force reconnect account:', error);
        res.status(500).json({
            error: 'Failed to force reconnect account',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const cleanupInvalidOAuthTokens = async (req: Request, res: Response) => {
    try {
        console.log('🧹 Cleanup invalid OAuth tokens requested');

        await cleanupInvalidTokens();

        res.json({
            success: true,
            message: 'Invalid OAuth tokens cleanup completed successfully'
        });
    } catch (error) {
        console.error('Failed to cleanup invalid OAuth tokens:', error);
        res.status(500).json({
            error: 'Failed to cleanup invalid OAuth tokens',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};