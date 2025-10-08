import session from 'express-session';
import { getRedisClient } from '../services/redis.service';

// Work around for connect-redis v9 TypeScript issue
// todo: replace with import when types fixed for consistency
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RedisStore } = require('connect-redis');

export const createSessionMiddleware = async () => {
    const redisClient = await getRedisClient();

    const sessionConfig: session.SessionOptions = {
        secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
        resave: false,
        saveUninitialized: false,
        name: 'sessionId',
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours default
            sameSite: 'lax'
        }
    };

    if (redisClient) {
        console.log('✅ Using Redis for session storage');
        sessionConfig.store = new RedisStore({
            client: redisClient,
            prefix: 'sess:',
        });
    } else {
        // todo: remove this warning when we have a proper persistent store implemented
        console.warn("⚠️  Using in-memory session storage, can't be used in production");
        console.warn('⚠️  Sessions will be lost on server restart');
        //NOTE:  express-session uses MemoryStore by default when no store is specified
    }

    return session(sessionConfig);
};
