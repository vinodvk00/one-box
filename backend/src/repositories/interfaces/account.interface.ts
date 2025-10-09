import { AccountConfigDocument } from '../../types/auth.types';

/**
 * Account Repository Interface
 *
 * Manages email account configurations (IMAP/OAuth accounts)
 */
export interface IAccountRepository {
    /**
     * Store account configuration
     */
    store(configDoc: AccountConfigDocument): Promise<void>;

    /**
     * Get account config by email
     */
    getByEmail(email: string): Promise<AccountConfigDocument | null>;

    /**
     * Get account config by ID
     */
    getById(accountId: string): Promise<AccountConfigDocument | null>;

    /**
     * Get all account configs
     */
    getAll(): Promise<AccountConfigDocument[]>;

    /**
     * Get active account configs
     */
    getActive(): Promise<AccountConfigDocument[]>;

    /**
     * Get account configs by user ID
     */
    getByUserId(userId: string): Promise<AccountConfigDocument[]>;

    /**
     * Update account config by email
     */
    updateByEmail(email: string, updates: Partial<AccountConfigDocument>): Promise<void>;

    /**
     * Update account config by ID
     */
    updateById(accountId: string, updates: Partial<AccountConfigDocument>): Promise<void>;

    /**
     * Update multiple account configs by user ID
     */
    updateByUserId(userId: string, updates: Partial<AccountConfigDocument>): Promise<void>;

    /**
     * Delete account config by email
     */
    deleteByEmail(email: string): Promise<void>;

    /**
     * Delete account config by ID
     */
    deleteById(accountId: string): Promise<void>;

    /**
     * Create the account configs index/table
     */
    createIndex(): Promise<void>;
}
