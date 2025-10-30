/**
 * Queue Configuration
 *
 * Centralized configuration for Redis Bull queues
 */

import Queue, { QueueOptions } from 'bull';

/**
 * Redis connection configuration
 */
export const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    // Retry strategy for Redis connection
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

/**
 * Default queue options
 */
export const defaultQueueOptions: QueueOptions = {
    redis: redisConfig,
    defaultJobOptions: {
        attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
        backoff: {
            type: 'exponential',
            delay: parseInt(process.env.QUEUE_RETRY_DELAY || '2000')
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500,     // Keep last 500 failed jobs for debugging
    },
    settings: {
        lockDuration: 30000,   // Lock jobs for 30 seconds
        stalledInterval: 30000, // Check for stalled jobs every 30s
        maxStalledCount: 2,     // Retry stalled jobs 2 times
    }
};

/**
 * Queue Names
 */
export enum QueueName {
    EMAIL_SYNC = 'email-sync',
    BULK_SYNC = 'bulk-sync',
    EMAIL_RECONCILIATION = 'email-reconciliation'
}

/**
 * Job Names
 */
export enum JobName {
    SYNC_EMAIL = 'sync-email',
    SYNC_BULK_EMAILS = 'sync-bulk-emails',
    RECONCILE_EMAILS = 'reconcile-emails',
    REINDEX_ALL = 'reindex-all'
}

/**
 * Job Data Types
 */
export interface SyncEmailJobData {
    emailId: string;
    priority?: number;
}

export interface SyncBulkEmailsJobData {
    emailIds: string[];
    batchSize?: number;
}

export interface ReconcileEmailsJobData {
    accountId?: string;
    daysBack?: number;
}

export interface ReindexAllJobData {
    accountId?: string;
    deleteExisting?: boolean;
}

/**
 * Job Priority Levels
 */
export enum JobPriority {
    LOW = 10,
    NORMAL = 5,
    HIGH = 1,
    URGENT = 0
}

/**
 * Create a queue with default configuration
 */
export function createQueue(name: QueueName, options?: Partial<QueueOptions>): Queue.Queue {
    return new Queue(name, {
        ...defaultQueueOptions,
        ...options
    });
}

/**
 * Queue Metrics Interface
 */
export interface QueueMetrics {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
}
