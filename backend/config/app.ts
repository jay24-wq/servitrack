import { config as dotEnvConfig } from 'dotenv';

dotEnvConfig({ path: '.env' });

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}

export const appConfig = {
  port: parseInt(process.env.PORT || '3000'),
  env: process.env.NODE_ENV || 'development',
  jwtSecret,
  apiPrefix: '/api',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
