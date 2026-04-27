// ─────────────────────────────────────────────────────────────────────────────
// ESTOQUE — Barrel Export
// Todos os hooks do módulo Estoque exportados por aqui.
// Nota: useStockItems.processInvoiceImport ainda escreve em financial_expenses
// (será refatorado na Fase 2).
// ─────────────────────────────────────────────────────────────────────────────

export * from './useStockItems';
export * from './useStockMovements';
export * from './useStockRequests';
export * from './useExpiryDates';
export * from './useStockAI';
export * from './useStockVoiceControl';
export * from './useLosses';
