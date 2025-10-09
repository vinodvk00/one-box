import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisAvailable = true;

export const getRedisClient = async (): Promise<ReturnType<typeof createClient> | null> => {
    if (!redisClient && redisAvailable) {
        try {
            redisClient = createClient({
                socket: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    connectTimeout: 5000,
                    reconnectStrategy: false
                }
            });

            let connectionError: Error | null = null;
            redisClient.on('error', (err) => {
                connectionError = err;
            });

            await redisClient.connect();
            redisAvailable = true;
        } catch (error) {
            if (redisClient) {
                try {
                    await redisClient.quit();
                } catch (e) {
                }
            }

            redisClient = null;
            redisAvailable = false;
        }
    }

    return redisClient;
};

export const isRedisAvailable = (): boolean => {
    return redisAvailable && redisClient !== null;
};

export const closeRedisClient = async () => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
};
