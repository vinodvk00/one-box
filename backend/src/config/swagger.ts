import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const routesPath = path.join(__dirname, '../routes');

const routeExtension = process.env.NODE_ENV === 'production' ? 'js' : 'ts';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'One-Mail API',
            version: '1.0.0',
            description: 'API documentation for the One-Mail email synchronization and search service.',
            contact: {
                name: 'API Support'
            },
        },
        servers: [
            {
                url: 'http://localhost:8000',
                description: 'Development Server'
            },
        ],
        components: {
            securitySchemes: {
                sessionAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'sessionId',
                    description: 'Session cookie authentication'
                }
            }
        }
    },
    apis: [`${routesPath}/**/*.${routeExtension}`],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
