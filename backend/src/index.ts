console.time('🕐 Total Startup Time');
console.time('📦 Imports & Dependencies');

import "./instrument.js";
import "./types/session.types"; 
import * as Sentry from "@sentry/node"
import express from "express";
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from "./config/swagger";
import emailRoutes from "./routes/email.routes";
import authRoutes from './routes/auth.routes';
import userAuthRoutes from './routes/user-auth.routes';
import accountManagementRoutes from './routes/account-management.routes';
import { initializeDatabase } from './services/database-init.service';
import { createSessionMiddleware } from './middleware/session.middleware';
import statusMonitor from 'express-status-monitor';
import morgan from 'morgan';

console.timeEnd('📦 Imports & Dependencies');

console.time('⚙️  Environment Config');
dotenv.config();
console.timeEnd('⚙️  Environment Config');

const app = express();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

const port = process.env.PORT || 8000;

async function initialize() {
    console.time('🔧 Middleware Setup');

    app.use(statusMonitor());

    app.use(morgan('dev'));

    // CORS configuration
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const allowedOrigins = [
        frontendUrl,
        'http://localhost:5173', // Vite dev server
        'http://localhost:3000', // Alternative frontend port
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000'
    ];

    app.use(cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl)
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));

    app.use(express.json());

    try {
        console.time('🔐 Session Middleware Setup');
        const sessionMiddleware = await createSessionMiddleware();
        app.use(sessionMiddleware);
        console.timeEnd('🔐 Session Middleware Setup');
        console.log('✅ Session middleware initialized with Redis');
    } catch (error) {
        console.error('❌ Failed to initialize session middleware:', error);
        throw error;
    }

    app.use('/api', emailRoutes);
    app.use('/auth', userAuthRoutes); // User authentication (register, login, etc.)
    app.use('/auth', accountManagementRoutes); // Email account management (connect Gmail/IMAP, etc.)
    app.use('/auth', authRoutes); // Legacy OAuth routes (will be deprecated)

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.timeEnd('🔧 Middleware Setup');

    app.get("/debug-sentry", function mainHandler(req, res) {
        throw new Error("My first Sentry error!");
    });

    app.get("/", (req, res) => {
        res.send("Email Sync Service is running. Visit /api-docs for API documentation.");
    });

    Sentry.setupExpressErrorHandler(app);

    try {
        console.time('💾 Database Initialization');
        await initializeDatabase();
        console.timeEnd('💾 Database Initialization');
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        throw error;
    }

    console.time('🌐 Server Listen');
    app.listen(port, () => {
        console.timeEnd('🌐 Server Listen');
        console.log(`🚀 Server is running on http://localhost:${port}`);
        console.log(`📚 API docs available at http://localhost:${port}/api-docs`);
        console.log('✅ OAuth routes are ready at /auth/*');
        console.log('✅ Email API routes are ready at /api/*');
        console.log('📄 API documentation available at /api-docs');
        console.log('🎉 Server fully initialized and ready!');
        console.log('🔄 Server is now listening for requests...');
        console.timeEnd('🕐 Total Startup Time');
    });
}

initialize().catch((error) => {
    console.error('💥 Failed to initialize server:', error);
    process.exit(1);
});
