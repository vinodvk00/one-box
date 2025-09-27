import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const routesPath = path.join(__dirname, '../routes');

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ReachInbox Onebox API',
            version: '1.0.0',
            description: 'API documentation for the Onebox email synchronization and search service.',
            contact: {
                name: 'API Support',
                url: 'https://www.reachinbox.com/contact',
            },
        },
        servers: [
            {
                url: 'http://localhost:8000',
                description: 'Development Server'
            },
        ],
    },
    apis: [`${routesPath}/**/*.ts`],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
