import { dbPool } from './pool';
import fs from 'fs';
import path from 'path';

export class DatabaseInitializer {
    /**
     * Initialize database schema
     */
    async initialize(): Promise<void> {
        try {
            console.log('🚀 Initializing PostgreSQL database...');

            const isConnected = await dbPool.testConnection();
            if (!isConnected) {
                throw new Error('Failed to connect to PostgreSQL');
            }

            await this.runSchema();

            console.log('✅ Database initialization complete!');
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * Run schema.sql file
     */
    private async runSchema(): Promise<void> {
        try {
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

            console.log('📝 Running schema.sql...');
            await dbPool.query(schemaSql);
            console.log('✅ Schema created successfully');
        } catch (error: any) {
            // Ignore "already exists" errors
            if (error.code === '42P07' || error.message?.includes('already exists')) {
                console.log('ℹ️  Schema already exists, skipping...');
                return;
            }
            throw error;
        }
    }

    /**
     * Drop all tables (DANGEROUS - using only in development)
     * TODO: remove this method in production
     */
    async dropAll(): Promise<void> {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Cannot drop tables in production!');
        }

        console.log('⚠️  Dropping all tables...');

        await dbPool.query(`
            DROP TABLE IF EXISTS email_recipients CASCADE;
            DROP TABLE IF EXISTS emails CASCADE;
            DROP TABLE IF EXISTS oauth_tokens CASCADE;
            DROP TABLE IF EXISTS email_accounts CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP VIEW IF EXISTS user_accounts_summary CASCADE;
            DROP VIEW IF EXISTS email_stats_by_account CASCADE;
            DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
        `);

        console.log('✅ All tables dropped');
    }

    /**
     * Reset database (drop and recreate)
     */
    async reset(): Promise<void> {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Cannot reset database in production!');
        }

        await this.dropAll();
        await this.initialize();
    }

    /**
     * Seed initial data (for testing)
     */
    async seed(): Promise<void> { }
}

// Singleton instance
export const dbInitializer = new DatabaseInitializer();
