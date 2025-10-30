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
        const userAccountIds = (req as any).userAccountIds || [];

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;

        const result = await emailService.searchEmails(
            q as string,
            {
                account: account as string,
                folder: folder as string,
                category: category as string,
                userAccountIds
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
        const userAccountIds = (req as any).userAccountIds || [];

        // Parse pagination parameters with defaults
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;

        const result = await emailService.searchEmails('', {
            account: account as string,
            folder: folder as string,
            category: category as string,
            userAccountIds
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
        const userAccountIds = (req as any).userAccountIds || [];
        const email = await emailService.getEmailById(req.params.id, userAccountIds);
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
        const userAccountIds = (req as any).userAccountIds || [];
        const emails = await emailService.getUncategorizedEmails(userAccountIds);
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
        const userAccountIds = (req as any).userAccountIds || [];
        const result = await emailService.categorizeEmailById(req.params.id, userAccountIds);
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
        const userAccountIds = (req as any).userAccountIds || [];
        const stats = await emailService.getCategoryStats(userAccountIds);
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
        const userId = (req as any).userId;
        const userAccountIds = (req as any).userAccountIds || [];

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (isBatchCategorizationRunning(userId)) {
            res.json({
                status: 'already_running',
                message: 'Batch categorization is already in progress for your account'
            });
        } else {
            startBatchCategorizationService(userId, userAccountIds).catch(err => {
                console.error(`[User ${userId}] Batch categorization error:`, err);
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
        const userId = (req as any).userId;
        const userAccountIds = (req as any).userAccountIds || [];

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const isRunning = isBatchCategorizationRunning(userId);
        const uncategorizedEmails = await emailService.getUncategorizedEmails(userAccountIds);

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
        const userId = (req as any).userId;
        const userAccountEmails = (req as any).userAccountEmails || [];

        console.log(`🔄 Starting OAuth email sync${email ? ` for ${email}` : ' for user accounts'}${forceReindex ? ' (force re-index)' : ''}...`);

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
            const syncedAccounts: string[] = [];
            for (const userEmail of userAccountEmails) {
                try {
                    const isValidConnection = await oauthService.hasValidOAuthConnection(userEmail);
                    if (isValidConnection) {
                        await fetchGmailMessages(userEmail, daysBack, 1000, forceReindex);
                        syncedAccounts.push(userEmail);
                        console.log(`✅ Synced ${userEmail}`);
                    }
                } catch (error) {
                    console.error(`❌ Failed to sync ${userEmail}:`, error);
                }
            }

            res.json({
                success: true,
                message: `Successfully synced emails for ${syncedAccounts.length} of your OAuth accounts`,
                syncedAccounts
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
        const userAccountIds = (req as any).userAccountIds || [];
        const userAccountEmails = (req as any).userAccountEmails || [];

        if (!action || !email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: action and email'
            });
        }

        if (!userAccountEmails.includes(email)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: `You do not have access to the email account: ${email}`
            });
        }

        const { accountRepository } = await import('../core/container');
        const userAccounts = await accountRepository.getByUserId((req as any).userId);
        const targetAccount = userAccounts.find((acc: any) => acc.email === email);
        const accountId = targetAccount?.id || email;

        switch (action) {
            case 'delete':
                // Pass userAccountIds for defense-in-depth at repository level
                const deletedCount = await emailService.deleteEmailsByAccount(accountId, userAccountIds);
                res.json({
                    success: true,
                    message: `Deleted ${deletedCount} emails for ${email}`,
                    count: deletedCount
                });
                break;

            case 'count':
                const emailCount = await emailService.getEmailCountByAccount(accountId, userAccountIds);
                res.json({
                    success: true,
                    message: `Found ${emailCount} emails for ${email}`,
                    count: emailCount
                });
                break;

            case 'reindex':
                const deletedForReindex = await emailService.deleteEmailsByAccount(accountId, userAccountIds);
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
        const userAccountIds = (req as any).userAccountIds || [];
        const stats = await emailService.getAccountStats(userAccountIds);
        res.json(stats);
    } catch (error) {
        console.error('Failed to get index stats:', error);
        res.status(500).json({
            error: 'Failed to get index stats',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Manually sync PostgreSQL to Elasticsearch
 * Fixes sync issues by re-syncing all user's emails
 */
export const syncToElasticsearch = async (req: Request, res: Response) => {
    try {
        const userAccountIds = (req as any).userAccountIds || [];
        const userId = (req as any).userId;

        if (!userId || userAccountIds.length === 0) {
            return res.status(400).json({
                error: 'No email accounts found',
                message: 'Please connect an email account first'
            });
        }

        console.log(`[User ${userId}] Starting manual sync to Elasticsearch for ${userAccountIds.length} accounts...`);

        const result = await emailService.searchEmails('', {
            userAccountIds
        }, {
            page: 1,
            limit: 10000 
        });

        const { indexed, skipped } = await emailService.bulkSyncToElasticsearch(result.emails);

        console.log(`[User ${userId}] Sync complete: ${indexed} indexed, ${skipped} skipped`);

        res.json({
            success: true,
            message: `Successfully synced ${indexed} emails to search index`,
            indexed,
            skipped,
            total: result.total
        });
    } catch (error) {
        console.error('Failed to sync to Elasticsearch:', error);
        res.status(500).json({
            error: 'Sync failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};