import session from 'express-session';
import { getRedisClient } from '../services/shared/redis.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RedisStore } = require('connect-redis');

export const createSessionMiddleware = async () => {
    const redisClient = await getRedisClient();

    // In Docker, we use production mode but still need HTTP cookies for local testing
    // Only use secure cookies if explicitly enabled via SECURE_COOKIES env var
    const useSecureCookies = process.env.SECURE_COOKIES === 'true';

    const sessionConfig: session.SessionOptions = {
        secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
        resave: false,
        saveUninitialized: false,
        name: 'sessionId',
        cookie: {
            secure: useSecureCookies, 
            httpOnly: true,
            maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'),
            sameSite: useSecureCookies ? 'none' : 'lax',
        }
    };

    if (redisClient) {
        sessionConfig.store = new RedisStore({
            client: redisClient,
            prefix: 'sess:',
        });
    }

    return session(sessionConfig);
};
