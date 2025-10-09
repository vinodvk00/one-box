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

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

async function initialize() {
    app.use(statusMonitor());
    app.use(morgan('dev'));

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const allowedOrigins = [
        frontendUrl,
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000'
    ];

    app.use(cors({
        origin: (origin, callback) => {
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
        const sessionMiddleware = await createSessionMiddleware();
        app.use(sessionMiddleware);
    } catch (error) {
        throw error;
    }

    app.use('/api', emailRoutes);
    app.use('/auth', userAuthRoutes);
    app.use('/auth', accountManagementRoutes);
    app.use('/auth', authRoutes);

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    app.get("/debug-sentry", function mainHandler(req, res) {
        throw new Error("My first Sentry error!");
    });

    app.get("/", (req, res) => {
        res.send("Email Sync Service is running. Visit /api-docs for API documentation.");
    });

    Sentry.setupExpressErrorHandler(app);

    try {
        await initializeDatabase();
    } catch (error) {
        throw error;
    }

    app.listen(port, () => {
    });
}

initialize().catch((error) => {
    process.exit(1);
});
