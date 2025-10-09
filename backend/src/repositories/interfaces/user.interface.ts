import { User, CreateUserInput, UserDocument } from '../../types/user.types';

/**
 * User Repository Interface
 *
 * This interface defines the contract for user data access.
 */
export interface IUserRepository {
    /**
     * Create a new user
     */
    create(input: CreateUserInput): Promise<User>;

    /**
     * Find user by ID
     */
    findById(userId: string): Promise<User | null>;

    /**
     * Find user by email
     */
    findByEmail(email: string): Promise<User | null>;

    /**
     * Update user data
     */
    update(userId: string, updates: Partial<UserDocument>): Promise<void>;

    /**
     * Delete user
     */
    delete(userId: string): Promise<void>;

    /**
     * Check if user exists by email
     */
    existsByEmail(email: string): Promise<boolean>;

    /**
     * Update last login timestamp
     */
    updateLastLogin(userId: string): Promise<void>;

    /**
     * Get all users (admin only)
     */
    getAll(limit?: number): Promise<User[]>;

    /**
     * Create the users index/table (for initialization)
     */
    createIndex(): Promise<void>;
}
