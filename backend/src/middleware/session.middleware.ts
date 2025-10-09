import session from 'express-session';
import { getRedisClient } from '../services/redis.service';

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
            maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'),
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
