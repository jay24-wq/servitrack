import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

export function publicRateLimiter(req: Request, res: Response, next: NextFunction) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again later' },
  });
  
  limiter(req, res, next);
}

export function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down' },
  });
  
  limiter(req, res, next);
}
