import serverless from 'serverless-http';
import { createApp } from '../../server/index.js';

const app = createApp();
export const handler = serverless(app, { basePath: '/api' });
