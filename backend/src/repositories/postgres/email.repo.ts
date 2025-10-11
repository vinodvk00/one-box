/**
 * PostgreSQL Email Repository
 *
 * Manages email storage with PostgreSQL as source of truth
 * Note: Search functionality delegated to Elasticsearch
 */

import { Pool } from 'pg';
import { IEmailRepository } from '../interfaces/email.interface';
import { EmailDocument, SearchFilters } from '../../types/email.types';

export class PostgresEmailRepository implements IEmailRepository {
    constructor(private pool: Pool) {}

    /**
     * Create table (handled by schema.sql)
     */
    async createIndex(): Promise<void> {
        console.log('ℹ️  Emails table managed by schema.sql');
    }

    /**
     * Check if email exists
     */
    async exists(emailId: string): Promise<boolean> {
        const result = await this.pool.query(
            `SELECT EXISTS(SELECT 1 FROM emails WHERE id = $1)`,
            [emailId]
        );
        return result.rows[0].exists;
    }

    /**
     * Index a single email
     */
    async index(email: EmailDocument): Promise<void> {
        await this.bulkIndex([email]);
    }

    /**
     * Bulk index emails with duplicate prevention
     */
    async bulkIndex(emails: EmailDocument[]): Promise<{ indexed: number; skipped: number }> {
        if (emails.length === 0) return { indexed: 0, skipped: 0 };

        const client = await this.pool.connect();
        let indexed = 0;
        let skipped = 0;

        try {
            await client.query('BEGIN');

            for (const email of emails) {
                try {
                    // Insert email with ON CONFLICT DO NOTHING (duplicate prevention)
                    const result = await client.query(
                        `INSERT INTO emails (
                            id, account_id, folder, uid, subject,
                            from_name, from_address, date, body,
                            text_body, html_body, flags, category, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                        ON CONFLICT (account_id, uid) DO NOTHING`,
                        [
                            email.id,
                            email.account,
                            email.folder,
                            email.uid,
                            email.subject,
                            email.from.name,
                            email.from.address,
                            email.date,
                            email.body,
                            email.textBody || null,
                            email.htmlBody || null,
                            email.flags || [],
                            email.category || null,
                            new Date()
                        ]
                    );

                    if (result.rowCount && result.rowCount > 0) {
                        // Insert recipients
                        if (email.to && email.to.length > 0) {
                            for (const recipient of email.to) {
                                await client.query(
                                    `INSERT INTO email_recipients (email_id, recipient_type, name, address, created_at)
                                    VALUES ($1, $2, $3, $4, $5)`,
                                    [email.id, 'to', recipient.name, recipient.address, new Date()]
                                );
                            }
                        }
                        indexed++;
                    } else {
                        skipped++;
                    }
                } catch (error: any) {
                    // Skip duplicate emails
                    if (error.code === '23505') { // unique_violation
                        skipped++;
                    } else {
                        throw error;
                    }
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        return { indexed, skipped };
    }

    /**
     * Get email by ID
     */
    async getById(emailId: string): Promise<EmailDocument> {
        const result = await this.pool.query(
            `SELECT e.*,
                json_agg(
                    json_build_object('name', er.name, 'address', er.address)
                ) FILTER (WHERE er.recipient_type = 'to') as recipients
            FROM emails e
            LEFT JOIN email_recipients er ON er.email_id = e.id
            WHERE e.id = $1
            GROUP BY e.id`,
            [emailId]
        );

        if (result.rows.length === 0) {
            throw new Error(`Email ${emailId} not found`);
        }

        return this.mapRowToEmail(result.rows[0]);
    }

    /**
     * Get multiple emails by IDs
     */
    async getByIds(emailIds: string[]): Promise<EmailDocument[]> {
        if (emailIds.length === 0) return [];

        const result = await this.pool.query(
            `SELECT e.*,
                json_agg(
                    json_build_object('name', er.name, 'address', er.address)
                ) FILTER (WHERE er.recipient_type = 'to') as recipients
            FROM emails e
            LEFT JOIN email_recipients er ON er.email_id = e.id
            WHERE e.id = ANY($1)
            GROUP BY e.id`,
            [emailIds]
        );

        return result.rows.map(row => this.mapRowToEmail(row));
    }

    /**
     * Update email category
     */
    async updateCategory(emailId: string, category: string): Promise<void> {
        await this.pool.query(
            `UPDATE emails SET category = $1 WHERE id = $2`,
            [category, emailId]
        );
    }

    /**
     * Bulk update email categories
     */
    async bulkUpdateCategories(updates: Array<{ id: string; category: string }>): Promise<void> {
        if (updates.length === 0) return;

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (const { id, category } of updates) {
                await client.query(
                    `UPDATE emails SET category = $1 WHERE id = $2`,
                    [category, id]
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Search emails (basic SQL search - using Elasticsearch for full-text)
     */
    async search(
        query: string,
        filters?: SearchFilters,
        pagination?: { page: number; limit: number }
    ): Promise<{
        emails: EmailDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (query) {
            conditions.push(`(
                subject ILIKE $${paramIndex} OR
                body ILIKE $${paramIndex} OR
                from_name ILIKE $${paramIndex} OR
                from_address ILIKE $${paramIndex}
            )`);
            params.push(`%${query}%`);
            paramIndex++;
        }

        if (filters?.account) {
            conditions.push(`account_id = $${paramIndex}`);
            params.push(filters.account);
            paramIndex++;
        }

        if (filters?.folder) {
            conditions.push(`folder = $${paramIndex}`);
            params.push(filters.folder);
            paramIndex++;
        }

        if (filters?.category) {
            conditions.push(`category = $${paramIndex}`);
            params.push(filters.category);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM emails ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        const offset = (page - 1) * limit;

        const result = await this.pool.query(
            `SELECT e.*,
                json_agg(
                    json_build_object('name', er.name, 'address', er.address)
                ) FILTER (WHERE er.recipient_type = 'to') as recipients
            FROM emails e
            LEFT JOIN email_recipients er ON er.email_id = e.id
            ${whereClause}
            GROUP BY e.id
            ORDER BY e.date DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            emails: result.rows.map(row => this.mapRowToEmail(row)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }

    /**
     * Get uncategorized email IDs
     */
    async getUncategorizedIds(): Promise<string[]> {
        const result = await this.pool.query(
            `SELECT id FROM emails WHERE category IS NULL ORDER BY date ASC LIMIT 10000`
        );
        return result.rows.map(row => row.id);
    }

    /**
     * Get uncategorized emails
     */
    async getUncategorized(): Promise<EmailDocument[]> {
        const result = await this.pool.query(
            `SELECT e.*,
                json_agg(
                    json_build_object('name', er.name, 'address', er.address)
                ) FILTER (WHERE er.recipient_type = 'to') as recipients
            FROM emails e
            LEFT JOIN email_recipients er ON er.email_id = e.id
            WHERE e.category IS NULL
            GROUP BY e.id
            ORDER BY e.date DESC
            LIMIT 100`
        );
        return result.rows.map(row => this.mapRowToEmail(row));
    }

    /**
     * Get category statistics
     */
    async getCategoryStats(): Promise<Array<{ category: string; count: number }>> {
        const result = await this.pool.query(
            `SELECT
                COALESCE(category, 'uncategorized') as category,
                COUNT(*) as count
            FROM emails
            GROUP BY category
            ORDER BY count DESC`
        );

        return result.rows.map(row => ({
            category: row.category,
            count: parseInt(row.count)
        }));
    }

    /**
     * Get account statistics
     */
    async getAccountStats(): Promise<Array<{ account: string; count: number }>> {
        const result = await this.pool.query(
            `SELECT
                account_id as account,
                COUNT(*) as count
            FROM emails
            GROUP BY account_id
            ORDER BY count DESC`
        );

        return result.rows.map(row => ({
            account: row.account,
            count: parseInt(row.count)
        }));
    }

    /**
     * Get email count by account (accepts account ID or email address)
     */
    async getCountByAccount(account: string): Promise<number> {
        // First, try to find the account by email address
        const accountLookup = await this.pool.query(
            `SELECT id FROM email_accounts WHERE email = $1`,
            [account]
        );

        let accountId = account;
        if (accountLookup.rows.length > 0) {
            accountId = accountLookup.rows[0].id;
        }

        const result = await this.pool.query(
            `SELECT COUNT(*) FROM emails WHERE account_id = $1`,
            [accountId]
        );
        return parseInt(result.rows[0].count);
    }

    /**
     * Delete emails by account (accepts account ID or email address)
     */
    async deleteByAccount(account: string): Promise<number> {
        const accountLookup = await this.pool.query(
            `SELECT id FROM email_accounts WHERE email = $1`,
            [account]
        );

        let accountId = account;
        if (accountLookup.rows.length > 0) {
            accountId = accountLookup.rows[0].id;
        }

        const result = await this.pool.query(
            `DELETE FROM emails WHERE account_id = $1`,
            [accountId]
        );
        return result.rowCount || 0;
    }

    /**
     * Map database row to EmailDocument
     */
    private mapRowToEmail(row: any): EmailDocument {
        return {
            id: row.id,
            account: row.account_id,
            folder: row.folder,
            subject: row.subject,
            from: {
                name: row.from_name,
                address: row.from_address
            },
            to: row.recipients || [],
            date: new Date(row.date),
            body: row.body,
            textBody: row.text_body || undefined,
            htmlBody: row.html_body || undefined,
            flags: row.flags || [],
            category: row.category || undefined,
            uid: row.uid
        };
    }
}
