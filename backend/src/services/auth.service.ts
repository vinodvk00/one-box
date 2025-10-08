import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail, userExistsByEmail } from './user.service';
import { CreateUserInput, User, LoginInput } from '../types/user.types';

const BCRYPT_ROUNDS = 10;

/**
 * Password validation regex
 * Requires:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validation errors
 */
export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

/**
 * Validate email format
 */
export const validateEmail = (email: string): void => {
    if (!email || !email.trim()) {
        throw new ValidationError('Email is required');
    }

    if (!EMAIL_REGEX.test(email)) {
        throw new ValidationError('Invalid email format');
    }
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): void => {
    if (!password || !password.trim()) {
        throw new ValidationError('Password is required');
    }

    if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
    }

    if (!PASSWORD_REGEX.test(password)) {
        throw new ValidationError(
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
        );
    }
};

/**
 * Validate name
 */
export const validateName = (name: string): void => {
    if (!name || !name.trim()) {
        throw new ValidationError('Name is required');
    }

    if (name.trim().length < 2) {
        throw new ValidationError('Name must be at least 2 characters long');
    }

    if (name.trim().length > 100) {
        throw new ValidationError('Name must not exceed 100 characters');
    }
};

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

/**
 * Verify a password against a hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    return await bcrypt.compare(password, hash);
};

/**
 * Register a new user with email/password
 */
export const registerUser = async (input: CreateUserInput): Promise<User> => {
    validateEmail(input.email);
    validateName(input.name);

    if (input.authMethod === 'password' && !input.password) {
        throw new ValidationError('Password is required for password-based registration');
    }

    if (input.authMethod === 'password' && input.password) {
        validatePassword(input.password);
    }

    const existingUser = await userExistsByEmail(input.email.toLowerCase());
    if (existingUser) {
        throw new ValidationError('User with this email already exists');
    }

    let hashedPassword: string | undefined = undefined;
    if (input.password) {
        hashedPassword = await hashPassword(input.password);
    }

    const user = await createUser({
        ...input,
        email: input.email.toLowerCase(),
        password: hashedPassword
    });

    return user;
};

/**
 * Login user with email/password
 */
export const loginUser = async (input: LoginInput): Promise<User> => {
    validateEmail(input.email);

    if (!input.password || !input.password.trim()) {
        throw new ValidationError('Password is required');
    }

    const user = await findUserByEmail(input.email.toLowerCase());
    if (!user) {
        throw new AuthenticationError('Invalid email or password');
    }

    if (!user.isActive) {
        throw new AuthenticationError('Account is disabled');
    }

    if (!user.password) {
        throw new AuthenticationError('This account uses OAuth login. Please login with Google.');
    }

    const isValidPassword = await verifyPassword(input.password, user.password);
    if (!isValidPassword) {
        throw new AuthenticationError('Invalid email or password');
    }

    return user;
};

/**
 * Find or create user from OAuth data
 */
export const findOrCreateOAuthUser = async (data: {
    email: string;
    name: string;
    oauthProvider: string;
}): Promise<User> => {
    validateEmail(data.email);
    validateName(data.name);

    const existingUser = await findUserByEmail(data.email.toLowerCase());

    if (existingUser) {
        if (existingUser.authMethod === 'password') {
            throw new AuthenticationError(
                'An account with this email already exists. Please login with email/password.'
            );
        }
        return existingUser;
    }

    const user = await createUser({
        email: data.email.toLowerCase(),
        name: data.name,
        authMethod: 'oauth',
        oauthProvider: data.oauthProvider,
        password: undefined
    });

    return user;
};

/**
 * Validate change password input
 */
export const validateChangePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string
): Promise<void> => {
    if (!currentPassword || !currentPassword.trim()) {
        throw new ValidationError('Current password is required');
    }

    if (!newPassword || !newPassword.trim()) {
        throw new ValidationError('New password is required');
    }

    validatePassword(newPassword);

    if (currentPassword === newPassword) {
        throw new ValidationError('New password must be different from current password');
    }
};
