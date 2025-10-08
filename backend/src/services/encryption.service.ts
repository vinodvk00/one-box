import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

/**
 * Validate that encryption key is properly configured
 */
export const validateEncryptionKey = (): void => {
    if (!ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY is not set in environment variables');
    }

    if (ENCRYPTION_KEY.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }

    // Validate it's a valid hex string
    if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
        throw new Error('ENCRYPTION_KEY must be a valid hexadecimal string');
    }
};

/**
 * Encrypt text using AES-256-CBC
 */
export const encrypt = (text: string): string => {
    validateEncryptionKey();

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY!, 'hex'),
        iv
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted text
    return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt text encrypted with encrypt()
 */
export const decrypt = (text: string): string => {
    validateEncryptionKey();

    const parts = text.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY!, 'hex'),
        iv
    );

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

/**
 * Generate a random encryption key (for setup/initialization)
 * Returns a 64-character hex string (32 bytes)
 */
export const generateEncryptionKey = (): string => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a password using crypto (for simple hashing, bcrypt can be used for user passwords)
 */
export const hashText = (text: string): string => {
    return crypto.createHash('sha256').update(text).digest('hex');
};
