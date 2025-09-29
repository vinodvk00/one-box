import { Router } from 'express';
import {
    initiateGmailOAuth,
    handleOAuthCallback,
    getConnectedAccounts,
    getAccountDetails,
    disconnectAccount,
    toggleAccountStatus,
    forceReconnectOAuth,
    cleanupInvalidOAuthTokens
} from '../controllers/auth.controller';

const router = Router();

/**
 * @openapi
 * /auth/gmail/connect:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Initiate Gmail OAuth flow
 *     description: Redirects user to Google OAuth consent screen to authorize Gmail access.
 *     responses:
 *       '302':
 *         description: Redirect to Google OAuth authorization URL
 *       '500':
 *         description: Failed to initiate OAuth flow
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 message:
 *                   type: string
 */
router.get('/gmail/connect', initiateGmailOAuth);

/**
 * @openapi
 * /auth/google/callback:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Handle OAuth callback from Google
 *     description: Processes the authorization code from Google and stores OAuth tokens.
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
 *       '200':
 *         description: OAuth connection established successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 email:
 *                   type: string
 *                 authType:
 *                   type: string
 *                   enum: [oauth]
 *       '400':
 *         description: OAuth authorization failed or missing code
 *       '500':
 *         description: OAuth callback processing failed
 */
router.get('/google/callback', handleOAuthCallback);

/**
 * @openapi
 * /auth/accounts:
 *   get:
 *     tags:
 *       - Account Management
 *     summary: Get all connected accounts
 *     description: Returns list of all connected email accounts (both IMAP and OAuth).
 *     responses:
 *       '200':
 *         description: List of connected accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       email:
 *                         type: string
 *                       authType:
 *                         type: string
 *                         enum: [imap, oauth]
 *                       isActive:
 *                         type: boolean
 *                       syncStatus:
 *                         type: string
 *                         enum: [idle, syncing, error, disconnected]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastSyncAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *       '500':
 *         description: Failed to fetch accounts
 */
router.get('/accounts', getConnectedAccounts);

/**
 * @openapi
 * /auth/accounts/{email}:
 *   get:
 *     tags:
 *       - Account Management
 *     summary: Get specific account details
 *     description: Returns detailed information about a specific connected account.
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email address of the account
 *     responses:
 *       '200':
 *         description: Account details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 authType:
 *                   type: string
 *                   enum: [imap, oauth]
 *                 isActive:
 *                   type: boolean
 *                 syncStatus:
 *                   type: string
 *                   enum: [idle, syncing, error, disconnected]
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 lastSyncAt:
 *                   type: string
 *                   format: date-time
 *                 tokenValid:
 *                   type: boolean
 *                   description: Whether OAuth tokens are valid (OAuth accounts only)
 *       '400':
 *         description: Email parameter required
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Failed to fetch account details
 */
router.get('/accounts/:email', getAccountDetails);

/**
 * @openapi
 * /auth/accounts/{email}:
 *   delete:
 *     tags:
 *       - Account Management
 *     summary: Disconnect an account
 *     description: Disconnects an OAuth account and removes stored tokens.
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email address of the account to disconnect
 *     responses:
 *       '200':
 *         description: Account disconnected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       '400':
 *         description: Cannot disconnect IMAP accounts or missing email parameter
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Failed to disconnect account
 */
router.delete('/accounts/:email', disconnectAccount);

/**
 * @openapi
 * /auth/accounts/{email}/toggle:
 *   patch:
 *     tags:
 *       - Account Management
 *     summary: Toggle account active status
 *     description: Activates or deactivates an account for email synchronization.
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email address of the account
 *     responses:
 *       '200':
 *         description: Account status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 email:
 *                   type: string
 *                 isActive:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       '400':
 *         description: Email parameter required
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Failed to toggle account status
 */
router.patch('/accounts/:email/toggle', toggleAccountStatus);

/**
 * @openapi
 * /auth/accounts/{email}/force-reconnect:
 *   post:
 *     tags:
 *       - Account Management
 *     summary: Force reconnect OAuth account
 *     description: Forces a full OAuth reconnection flow by clearing existing tokens and redirecting to Google OAuth.
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email address of the OAuth account to force reconnect
 *     responses:
 *       '200':
 *         description: Force reconnect initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 authUrl:
 *                   type: string
 *                   description: OAuth authorization URL to redirect to
 *                 redirectToAuth:
 *                   type: boolean
 *       '400':
 *         description: Cannot force reconnect IMAP accounts or missing email parameter
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Failed to force reconnect account
 */
router.post('/accounts/:email/force-reconnect', forceReconnectOAuth);

/**
 * @openapi
 * /auth/cleanup-invalid-tokens:
 *   post:
 *     tags:
 *       - Account Management
 *     summary: Cleanup invalid OAuth tokens
 *     description: Validates all OAuth tokens and removes any that are invalid or expired.
 *     responses:
 *       '200':
 *         description: Invalid tokens cleanup completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       '500':
 *         description: Failed to cleanup invalid OAuth tokens
 */
router.post('/cleanup-invalid-tokens', cleanupInvalidOAuthTokens);

export default router;