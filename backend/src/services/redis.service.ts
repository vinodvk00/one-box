import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisAvailable = true;

export const getRedisClient = async (): Promise<ReturnType<typeof createClient> | null> => {
    if (!redisClient && redisAvailable) {
        try {
            console.time('    🔌 Redis client connection');

            redisClient = createClient({
                socket: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    connectTimeout: 5000, // 5 second timeout
                    reconnectStrategy: false // Disable automatic reconnection
                }
            });

            // Disable error handler to prevent excessive logging during connection failure
            let connectionError: Error | null = null;
            redisClient.on('error', (err) => {
                connectionError = err;
            });

            redisClient.on('connect', () => {
                console.log('✅ Redis client connected');
            });

            redisClient.on('ready', () => {
                console.log('✅ Redis client ready');
            });

            await redisClient.connect();
            console.timeEnd('    🔌 Redis client connection');
            redisAvailable = true;
        } catch (error) {
            console.error('❌ Failed to connect to Redis');
            console.warn('⚠️  Falling back to in-memory sessions');

            if (redisClient) {
                try {
                    await redisClient.quit();
                } catch (e) {
                    // Ignore cleanup errors
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
        console.log('✅ Redis client disconnected');
    }
};
