#!/usr/bin/env node
/**
 * Email Reindex CLI Tool
 *
 * Rebuild Elasticsearch index from PostgreSQL (source of truth)
 *
 * Usage:
 *   npm run reindex -- --all                    # Reindex all emails
 *   npm run reindex -- --account user@email.com # Reindex specific account
 *   npm run reindex -- --delete-first           # Delete ES index before reindex
 */

import dotenv from 'dotenv';
dotenv.config();

import { emailRepository, emailSearchRepository, emailSyncQueue } from '../core/container';
import { EmailDocument } from '../types/email.types';

interface ReindexOptions {
    account?: string;
    deleteFirst?: boolean;
    batchSize?: number;
}

class ReindexCLI {
    /**
     * Reindex all emails or specific account
     */
    async reindex(options: ReindexOptions): Promise<void> {
        const { account, deleteFirst = false, batchSize = 100 } = options;

        console.log('🔄 Starting email reindex...');
        console.log(`📦 Options:`, {
            account: account || 'all',
            deleteFirst,
            batchSize
        });

        try {
            if (deleteFirst) {
                console.log('\n🗑️ Deleting existing Elasticsearch data...');
                if (account) {
                    await emailSearchRepository.deleteByAccount(account);
                    console.log(`✅ Deleted emails for account: ${account}`);
                } else {
                    // Delete and recreate index
                    await emailSearchRepository.deleteIndex();
                    await emailSearchRepository.createIndex();
                    console.log('✅ Recreated Elasticsearch index');
                }
            }

            console.log('\n📊 Fetching emails from PostgreSQL...');
            let emailIds: string[] = [];

            if (account) {
                const result = await emailRepository.search('', { account }, { page: 1, limit: 100000 });
                emailIds = result.emails.map(e => e.id);
                console.log(`✅ Found ${emailIds.length} emails for account: ${account}`);
            } else {
                const stats = await emailRepository.getAccountStats();
                console.log(`✅ Found ${stats.length} accounts`);

                for (const stat of stats) {
                    const result = await emailRepository.search('', { account: stat.account }, { page: 1, limit: 100000 });
                    const ids = result.emails.map(e => e.id);
                    emailIds.push(...ids);
                    console.log(`   - ${stat.account}: ${ids.length} emails`);
                }

                console.log(`✅ Total emails to reindex: ${emailIds.length}`);
            }

            if (emailIds.length === 0) {
                console.log('\n⚠️ No emails found to reindex');
                return;
            }

            console.log(`\n🔄 Queueing ${emailIds.length} emails for reindex...`);
            await emailSyncQueue.queueBulkSync(emailIds, batchSize);

            console.log('\n✅ Reindex jobs queued successfully!');
            console.log(`\n📊 Monitor progress at: http://localhost:8000/admin/queues`);

        } catch (error: any) {
            console.error('\n❌ Reindex failed:', error.message);
            throw error;
        }
    }

    /**
     * Get reindex stats
     */
    async getStats(): Promise<void> {
        console.log('📊 Fetching stats...\n');

        try {
            const pgStats = await emailRepository.getAccountStats();
            const esStats = await emailSearchRepository.getAccountStats().catch(() => []);

            console.log('PostgreSQL (Source of Truth):');
            console.table(pgStats);

            console.log('\nElasticsearch (Search Index):');
            console.table(esStats);

            console.log('\nComparison:');
            for (const pg of pgStats) {
                const es = esStats.find(e => e.account === pg.account);
                const esCount = es?.count || 0;
                const diff = pg.count - esCount;

                if (diff !== 0) {
                    console.log(`❌ ${pg.account}: ${diff} emails missing in Elasticsearch`);
                } else {
                    console.log(`✅ ${pg.account}: In sync`);
                }
            }

        } catch (error: any) {
            console.error('❌ Failed to get stats:', error.message);
        }
    }
}

function parseArgs(): ReindexOptions & { stats?: boolean; help?: boolean } {
    const args = process.argv.slice(2);
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--all':
                options.account = undefined;
                break;
            case '--account':
                options.account = args[++i];
                break;
            case '--delete-first':
            case '--delete':
                options.deleteFirst = true;
                break;
            case '--batch-size':
                options.batchSize = parseInt(args[++i]);
                break;
            case '--stats':
                options.stats = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
        }
    }

    return options;
}

function showHelp(): void {
    console.log(`
Email Reindex CLI Tool

Usage:
  npm run reindex -- [options]

Options:
  --all                 Reindex all emails from all accounts
  --account <email>     Reindex specific account only
  --delete-first        Delete existing Elasticsearch data before reindex
  --batch-size <n>      Batch size for bulk operations (default: 100)
  --stats               Show sync statistics
  --help, -h            Show this help message

Examples:
  npm run reindex -- --all
  npm run reindex -- --account user@example.com
  npm run reindex -- --account user@example.com --delete-first
  npm run reindex -- --stats
  npm run reindex -- --all --batch-size 500

Notes:
  - PostgreSQL is the source of truth
  - Reindexing queues jobs for background processing
  - Monitor progress at: http://localhost:8000/admin/queues
  - Safe to run multiple times (idempotent)
`);
}

async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    const cli = new ReindexCLI();

    if (options.stats) {
        await cli.getStats();
    } else {
        await cli.reindex(options);
    }

    // time for queue to initialize before exiting
    setTimeout(() => {
        console.log('\n👋 Reindex CLI completed');
        process.exit(0);
    }, 2000);
}

main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
