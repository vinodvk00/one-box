import { Router } from 'express';
import {
    searchEmails,
    getAllEmails,
    getEmailById,
    getUncategorizedEmails,
    categorizeEmail,
    getCategoryStats,
    startBatchCategorization,
    getBatchCategorizationStatus
} from '../controllers/email.controller';

const router = Router();


/**
 * @openapi
 * components:
 *   schemas:
 *     Email:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The unique ID of the email document.
 *           example: user@example.com_123
 *         account:
 *           type: string
 *           description: The email account this email belongs to.
 *           example: user@example.com
 *         folder:
 *           type: string
 *           description: The folder the email is in.
 *           example: INBOX
 *         subject:
 *           type: string
 *           description: The subject of the email.
 *         from:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             address:
 *               type: string
 *         to:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *         date:
 *           type: string
 *           format: date-time
 *           description: The date the email was received.
 *         body:
 *           type: string
 *           description: The full body of the email (text or html).
 *         textBody:
 *           type: string
 *           description: The plain text version of the email body.
 *         htmlBody:
 *           type: string
 *           description: The HTML version of the email body.
 *         flags:
 *           type: array
 *           items:
 *             type: string
 *           description: IMAP flags for the email (e.g., '\\Seen').
 *         category:
 *           type: string
 *           enum: [Interested, Meeting Booked, Not Interested, Spam, Out of Office]
 *           description: AI-generated email category.
 *         uid:
 *           type: string
 *           description: The IMAP unique ID of the email.
 *     CategoryStats:
 *       type: object
 *       properties:
 *         category:
 *           type: string
 *           description: The category name.
 *         count:
 *           type: integer
 *           description: Number of emails in this category.
 */

/**
 * @openapi
 * /api/search:
 *   get:
 *     tags:
 *       - Emails
 *     summary: Search and filter emails
 *     description: Performs a full-text search and allows filtering by account, folder, and category.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: The search term to query for in email subjects, bodies, and senders.
 *       - in: query
 *         name: account
 *         schema:
 *           type: string
 *         description: The email account to filter by.
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *         description: The folder to filter by.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Interested, Meeting Booked, Not Interested, Spam, Out of Office]
 *         description: The AI category to filter by.
 *     responses:
 *       '200':
 *         description: A list of emails matching the criteria.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Email'
 *       '500':
 *         description: Server error
 */
router.get('/search', searchEmails);

/**
 * @openapi
 * /api/uncategorized:
 *   get:
 *     tags:
 *       - Emails
 *     summary: Get uncategorized emails
 *     description: Returns emails that don't have an AI category assigned.
 *     responses:
 *       '200':
 *         description: List of uncategorized emails.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Email'
 */
router.get('/uncategorized', getUncategorizedEmails);

/**
 * @openapi
 * /api/{id}/categorize:
 *   post:
 *     tags:
 *       - Emails
 *     summary: Categorize a specific email
 *     description: Manually trigger AI categorization for a specific email.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the email document.
 *     responses:
 *       '200':
 *         description: Email categorized successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 category:
 *                   type: string
 *                 confidence:
 *                   type: number
 *       '404':
 *         description: Email not found.
 *       '500':
 *         description: Categorization failed.
 */
router.post('/:id/categorize', categorizeEmail);

/**
 * @openapi
 * /api:
 *   get:
 *     tags:
 *       - Emails
 *     summary: Get all emails with optional filters
 *     description: Retrieves all emails and allows filtering by account, folder, and category.
 *     parameters:
 *       - in: query
 *         name: account
 *         schema:
 *           type: string
 *         description: The email account to filter by.
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *         description: The folder to filter by.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Interested, Meeting Booked, Not Interested, Spam, Out of Office]
 *         description: The AI category to filter by.
 *     responses:
 *       '200':
 *         description: A list of all emails matching the filters.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Email'
 *       '500':
 *         description: Server error
 */
router.get('/', getAllEmails);

/**
 * @openapi
 * /api/stats/categories:
 *   get:
 *     tags:
 *       - Statistics
 *     summary: Get email category statistics
 *     description: Returns count of emails per category.
 *     responses:
 *       '200':
 *         description: Category statistics.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CategoryStats'
 *       '500':
 *         description: Server error
 */
router.get('/stats/categories', getCategoryStats);

/**
 * @openapi
 * /api/batch-categorize:
 *   post:
 *     tags:
 *       - Categorization
 *     summary: Start batch categorization
 *     description: Manually trigger batch categorization for all uncategorized emails.
 *     responses:
 *       '200':
 *         description: Batch categorization started or already running.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [started, already_running]
 *                 message:
 *                   type: string
 *       '500':
 *         description: Server error
 */
router.post('/batch-categorize', startBatchCategorization);

/**
 * @openapi
 * /api/batch-categorize/status:
 *   get:
 *     tags:
 *       - Categorization
 *     summary: Get batch categorization status
 *     description: Check if batch categorization is currently running.
 *     responses:
 *       '200':
 *         description: Current batch categorization status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isRunning:
 *                   type: boolean
 *                 uncategorizedCount:
 *                   type: integer
 */
router.get('/batch-categorize/status', getBatchCategorizationStatus);

/**
 * @openapi
 * /api/{id}:
 *   get:
 *     tags:
 *       - Emails
 *     summary: Get a single email by its ID
 *     description: Retrieves a specific email using its unique Elasticsearch document ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the email document.
 *     responses:
 *       '200':
 *         description: The requested email document.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Email'
 *       '404':
 *         description: Email not found.
 *       '500':
 *         description: Server error
 */
router.get('/:id', getEmailById);

export default router;