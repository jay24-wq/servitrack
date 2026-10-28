export const PLAN_LIMITS = {
    STARTER: {
        max_users: 3,
        max_tickets_per_month: 100,
        has_whatsapp: false,
        has_quotation_approval: false,
        has_multi_branch: false,
        has_courier: false,
    },
    PRO: {
        max_users: Infinity,
        max_tickets_per_month: Infinity,
        has_whatsapp: true,
        has_quotation_approval: true,
        has_multi_branch: false,
        has_courier: false,
    },
    ADVANCE: {
        max_users: Infinity,
        max_tickets_per_month: Infinity,
        has_whatsapp: true,
        has_quotation_approval: true,
        has_multi_branch: true,
        has_courier: true,
    },
};
//# sourceMappingURL=plans.js.map