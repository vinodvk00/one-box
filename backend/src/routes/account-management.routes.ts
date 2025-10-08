import { Router } from 'express';
import {
    connectGmailAccount,
    handleGmailAccountCallback,
    connectImapAccount,
    listConnectedAccounts,
    setPrimaryAccount,
    toggleAccountStatus,
    removeAccount
} from '../controllers/account-management.controller';
import { requireAuth, requireAccountAccess } from '../middleware/auth.middleware';
import { validateConnectImap } from '../middleware/validation.middleware';

const router = Router();

/**
 * @openapi
 * /auth/accounts:
 *   get:
 *     tags:
 *       - Account Management
 *     summary: List connected email accounts
 *     description: Returns list of all email accounts connected to the current user
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       '200':
 *         description: List of connected accounts
 *       '401':
 *         description: Not authenticated
 *       '500':
 *         description: Failed to list accounts
 */
router.get('/accounts', requireAuth, listConnectedAccounts);

/**
 * @openapi
 * /auth/accounts/connect/gmail:
 *   post:
 *     tags:
 *       - Account Management
 *     summary: Initiate Gmail OAuth connection
 *     description: Start OAuth flow to connect a Gmail account
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       '200':
 *         description: OAuth URL generated successfully
 *       '401':
 *         description: Not authenticated
 *       '500':
 *         description: Failed to initiate Gmail connection
 */
router.post('/accounts/connect/gmail', requireAuth, connectGmailAccount);

/**
 * @openapi
 * /auth/accounts/gmail/callback:
 *   get:
 *     tags:
 *       - Account Management
 *     summary: Handle Gmail OAuth callback
 *     description: Process OAuth callback and connect Gmail account
 *     security:
 *       - sessionAuth: []
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
 *         description: Gmail account connected successfully
 *       '400':
 *         description: OAuth error or account already connected
 *       '401':
 *         description: Not authenticated
 *       '500':
 *         description: Failed to connect Gmail account
 */
router.get('/accounts/gmail/callback', requireAuth, handleGmailAccountCallback);

/**
 * @openapi
 * /auth/accounts/connect/imap:
 *   post:
 *     tags:
 *       - Account Management
 *     summary: Connect IMAP account
 *     description: Connect an email account using IMAP
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - imapHost
 *               - imapPort
 *               - secure
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               imapHost:
 *                 type: string
 *               imapPort:
 *                 type: integer
 *               secure:
 *                 type: boolean
 *     responses:
 *       '201':
 *         description: IMAP account connected successfully
 *       '400':
 *         description: Validation error or IMAP connection failed
 *       '401':
 *         description: Not authenticated
 *       '500':
 *         description: Failed to connect IMAP account
 */
router.post('/accounts/connect/imap', requireAuth, validateConnectImap, connectImapAccount);

/**
 * @openapi
 * /auth/accounts/{accountId}/set-primary:
 *   patch:
 *     tags:
 *       - Account Management
 *     summary: Set account as primary
 *     description: Set the specified account as the primary email account
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     responses:
 *       '200':
 *         description: Primary account updated successfully
 *       '401':
 *         description: Not authenticated
 *       '403':
 *         description: No access to this account
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Failed to set primary account
 */
router.patch('/accounts/:accountId/set-primary', requireAuth, requireAccountAccess, setPrimaryAccount);

/**
 * @openapi
 * /auth/accounts/{accountId}/toggle:
 *   patch:
 *     tags:
 *       - Account Management
 *     summary: Toggle account active status
 *     description: Activate or deactivate an email account
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     responses:
 *       '200':
 *         description: Account status toggled successfully
 *       '401':
 *         description: Not authenticated
 *       '403':
 *         description: No access to this account
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Failed to toggle account status
 */
router.patch('/accounts/:accountId/toggle', requireAuth, requireAccountAccess, toggleAccountStatus);

/**
 * @openapi
 * /auth/accounts/{accountId}:
 *   delete:
 *     tags:
 *       - Account Management
 *     summary: Remove account
 *     description: Remove an email account from the user's connected accounts
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     responses:
 *       '200':
 *         description: Account removed successfully
 *       '401':
 *         description: Not authenticated
 *       '403':
 *         description: No access to this account
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Failed to remove account
 */
router.delete('/accounts/:accountId', requireAuth, requireAccountAccess, removeAccount);

export default router;
