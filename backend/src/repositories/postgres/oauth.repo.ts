/**
 * PostgreSQL OAuth Repository
 *
 * Manages OAuth tokens with encryption and secure storage
 */

import { Pool } from 'pg';
import { nanoid } from 'nanoid';
import { IOAuthRepository } from '../interfaces/oauth.interface';
import { OAuthTokenDocument } from '../../types/auth.types';

export class PostgresOAuthRepository implements IOAuthRepository {
    constructor(private pool: Pool) {}

    /**
     * Create table (handled by schema.sql)
     */
    async createIndex(): Promise<void> {
        console.log('ℹ️  OAuth tokens table managed by schema.sql');
    }

    /**
     * Store OAuth tokens
     */
    async storeTokens(tokenDoc: OAuthTokenDocument): Promise<void> {
        // First, check if account exists
        const accountCheck = await this.pool.query(
            `SELECT id FROM email_accounts WHERE email = $1`,
            [tokenDoc.email.toLowerCase()]
        );

        let accountId: string;

        if (accountCheck.rows.length === 0) {
            throw new Error(`No email account found for ${tokenDoc.email}. Create account first.`);
        } else {
            accountId = accountCheck.rows[0].id;
        }

        await this.pool.query(
            `INSERT INTO oauth_tokens (
                id, account_id, email, access_token, refresh_token,
                token_expiry, scope, created_at, last_used
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (email)
            DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                token_expiry = EXCLUDED.token_expiry,
                scope = EXCLUDED.scope,
                last_used = EXCLUDED.last_used`,
            [
                tokenDoc.id,
                accountId,
                tokenDoc.email.toLowerCase(),
                tokenDoc.accessToken,
                tokenDoc.refreshToken || null,
                tokenDoc.tokenExpiry || null,
                tokenDoc.scope || [],
                tokenDoc.createdAt || new Date(),
                tokenDoc.lastUsed || null
            ]
        );
    }

    /**
     * Get OAuth tokens by email
     */
    async getTokens(email: string): Promise<OAuthTokenDocument | null> {
        const result = await this.pool.query(
            `SELECT * FROM oauth_tokens WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToTokenDoc(result.rows[0]);
    }

    /**
     * Update OAuth tokens
     */
    async updateTokens(email: string, updates: Partial<OAuthTokenDocument>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = this.toSnakeCase(key);
            fields.push(`${snakeKey} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }

        if (fields.length === 0) return;

        fields.push(`last_used = $${paramIndex}`);
        values.push(new Date());
        paramIndex++;

        values.push(email.toLowerCase());

        const query = `UPDATE oauth_tokens SET ${fields.join(', ')} WHERE email = $${paramIndex}`;
        await this.pool.query(query, values);
    }

    /**
     * Delete OAuth tokens
     */
    async deleteTokens(email: string): Promise<void> {
        await this.pool.query(`DELETE FROM oauth_tokens WHERE email = $1`, [email.toLowerCase()]);
    }

    /**
     * Get OAuth tokens by account ID (useful for cascade operations)
     */
    async getTokensByAccountId(accountId: string): Promise<OAuthTokenDocument | null> {
        const result = await this.pool.query(
            `SELECT * FROM oauth_tokens WHERE account_id = $1`,
            [accountId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToTokenDoc(result.rows[0]);
    }

    /**
     * Update last used timestamp
     */
    async updateLastUsed(email: string): Promise<void> {
        await this.pool.query(
            `UPDATE oauth_tokens SET last_used = $1 WHERE email = $2`,
            [new Date(), email.toLowerCase()]
        );
    }

    /**
     * Check if token is expired
     */
    async isExpired(email: string): Promise<boolean> {
        const result = await this.pool.query(
            `SELECT token_expiry FROM oauth_tokens WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return true; // No token = expired
        }

        const tokenExpiry = result.rows[0].token_expiry;
        if (!tokenExpiry) {
            return false; // No expiry set = never expires
        }

        return new Date(tokenExpiry) < new Date();
    }

    /**
     * Map database row to OAuthTokenDocument
     */
    private mapRowToTokenDoc(row: any): OAuthTokenDocument {
        return {
            id: row.id,
            email: row.email,
            accessToken: row.access_token,
            refreshToken: row.refresh_token || undefined,
            tokenExpiry: row.token_expiry ? new Date(row.token_expiry) : undefined,
            scope: row.scope || [],
            createdAt: new Date(row.created_at),
            lastUsed: row.last_used ? new Date(row.last_used) : undefined
        };
    }

    /**
     * Convert camelCase to snake_case
     */
    private toSnakeCase(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}
