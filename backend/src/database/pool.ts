/**
 * PostgreSQL Connection Pool
 *
 * Manages database connections using pg Pool.
 * Implements connection pooling for performance.
 */

import { Pool, PoolClient, QueryResult } from 'pg';

class DatabasePool {
    private pool: Pool | null = null;

    /**
     * Initialize connection pool
     */
    connect(): Pool {
        if (this.pool) {
            return this.pool;
        }

        this.pool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DB || 'onemail_db',
            user: process.env.POSTGRES_USER || 'onemail',
            password: process.env.POSTGRES_PASSWORD || 'onemail123',
            max: 20,
            idleTimeoutMillis: 30000, 
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('connect', () => {
            console.log('📦 PostgreSQL client connected');
        });

        this.pool.on('error', (err) => {
            console.error('❌ Unexpected error on idle PostgreSQL client', err);
            process.exit(-1);
        });

        return this.pool;
    }

    /**
     * Get pool instance
     */
    getPool(): Pool {
        if (!this.pool) {
            return this.connect();
        }
        return this.pool;
    }

    /**
     * Execute a query
     */
    async query(text: string, params?: any[]): Promise<QueryResult> {
        const pool = this.getPool();
        return pool.query(text, params);
    }

    /**
     * Get a client from the pool (for transactions)
     */
    async getClient(): Promise<PoolClient> {
        const pool = this.getPool();
        return pool.connect();
    }

    /**
     * Close all connections
     */
    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            console.log('✅ PostgreSQL pool closed');
            this.pool = null;
        }
    }

    /**
     * Test database connection
     */
    async testConnection(): Promise<boolean> {
        try {
            const result = await this.query('SELECT NOW()');
            console.log('✅ PostgreSQL connection successful:', result.rows[0].now);
            return true;
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error);
            return false;
        }
    }
}

export const dbPool = new DatabasePool();

export type { Pool, PoolClient, QueryResult };
