/**
 * Email Reconciliation Job
 *
 * Periodically checks for emails in PostgreSQL that are missing from Elasticsearch
 * and queues them for syncing
 * 
 * NOTE: for now its a workaround untill testing redis bull queue
 * TODO: add more realtime sync mechanism
 */

import { emailService, emailSyncQueue } from '../core/container';
import { emailRepository, emailSearchRepository } from '../core/container';

export class EmailReconciliationJob {
    private isRunning: boolean = false;
    private intervalId?: NodeJS.Timeout;

    /**
     * Start periodic reconciliation
     *
     * @param intervalMs - How often to run reconciliation (default: 5 minutes)
     */
    start(intervalMs: number = 300000): void {
        if (this.isRunning) {
            console.warn('⚠️ Reconciliation job already running');
            return;
        }

        console.log(`🔄 Starting email reconciliation job (interval: ${intervalMs / 1000}s)`);

        this.intervalId = setInterval(async () => {
            await this.reconcile();
        }, intervalMs);

        this.isRunning = true;
    }

    /**
     * Stop periodic reconciliation
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
            this.isRunning = false;
            console.log('⏹️ Email reconciliation job stopped');
        }
    }

    /**
     * Run reconciliation once
     */
    async reconcile(): Promise<{ missing: number; queued: number }> {
        if (this.isRunning && this.intervalId) {
            console.log('🔍 Running email reconciliation...');
        }

        try {
            const pgStats = await emailRepository.getAccountStats();
            const esStats = await emailSearchRepository.getAccountStats().catch(() => []);

            let totalMissing = 0;
            let totalQueued = 0;

            for (const pgAccount of pgStats) {
                const esAccount = esStats.find(es => es.account === pgAccount.account);
                const esCount = esAccount?.count || 0;

                if (pgAccount.count > esCount) {
                    const missing = pgAccount.count - esCount;
                    console.log(`📊 Account ${pgAccount.account}: ${missing} emails missing in Elasticsearch`);

                    const allEmailIds = await this.getEmailIdsByAccount(pgAccount.account);

                    const existingIds = await this.getElasticsearchIds(pgAccount.account);

                    const missingIds = allEmailIds.filter(id => !existingIds.includes(id));

                    if (missingIds.length > 0) {
                        await emailSyncQueue.queueBulkSync(missingIds);
                        totalMissing += missingIds.length;
                        totalQueued += missingIds.length;
                        console.log(`✅ Queued ${missingIds.length} missing emails for ${pgAccount.account}`);
                    }
                }
            }

            if (totalMissing === 0) {
                console.log('✅ All emails in sync between PostgreSQL and Elasticsearch');
            } else {
                console.log(`🔄 Reconciliation complete: ${totalQueued} emails queued for sync`);
            }

            return { missing: totalMissing, queued: totalQueued };
        } catch (error: any) {
            console.error('❌ Reconciliation failed:', error.message);
            return { missing: 0, queued: 0 };
        }
    }

    /**
     * Get all email IDs for an account from PostgreSQL
     */
    private async getEmailIdsByAccount(accountId: string): Promise<string[]> {
        const result = await emailRepository.search('', { account: accountId }, { page: 1, limit: 10000 });
        return result.emails.map(email => email.id);
    }

    /**
     * Get all email IDs for an account from Elasticsearch
     */
    private async getElasticsearchIds(accountId: string): Promise<string[]> {
        try {
            const result = await emailSearchRepository.search('', { account: accountId }, { page: 1, limit: 10000 });
            return result.emails.map(email => email.id);
        } catch (error) {
            console.warn('⚠️ Could not fetch Elasticsearch IDs, assuming none exist');
            return [];
        }
    }
}

export const reconciliationJob = new EmailReconciliationJob();

if (process.env.AUTO_START_RECONCILIATION === 'true') {
    const intervalMs = parseInt(process.env.RECONCILIATION_INTERVAL || '300000');
    reconciliationJob.start(intervalMs);
    console.log('✅ Auto-started reconciliation job');
}
