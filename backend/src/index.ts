import express from "express";
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from "./config/swagger";
import initializeEmailSync from "./apps/imap.app";
import emailRoutes from "./routes/email.routes";
import trainingRoutes from './routes/rag-suggestion-routes/training.routes';
import replyRoutes from './routes/rag-suggestion-routes/reply.routes';
import authRoutes from './routes/auth.routes';
import { createTrainingIndex } from './services/rag-suggestion-services/vector-store.service';
import { initializeDatabase } from './services/database-init.service';

const app = express();

// Prevent process from exiting due to unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process for OAuth testing
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit the process for OAuth testing
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
app.use('/api/training', trainingRoutes);
app.use('/api/emails', replyRoutes);
app.use('/auth', authRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
    res.send("Email Sync Service is running. Visit /api-docs for API documentation.");
});

app.listen(port, async () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
    console.log(`📚 API docs available at http://localhost:${port}/api-docs`);

    try {
        console.log('🔧 Starting database initialization...');
        await initializeDatabase();
        console.log('✅ Database initialized successfully');

        console.log('🤖 Starting training index creation...');
        await createTrainingIndex();
        console.log('✅ Training index ready');

        console.log('✅ OAuth routes are ready at /auth/*');
        console.log('⚠️  IMAP initialization skipped for OAuth testing');
        console.log('🎉 Server fully initialized and ready!');

        // Keep process alive for OAuth testing
        console.log('🔄 Server is now listening for requests...');
    } catch (error) {
        console.error('❌ Initialization error:', error);
    }
});