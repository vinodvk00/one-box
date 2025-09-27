import { Router, Request, Response } from 'express';
import { searchEmails, getEmailById, getCategoryStats, getUncategorizedEmails, categorizeEmailById } from '../services/elasticsearch.service';
import { startBatchCategorization, isBatchCategorizationRunning } from '../services/batch-categorization.service';

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
router.get('/search', async (req: Request, res: Response) => {
    try {
        const { q, account, folder, category } = req.query;
        const emails = await searchEmails(
            q as string,
            {
                account: account as string,
                folder: folder as string,
                category: category as string
            }
        );
        res.json(emails);
    } catch (error) {
        console.error('Search failed:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

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
router.get('/uncategorized', async (req: Request, res: Response) => {
    try {
        const emails = await getUncategorizedEmails();
        res.json(emails);
    } catch (error) {
        console.error('Failed to fetch uncategorized emails:', error);
        res.status(500).json({ error: 'Failed to fetch uncategorized emails' });
    }
});

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
router.post('/:id/categorize', async (req: Request, res: Response) => {
    try {
        const result = await categorizeEmailById(req.params.id);
        if (!result) {
            return res.status(500).json({ error: 'Categorization failed' });
        }
        res.json(result);
    } catch (error) {
        console.error(`Failed to categorize email ${req.params.id}:`, error);
        res.status(404).json({ error: 'Email not found or categorization failed' });
    }
});

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
router.get('/', async (req: Request, res: Response) => {
    try {
        const { account, folder, category } = req.query;
        const emails = await searchEmails('', {
            account: account as string,
            folder: folder as string,
            category: category as string
        });
        res.json(emails);
    } catch (error) {
        console.error('Failed to fetch emails:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

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
router.get('/stats/categories', async (req: Request, res: Response) => {
    try {
        const stats = await getCategoryStats();
        res.json(stats);
    } catch (error) {
        console.error('Failed to fetch category stats:', error);
        res.status(500).json({ error: 'Failed to fetch category stats' });
    }
});

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
router.post('/batch-categorize', async (req: Request, res: Response) => {
    try {
        if (isBatchCategorizationRunning()) {
            res.json({
                status: 'already_running',
                message: 'Batch categorization is already in progress'
            });
        } else {
            startBatchCategorization().catch(err => {
                console.error('Batch categorization error:', err);
            });
            res.json({
                status: 'started',
                message: 'Batch categorization started successfully'
            });
        }
    } catch (error) {
        console.error('Failed to start batch categorization:', error);
        res.status(500).json({ error: 'Failed to start batch categorization' });
    }
});

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
router.get('/batch-categorize/status', async (req: Request, res: Response) => {
    try {
        const isRunning = isBatchCategorizationRunning();
        const uncategorizedEmails = await getUncategorizedEmails();

        res.json({
            isRunning,
            uncategorizedCount: uncategorizedEmails.length
        });
    } catch (error) {
        console.error('Failed to get batch status:', error);
        res.status(500).json({ error: 'Failed to get batch status' });
    }
});

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
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const email = await getEmailById(req.params.id);
        res.json(email);
    } catch (error) {
        console.error(`Email not found for id: ${req.params.id}`, error);
        res.status(404).json({ error: 'Email not found' });
    }
});

export default router;