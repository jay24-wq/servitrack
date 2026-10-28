import type { Response, NextFunction } from 'express';
import { PLAN_LIMITS } from '../../config/plans';
import type { AuthRequest } from './AuthMiddleware';

export function planGuard(req: AuthRequest, _res: Response, next: NextFunction) {
  const plan = req.user?.plan as keyof typeof PLAN_LIMITS;
  
  if (!plan) {
    next();
    return;
  }

  const limits = PLAN_LIMITS[plan];
  
  req.headers['x-plan'] = plan;
  req.headers['x-plan-limits'] = JSON.stringify(limits);
  
  next();
}
