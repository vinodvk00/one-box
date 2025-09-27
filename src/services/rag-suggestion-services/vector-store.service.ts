import { Client } from '@elastic/elasticsearch';

const esClient = new Client({
    node: 'http://localhost:9200',
});

const TRAINING_INDEX = 'email_training_data';

export interface TrainingData {
    id?: string;
    scenario: string;
    context: string;
    response_template: string;
    embedding?: number[];
}

export async function createTrainingIndex(): Promise<void> {
    try {
        const exists = await esClient.indices.exists({ index: TRAINING_INDEX });

        if (exists) {
            const mapping = await esClient.indices.getMapping({ index: TRAINING_INDEX });
            const embeddingProperty = mapping[TRAINING_INDEX]?.mappings?.properties?.embedding as any;
            const currentDims = embeddingProperty?.dims;
            
            if (currentDims !== 1536) {
                console.log(`⚠️  Existing training index has wrong dimensions (${currentDims}). Recreating with OpenAI dimensions (1536)...`);
                
                // Delete the old index
                await esClient.indices.delete({ index: TRAINING_INDEX });
                console.log('✅ Old training index deleted.');
            } else {
                console.log('Training index already exists with correct OpenAI dimensions.');
                return;
            }
        }

        await esClient.indices.create({
            index: TRAINING_INDEX,
            mappings: {
                properties: {
                    scenario: { type: 'text' },
                    context: { type: 'text' },
                    response_template: { type: 'text' },
                    embedding: {
                        type: 'dense_vector',
                        dims: 1536, // OpenAI text-embedding-3-small dimension
                        index: true,
                        similarity: 'cosine'
                    }
                }
            }
        });
        console.log('✅ Training data index created with OpenAI dimensions (1536).');
        
    } catch (error) {
        console.error('Error creating training index:', error);
        throw error;
    }
}

export async function addTrainingData(data: TrainingData): Promise<void> {
    const { generateEmbedding } = await import('./embedding.service');

    const textToEmbed = `${data.scenario} ${data.context}`;
    const embedding = await generateEmbedding(textToEmbed);

    await esClient.index({
        index: TRAINING_INDEX,
        body: {
            ...data,
            embedding
        }
    });

    await esClient.indices.refresh({ index: TRAINING_INDEX });
}

export async function searchSimilarTraining(query: string, k: number = 3): Promise<TrainingData[]> {
    const { generateEmbedding } = await import('./embedding.service');

    const queryEmbedding = await generateEmbedding(query);

    const result = await esClient.search({
        index: TRAINING_INDEX,
        body: {
            size: k,
            query: {
                script_score: {
                    query: { match_all: {} },
                    script: {
                        source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                        params: {
                            query_vector: queryEmbedding
                        }
                    }
                }
            }
        }
    });

    return result.hits.hits.map(hit => hit._source as TrainingData);
}