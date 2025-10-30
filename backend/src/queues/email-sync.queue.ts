/**
 * Email Sync Queue Service
 *
 * Manages async syncing of emails from PostgreSQL to Elasticsearch
 */

import Queue, { Job, DoneCallback } from 'bull';
import {
    createQueue,
    QueueName,
    JobName,
    SyncEmailJobData,
    SyncBulkEmailsJobData,
    JobPriority,
    QueueMetrics
} from './queue.config';
import { IEmailRepository } from '../repositories/interfaces/email.interface';
import { EmailDocument } from '../types/email.types';

export class EmailSyncQueue {
    private queue: Queue.Queue | null = null;
    private isProcessing: boolean = false;
    private isConnected: boolean = false;

    constructor(
        private postgresRepo: IEmailRepository,
        private elasticsearchRepo: IEmailRepository
    ) {
        try {
            this.queue = createQueue(QueueName.EMAIL_SYNC, {
                settings: {
                    lockDuration: 30000,
                    stalledInterval: 30000,
                    maxStalledCount: 2
                }
            });

            this.setupProcessors();
            this.setupEventListeners();

            this.queue.isReady().then(() => {
                this.isConnected = true;
                console.log('✅ Email sync queue connected to Redis');
            }).catch((err) => {
                console.warn('⚠️ Email sync queue failed to connect to Redis:', err.message);
                console.warn('⚠️ Queue operations will be disabled. Direct sync will be used as fallback.');
                this.isConnected = false;
                this.queue = null;
            });
        } catch (error: any) {
            console.warn('⚠️ Failed to create email sync queue:', error.message);
            console.warn('⚠️ Queue operations will be disabled. Direct sync will be used as fallback.');
            this.queue = null;
            this.isConnected = false;
        }
    }

    /**
     * Setup job processors
     */
    private setupProcessors(): void {
        if (!this.queue) return;

        const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5');

        this.queue.process(
            JobName.SYNC_EMAIL,
            concurrency,
            this.processSyncEmail.bind(this)
        );

        this.queue.process(
            JobName.SYNC_BULK_EMAILS,
            1, // Only 1 bulk job at a time to avoid overload, untill testing
            this.processSyncBulkEmails.bind(this)
        );

        this.isProcessing = true;
        console.log(`✅ Email sync queue processors started (concurrency: ${concurrency})`);
    }

    /**
     * Process single email sync job
     */
    private async processSyncEmail(job: Job<SyncEmailJobData>): Promise<void> {
        const { emailId } = job.data;

        try {
            await job.progress(10);

            const email = await this.postgresRepo.getById(emailId);

            await job.progress(50);

            await this.elasticsearchRepo.bulkIndex([email], true);

            await job.progress(100);

            console.log(`✅ Synced email ${emailId} to Elasticsearch`);
        } catch (error: any) {
            console.error(`❌ Failed to sync email ${emailId}:`, error.message);
            throw error; 
        }
    }

    /**
     * Process bulk email sync job
     */
    private async processSyncBulkEmails(job: Job<SyncBulkEmailsJobData>): Promise<void> {
        const { emailIds, batchSize = 100 } = job.data;

        try {
            console.log(`📦 Starting bulk sync of ${emailIds.length} emails`);

            let synced = 0;
            const total = emailIds.length;

            for (let i = 0; i < emailIds.length; i += batchSize) {
                const batch = emailIds.slice(i, i + batchSize);

                const emails = await this.postgresRepo.getByIds(batch);

                await this.elasticsearchRepo.bulkIndex(emails, true);

                synced += batch.length;
                await job.progress((synced / total) * 100);

                console.log(`📦 Synced ${synced}/${total} emails`);
            }

            console.log(`✅ Bulk sync completed: ${synced} emails`);
        } catch (error: any) {
            console.error(`❌ Bulk sync failed:`, error.message);
            throw error;
        }
    }

    /**
     * Setup event listeners for monitoring
     */
    private setupEventListeners(): void {
        if (!this.queue) return;

        this.queue.on('completed', (job: Job, result: any) => {
            console.log(`✅ Job ${job.id} completed`);
        });

        this.queue.on('failed', (job: Job, err: Error) => {
            console.error(`❌ Job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);
        });

        this.queue.on('stalled', (job: Job) => {
            console.warn(`⚠️ Job ${job.id} stalled`);
        });

        this.queue.on('error', (error: Error) => {
            console.error('❌ Queue error:', error);
        });

        this.queue.on('waiting', (jobId: string) => {
            console.log(`⏳ Job ${jobId} waiting to be processed`);
        });

        this.queue.on('active', (job: Job) => {
            console.log(`🔄 Processing job ${job.id}: ${job.name}`);
        });
    }

    /**
     * Add single email sync job to queue
     */
    async queueEmailSync(
        emailId: string,
        priority: JobPriority = JobPriority.NORMAL
    ): Promise<Queue.Job<SyncEmailJobData> | null> {
        if (!this.queue || !this.isConnected) {
            throw new Error('Queue not available');
        }

        const job = await this.queue.add(
            JobName.SYNC_EMAIL,
            { emailId, priority },
            {
                priority,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            }
        );

        console.log(`📤 Queued email sync job ${job.id} for email ${emailId}`);
        return job;
    }

    /**
     * Add bulk email sync job to queue
     */
    async queueBulkSync(
        emailIds: string[],
        batchSize: number = 100
    ): Promise<Queue.Job<SyncBulkEmailsJobData> | null> {
        if (!this.queue || !this.isConnected) {
            throw new Error('Queue not available');
        }

        const job = await this.queue.add(
            JobName.SYNC_BULK_EMAILS,
            { emailIds, batchSize },
            {
                priority: JobPriority.LOW, // Lower priority for bulk operations
                attempts: 3,
                timeout: 600000 // 10 minutes timeout for bulk operations
            }
        );

        console.log(`📤 Queued bulk sync job ${job.id} for ${emailIds.length} emails`);
        return job;
    }

    /**
     * Get queue metrics
     */
    async getMetrics(): Promise<QueueMetrics> {
        if (!this.queue || !this.isConnected) {
            return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 };
        }

        const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount(),
            this.queue.getPausedCount()
        ]);

        return { waiting, active, completed, failed, delayed, paused };
    }

    /**
     * Get failed jobs
     */
    async getFailedJobs(): Promise<Job[]> {
        if (!this.queue || !this.isConnected) return [];
        return await this.queue.getFailed();
    }

    /**
     * Retry all failed jobs
     */
    async retryFailedJobs(): Promise<number> {
        if (!this.queue || !this.isConnected) return 0;

        const failedJobs = await this.queue.getFailed();
        let retried = 0;

        for (const job of failedJobs) {
            try {
                await job.retry();
                retried++;
            } catch (error) {
                console.error(`Failed to retry job ${job.id}:`, error);
            }
        }

        console.log(`🔄 Retried ${retried} failed jobs`);
        return retried;
    }

    /**
     * Clear completed jobs
     */
    async clearCompleted(): Promise<void> {
        if (!this.queue || !this.isConnected) return;
        await this.queue.clean(0, 'completed');
        console.log('🧹 Cleared completed jobs');
    }

    /**
     * Clear failed jobs
     */
    async clearFailed(): Promise<void> {
        if (!this.queue || !this.isConnected) return;
        await this.queue.clean(0, 'failed');
        console.log('🧹 Cleared failed jobs');
    }

    /**
     * Pause queue
     */
    async pause(): Promise<void> {
        if (!this.queue || !this.isConnected) return;
        await this.queue.pause();
        console.log('⏸️ Queue paused');
    }

    /**
     * Resume queue
     */
    async resume(): Promise<void> {
        if (!this.queue || !this.isConnected) return;
        await this.queue.resume();
        console.log('▶️ Queue resumed');
    }

    /**
     * Get queue instance (for Bull Board)
     */
    getQueue(): Queue.Queue | null {
        return this.queue;
    }

    /**
     * Gracefully close queue
     */
    async close(): Promise<void> {
        if (this.isProcessing && this.queue) {
            await this.queue.close();
            this.isProcessing = false;
            console.log('👋 Email sync queue closed');
        }
    }

    /**
     * Check if queue is available and connected
     */
    isAvailable(): boolean {
        return this.isConnected && this.queue !== null;
    }
}
