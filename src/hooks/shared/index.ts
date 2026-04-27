// ─────────────────────────────────────────────────────────────────────────────
// SHARED / INFRAESTRUTURA — Barrel Export
// Hooks transversais usados por todos os módulos.
// Estes NÃO devem ser movidos para nenhum módulo específico — são globais.
// ─────────────────────────────────────────────────────────────────────────────

export * from './useAuth';
export * from './useOwnerId';
export * from './useUserRole';
export * from './useProfile';
export * from './useCollaborators';
export * from './useEvents';
export * from './useNavigate';
export * from './usePlanLimits';
export * from './usePosIntegrations';
export * from './useRealtimeSubscription';
export * from './use-toast';
export * from './usePermissionWithTimeout';
