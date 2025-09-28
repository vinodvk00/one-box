import { Request, Response } from 'express';
import {
    searchEmails as searchEmailsService,
    getEmailById as getEmailByIdService,
    getCategoryStats as getCategoryStatsService,
    getUncategorizedEmails as getUncategorizedEmailsService,
    categorizeEmailById
} from '../services/elasticsearch.service';
import {
    startBatchCategorization as startBatchCategorizationService,
    isBatchCategorizationRunning
} from '../services/batch-categorization.service';

/**
 * Search and filter emails
 */
export const searchEmails = async (req: Request, res: Response) => {
    try {
        const { q, account, folder, category } = req.query;
        const emails = await searchEmailsService(
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
};

/**
 * Get all emails with optional filters
 */
export const getAllEmails = async (req: Request, res: Response) => {
    try {
        const { account, folder, category } = req.query;
        const emails = await searchEmailsService('', {
            account: account as string,
            folder: folder as string,
            category: category as string
        });
        res.json(emails);
    } catch (error) {
        console.error('Failed to fetch emails:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
};

/**
 * Get a single email by ID
 */
export const getEmailById = async (req: Request, res: Response) => {
    try {
        const email = await getEmailByIdService(req.params.id);
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
        const emails = await getUncategorizedEmailsService();
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
        const result = await categorizeEmailById(req.params.id);
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
        const stats = await getCategoryStatsService();
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
        const uncategorizedEmails = await getUncategorizedEmailsService();

        res.json({
            isRunning,
            uncategorizedCount: uncategorizedEmails.length
        });
    } catch (error) {
        console.error('Failed to get batch status:', error);
        res.status(500).json({ error: 'Failed to get batch status' });
    }
};