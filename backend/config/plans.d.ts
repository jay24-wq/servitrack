export declare const PLAN_LIMITS: {
    readonly STARTER: {
        readonly max_users: 3;
        readonly max_tickets_per_month: 100;
        readonly has_whatsapp: false;
        readonly has_quotation_approval: false;
        readonly has_multi_branch: false;
        readonly has_courier: false;
    };
    readonly PRO: {
        readonly max_users: number;
        readonly max_tickets_per_month: number;
        readonly has_whatsapp: true;
        readonly has_quotation_approval: true;
        readonly has_multi_branch: false;
        readonly has_courier: false;
    };
    readonly ADVANCE: {
        readonly max_users: number;
        readonly max_tickets_per_month: number;
        readonly has_whatsapp: true;
        readonly has_quotation_approval: true;
        readonly has_multi_branch: true;
        readonly has_courier: true;
    };
};
export type PlanName = keyof typeof PLAN_LIMITS;
//# sourceMappingURL=plans.d.ts.map