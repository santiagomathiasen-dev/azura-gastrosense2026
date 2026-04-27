// ─────────────────────────────────────────────────────────────────────────────
// FINANCEIRO — Barrel Export
// Todos os hooks do módulo Financeiro exportados por aqui.
// Inclui useSaleProducts (PDV) pois é a ponte entre OPS e Vendas.
// ─────────────────────────────────────────────────────────────────────────────

export * from './useFinancials';
export * from './useProductCosts';
export * from './useReports';
export * from './useSalesForecasts';
export * from './useForecastExplosion';
export * from './useForecastProductionOrders';
export * from './useSalesProductionHistory';
export * from './useSaleProducts';
