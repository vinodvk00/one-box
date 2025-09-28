import { Router } from 'express';
import {
    initiateGmailOAuth,
    handleOAuthCallback,
    getConnectedAccounts,
    getAccountDetails,
    disconnectAccount,
    toggleAccountStatus
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

export default router;