import express from "express";
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from "./config/swagger";
import initializeEmailSync from "./apps/imap.app";
import emailRoutes from "./routes/email.routes";
import trainingRoutes from './routes/rag-suggestion-routes/training.routes';
import replyRoutes from './routes/rag-suggestion-routes/reply.routes';
import { createTrainingIndex } from './services/rag-suggestion-services/vector-store.service';

const app = express();
const port = process.env.PORT || 3000;

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