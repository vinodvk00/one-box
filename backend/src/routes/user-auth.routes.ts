import { Router } from 'express';
import {
    register,
    login,
    logout,
    getCurrentUser
} from '../controllers/user-auth.controller';
import { initiateGmailOAuth } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import {
    validateRegister,
    validateLogin
} from '../middleware/validation.middleware';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - User Authentication
 *     summary: Register a new user
 *     description: Create a new user account with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *     responses:
 *       '201':
 *         description: User registered successfully
 *       '400':
 *         description: Validation error or user already exists
 *       '500':
 *         description: Registration failed
 */
router.post('/register', validateRegister, register);

/**
 * @openapi
 * /auth/login/google:
 *   get:
 *     tags:
 *       - User Authentication
 *     summary: Initiate OAuth login with Google
 *     description: Redirects user to Google OAuth consent screen for app login.
 *                  After authorization, user will be created/logged in and Gmail account connected.
 *     responses:
 *       '302':
 *         description: Redirect to Google OAuth authorization URL
 *       '500':
 *         description: Failed to initiate OAuth flow
 */
router.get('/login/google', initiateGmailOAuth);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - User Authentication
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Login successful
 *       '401':
 *         description: Invalid credentials
 *       '500':
 *         description: Login failed
 */
router.post('/login', validateLogin, login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags:
 *       - User Authentication
 *     summary: Logout current user
 *     description: Destroy current session and logout
 *     responses:
 *       '200':
 *         description: Logged out successfully
 *       '500':
 *         description: Logout failed
 */
router.post('/logout', logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags:
 *       - User Authentication
 *     summary: Get current user info
 *     description: Returns current logged-in user information and connected email accounts
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       '200':
 *         description: User info retrieved successfully
 *       '401':
 *         description: Not authenticated
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Failed to get user info
 */
router.get('/me', requireAuth, getCurrentUser);

/**
 * @openapi
 * /auth/change-password:
 *   patch:
 *     tags:
 *       - User Authentication
 *     summary: Change user password
 *     description: Change password for password-authenticated users
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       '200':
 *         description: Password changed successfully
 *       '400':
 *         description: Validation error or cannot change password for OAuth users
 *       '401':
 *         description: Current password is incorrect
 *       '500':
 *         description: Failed to change password
 */
// TODO: add changePassword route when implemented
// router.patch('/change-password', requireAuth, validateChangePassword, changePassword);

// todo: forgot-password routes to support resetting password via email link, #goodtohave

/**
 * @openapi
 * /auth/google/callback:
 *   get:
 *     tags:
 *       - User Authentication
 *     summary: Handle OAuth callback for app login
 *     description: Process OAuth callback, create/login user, and connect Gmail account.
 *                  This endpoint is shared with legacy OAuth flow but will create/login user
 *                  and redirect to /auth/callback instead of /settings.
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Google
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: OAuth error from Google (if any)
 *     responses:
 *       '302':
 *         description: Redirects to frontend callback page
 *       '400':
 *         description: OAuth error or invalid code
 *       '500':
 *         description: OAuth callback failed
 */
// This route is intentionally removed - using the unified callback in auth.routes.ts
// router.get('/google/callback', handleOAuthLoginCallback);

export default router;
