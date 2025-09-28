import express from "express";
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from "./config/swagger";
import initializeEmailSync from "./apps/imap.app";
import emailRoutes from "./routes/email.routes";
import trainingRoutes from './routes/rag-suggestion-routes/training.routes';
import replyRoutes from './routes/rag-suggestion-routes/reply.routes';
import { createTrainingIndex } from './services/rag-suggestion-services/vector-store.service';

const app = express();
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

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
    res.send("Email Sync Service is running. Visit /api-docs for API documentation.");
});

app.listen(port, async () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`API docs available at http://localhost:${port}/api-docs`);
    await createTrainingIndex();
    initializeEmailSync();
});