import { Request, Response } from 'express';
import { emailService, oauthService } from '../core/container';
import {
    startBatchCategorization as startBatchCategorizationService,
    isBatchCategorizationRunning
} from '../services/ai/batch-categorization.service';
import {
    fetchGmailMessages,
    syncAllOAuthAccounts
} from '../services/email/gmail.service';

// TODO: options for number of emails, days back, force reindex

/**
 * Search and filter emails
 */
export const searchEmails = async (req: Request, res: Response) => {
    try {
        const { q, account, folder, category, page, limit } = req.query;

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;

        const result = await emailService.searchEmails(
            q as string,
            {
                account: account as string,
                folder: folder as string,
                category: category as string
            },
            {
                page: pageNum,
                limit: limitNum
            }
        );
        res.json(result);
    } catch (error) {
        console.error('Search failed:', error);
        res.status(500).json({ error: 'Search failed' });
    }
};

/**
 * Get all emails with optional filters
 */
export const getAllEmails = async (req: Request, res: Response) => {
    try {
        const { account, folder, category, page, limit } = req.query;

        // Parse pagination parameters with defaults
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;

        const result = await emailService.searchEmails('', {
            account: account as string,
            folder: folder as string,
            category: category as string
        }, {
            page: pageNum,
            limit: limitNum
        });
        res.json(result);
    } catch (error) {
        console.error('Failed to fetch emails:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
};

/**
 *Get a single email by ID
 */
export const getEmailById = async (req: Request, res: Response) => {
    try {
        const email = await emailService.getEmailById(req.params.id);
        res.json(email);
    } catch (error) {
        console.error(`Email not found for id: ${req.params.id}`, error);
        res.status(404).json({ error: 'Email not found' });
    }
};

/**
 * Get uncategorized emails
 */
export const getUncategorizedEmails = async (req: Request, res: Response) => {
    try {
        const emails = await emailService.getUncategorizedEmails();
        res.json(emails);
    } catch (error) {
        console.error('Failed to fetch uncategorized emails:', error);
        res.status(500).json({ error: 'Failed to fetch uncategorized emails' });
    }
};

/**
 * Categorize a specific email
 */
export const categorizeEmail = async (req: Request, res: Response) => {
    try {
        const result = await emailService.categorizeEmailById(req.params.id);
        if (!result) {
            return res.status(500).json({ error: 'Categorization failed' });
        }
        res.json(result);
    } catch (error) {
        console.error(`Failed to categorize email ${req.params.id}:`, error);
        res.status(404).json({ error: 'Email not found or categorization failed' });
    }
};

/**
 * Get email category statistics
 */
export const getCategoryStats = async (req: Request, res: Response) => {
    try {
        const stats = await emailService.getCategoryStats();
        res.json(stats);
    } catch (error) {
        console.error('Failed to fetch category stats:', error);
        res.status(500).json({ error: 'Failed to fetch category stats' });
    }
};

/**
 * Start batch categorization
 */
export const startBatchCategorization = async (req: Request, res: Response) => {
    try {
        if (isBatchCategorizationRunning()) {
            res.json({
                status: 'already_running',
                message: 'Batch categorization is already in progress'
            });
        } else {
            startBatchCategorizationService().catch(err => {
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
};

/**
 * Get batch categorization status
 */
export const getBatchCategorizationStatus = async (req: Request, res: Response) => {
    try {
        const isRunning = isBatchCategorizationRunning();
        const uncategorizedEmails = await emailService.getUncategorizedEmails();

        res.json({
            isRunning,
            uncategorizedCount: uncategorizedEmails.length
        });
    } catch (error) {
        console.error('Failed to get batch status:', error);
        res.status(500).json({ error: 'Failed to get batch status' });
    }
};

/**
* Sync emails for OAuth accounts
*/

export const syncOAuthEmails = async (req: Request, res: Response) => {
    try {
        const { email, daysBack = 30, forceReindex = false } = req.body;

        console.log(`🔄 Starting OAuth email sync${email ? ` for ${email}` : ' for all accounts'}${forceReindex ? ' (force re-index)' : ''}...`);

        if (email) {
            const isValidConnection = await oauthService.hasValidOAuthConnection(email);
            if (!isValidConnection) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired OAuth connection',
                    message: `Please reconnect your Gmail account: ${email}`
                });
            }

            const scopeCheck = await oauthService.checkTokenScopes(email);

            const emails = await fetchGmailMessages(email, daysBack, 1000, forceReindex);
            res.json({
                success: true,
                message: `Successfully ${forceReindex ? 're-' : ''}synced ${emails.length} emails for ${email}`,
                syncedAccounts: [email],
                tokenInfo: {
                    hasFullAccess: scopeCheck.hasFullAccess,
                    scopes: scopeCheck.scopes,
                    recommendation: scopeCheck.hasFullAccess
                        ? "Token has full Gmail access"
                        : "Token has limited access - reconnect for full email content"
                }
            });
        } else {
            await syncAllOAuthAccounts(daysBack);
            res.json({
                success: true,
                message: 'Successfully synced emails for all OAuth accounts',
                syncedAccounts: []
            });
        }

    } catch (error) {
        console.error('OAuth email sync failed:', error);
        res.status(500).json({
            success: false,
            error: 'OAuth email sync failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const manageEmailIndex = async (req: Request, res: Response) => {
    try {
        const { action, email, daysBack = 30 } = req.body;

        if (!action || !email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: action and email'
            });
        }

        switch (action) {
            case 'delete':
                const deletedCount = await emailService.deleteEmailsByAccount(email);
                res.json({
                    success: true,
                    message: `Deleted ${deletedCount} emails for ${email}`,
                    count: deletedCount
                });
                break;

            case 'count':
                const emailCount = await emailService.getEmailCountByAccount(email);
                res.json({
                    success: true,
                    message: `Found ${emailCount} emails for ${email}`,
                    count: emailCount
                });
                break;

            case 'reindex':
                const deletedForReindex = await emailService.deleteEmailsByAccount(email);
                console.log(`🗑️ Deleted ${deletedForReindex} existing emails for ${email}`);

                const reindexedEmails = await fetchGmailMessages(email, daysBack, 100, true);
                res.json({
                    success: true,
                    message: `Re-indexed ${reindexedEmails.length} emails for ${email} (deleted ${deletedForReindex} old entries)`,
                    count: reindexedEmails.length
                });
                break;

            default:
                res.status(400).json({
                    success: false,
                    error: 'Invalid action. Use: delete, count, or reindex'
                });
        }

    } catch (error) {
        console.error('Email index management failed:', error);
        res.status(500).json({
            success: false,
            error: 'Email index management failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getIndexStats = async (req: Request, res: Response) => {
    try {
        const stats = await emailService.getAccountStats();
        res.json(stats);
    } catch (error) {
        console.error('Failed to get index stats:', error);
        res.status(500).json({
            error: 'Failed to get index stats',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};