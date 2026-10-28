import { config as dotEnvConfig } from 'dotenv';

dotEnvConfig({ path: '.env' });

export const appConfig = {
  port: parseInt(process.env.PORT || '3000'),
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-key-change-in-production',
  apiPrefix: '/api',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
