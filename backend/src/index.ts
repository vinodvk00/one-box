import "./instrument.js";
import * as Sentry from "@sentry/node"
import express from "express";
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from "./config/swagger";
import emailRoutes from "./routes/email.routes";
import authRoutes from './routes/auth.routes';
import { initializeDatabase } from './services/database-init.service';

dotenv.config();

const app = express();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

const port = process.env.PORT || 8000;

app.use(cors({
  origin: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Alternative frontend port
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api', emailRoutes);
app.use('/auth', authRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

app.get("/", (req, res) => {
    res.send("Email Sync Service is running. Visit /api-docs for API documentation.");
});

Sentry.setupExpressErrorHandler(app);

app.listen(port, async () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
    console.log(`📚 API docs available at http://localhost:${port}/api-docs`);

    try {
        await initializeDatabase();
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
    }

    console.log('✅ OAuth routes are ready at /auth/*');
    console.log('✅ Email API routes are ready at /api/*');
    console.log('📄 API documentation available at /api-docs');
    console.log('🎉 Server fully initialized and ready!');
    console.log('🔄 Server is now listening for requests...');
});