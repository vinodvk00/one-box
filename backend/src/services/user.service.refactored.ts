import { IUserRepository } from '../repositories/interfaces/user.interface';
import { User, CreateUserInput, UserResponse, toUserResponse } from '../types/user.types';

/**
 * User Service (Refactored with Dependency Injection)
 */
export class UserService {
    /**
     * Constructor - Dependency Injection
     * @param userRepo - User repository 
     */
    constructor(private userRepo: IUserRepository) {}

    /**
     * Create a new user
     */
    async createUser(input: CreateUserInput): Promise<User> {
        // Business logic stays here
        // Data access delegated to repository
        return await this.userRepo.create(input);
    }

    /**
     * Find user by email
     */
    async findUserByEmail(email: string): Promise<User | null> {
        return await this.userRepo.findByEmail(email);
    }

    /**
     * Find user by ID
     */
    async findUserById(userId: string): Promise<User | null> {
        return await this.userRepo.findById(userId);
    }

    /**
     * Update user
     */
    async updateUser(userId: string, updates: Partial<User>): Promise<void> {
        await this.userRepo.update(userId, updates);
    }

    /**
     * Delete user
     */
    async deleteUser(userId: string): Promise<void> {
        await this.userRepo.delete(userId);
    }

    /**
     * Check if user exists by email
     */
    async userExistsByEmail(email: string): Promise<boolean> {
        return await this.userRepo.existsByEmail(email);
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(userId: string): Promise<void> {
        await this.userRepo.updateLastLogin(userId);
    }

    /**
     * Get all users (admin only)
     */
    async getAllUsers(limit: number = 100): Promise<User[]> {
        return await this.userRepo.getAll(limit);
    }

    /**
     * Get user response (without password)
     */
    async getUserResponse(userId: string): Promise<UserResponse | null> {
        const user = await this.findUserById(userId);
        if (!user) return null;
        return toUserResponse(user);
    }
}
