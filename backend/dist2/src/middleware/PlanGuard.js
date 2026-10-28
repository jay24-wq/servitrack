import { PLAN_LIMITS } from '../../config/plans';
export function planGuard(req, _res, next) {
    const plan = req.user?.plan;
    if (!plan) {
        next();
        return;
    }
    const limits = PLAN_LIMITS[plan];
    req.headers['x-plan'] = plan;
    req.headers['x-plan-limits'] = JSON.stringify(limits);
    next();
}
//# sourceMappingURL=PlanGuard.js.map