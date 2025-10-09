import { OAuthTokenDocument } from '../../types/auth.types';

/**
 * OAuth Repository Interface
 *
 * Manages OAuth tokens (encrypted storage)
 */
export interface IOAuthRepository {
    /**
     * Store OAuth tokens
     */
    storeTokens(tokenDoc: OAuthTokenDocument): Promise<void>;

    /**
     * Get OAuth tokens by email
     */
    getTokens(email: string): Promise<OAuthTokenDocument | null>;

    /**
     * Update OAuth tokens
     */
    updateTokens(email: string, updates: Partial<OAuthTokenDocument>): Promise<void>;

    /**
     * Delete OAuth tokens
     */
    deleteTokens(email: string): Promise<void>;

    /**
     * Create the OAuth tokens index/table
     */
    createIndex(): Promise<void>;
}
