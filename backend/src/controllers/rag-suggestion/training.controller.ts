import { Request, Response } from 'express';
import { addTrainingData as addTrainingDataService, createTrainingIndex, TrainingData } from '../../services/ai/suggestions/vector-store.service';

/**
 * Add training data for reply suggestions
 */
export const addTrainingData = async (req: Request, res: Response) => {
    try {
        await createTrainingIndex();
        const trainingData: TrainingData = req.body;
        await addTrainingDataService(trainingData);
        res.json({ message: 'Training data added successfully' });
    } catch (error) {
        console.error('Failed to add training data:', error);
        res.status(500).json({ error: 'Failed to add training data' });
    }
};