import { Request, Response } from 'express';
import { registerUser, loginUser, findOrCreateOAuthUser, validateChangePassword, verifyPassword } from '../services/auth.service';
import { findUserById, updateUser, updateLastLogin } from '../services/user.service';
import { toUserResponse } from '../types/user.types';
import { google } from 'googleapis';
import { getAccountConfigsByUserId, storeAccountConfig } from '../services/oauth-storage.service';
import { nanoid } from 'nanoid';
import { storeOAuthTokens } from '../services/oauth-storage.service';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

/**
 * POST /auth/register
 * Register a new user with email/password
 */
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, name } = req.body;

        const user = await registerUser({
            email,
            password,
            name,
            authMethod: 'password'
        });

        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.role = user.role;

        res.status(201).json({
            success: true,
            user: toUserResponse(user),
            message: 'Registration successful'
        });
    } catch (error: any) {
        console.error('Registration error:', error);

        if (error.name === 'ValidationError') {
            res.status(400).json({
                error: 'Validation Error',
                message: error.message
            });
            return;
        }

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Registration failed'
        });
    }
};

/**
 * POST /auth/login
 * Login with email/password
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        const user = await loginUser({ email, password });

        await updateLastLogin(user.id);

        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.role = user.role;

        res.json({
            success: true,
            user: toUserResponse(user),
            message: 'Login successful'
        });
    } catch (error: any) {
        console.error('Login error:', error);

        if (error.name === 'ValidationError' || error.name === 'AuthenticationError') {
            res.status(401).json({
                error: 'Authentication Failed',
                message: error.message
            });
            return;
        }

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Login failed'
        });
    }
};

/**
 * POST /auth/logout
 * Logout current user
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Logout failed'
                });
                return;
            }

            res.clearCookie('connect.sid');
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Logout failed'
        });
    }
};

/**
 * GET /auth/me
 * Get current user info
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Not logged in'
            });
            return;
        }

        const user = await findUserById(userId);
        if (!user) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
            return;
        }

        const emailAccounts = await getAccountConfigsByUserId(userId);

        res.json({
            user: toUserResponse(user),
            emailAccounts: emailAccounts.map(account => ({
                id: account.id,
                email: account.email,
                authType: account.authType,
                isPrimary: account.isPrimary,
                isActive: account.isActive,
                syncStatus: account.syncStatus,
                lastSyncAt: account.lastSyncAt
            })),
            totalAccounts: emailAccounts.length
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get user info'
        });
    }
};

/**
 * PATCH /auth/change-password
 * Change user password
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.session.userId;
        const { currentPassword, newPassword } = req.body;

        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Not logged in'
            });
            return;
        }

        await validateChangePassword(userId, currentPassword, newPassword);

        const user = await findUserById(userId);
        if (!user) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
            return;
        }

        // NOTE: OAuth users don't have a password to change
        if (!user.password) {
            res.status(400).json({
                error: 'Bad Request',
                message: 'Cannot change password for OAuth users'
            });
            return;
        }

        const isValid = await verifyPassword(currentPassword, user.password);
        if (!isValid) {
            res.status(401).json({
                error: 'Authentication Failed',
                message: 'Current password is incorrect'
            });
            return;
        }

        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await updateUser(userId, { password: hashedPassword });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error: any) {
        console.error('Change password error:', error);

        if (error.name === 'ValidationError') {
            res.status(400).json({
                error: 'Validation Error',
                message: error.message
            });
            return;
        }

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to change password'
        });
    }
};

/**
 * GET /auth/login/google
 * Initiate OAuth login (for app login)
 */
export const initiateOAuthLogin = async (req: Request, res: Response): Promise<void> => {
    try {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/gmail.readonly'
            ],
            prompt: 'consent'
        });

        res.json({
            success: true,
            authUrl
        });
    } catch (error) {
        console.error('OAuth initiation error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to initiate OAuth login'
        });
    }
};

/**
 * GET /auth/google/callback
 * Handle OAuth callback (for app login)
 */
export const handleOAuthLoginCallback = async (req: Request, res: Response): Promise<void> => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
        const { code, error } = req.query;

        if (error) {
            console.error('OAuth error:', error);
            res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(String(error))}`);
            return;
        }

        if (!code || typeof code !== 'string') {
            res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('Authorization code is required')}`);
            return;
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

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
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token || undefined,
                tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
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
                console.error('Session save error:', err);
                res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('Failed to create session')}`);
                return;
            }

            res.redirect(`${frontendUrl}/auth/callback?success=true`);
        });
    } catch (error: any) {
        console.error('OAuth callback error:', error);

        let errorMessage = 'OAuth callback failed';
        if (error.name === 'AuthenticationError') {
            errorMessage = error.message;
        }

        res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
    }
};
