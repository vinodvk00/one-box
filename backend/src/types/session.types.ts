import 'express-session';

declare module 'express-session' {
    interface SessionData {
        userId?: string;
        email?: string;
        role?: 'user' | 'admin';
        pendingAccountConnection?: boolean;
    }
}

// module augmentation for TypeScript
export {};
