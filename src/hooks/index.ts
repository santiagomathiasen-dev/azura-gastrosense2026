// ─────────────────────────────────────────────────────────────────────────────
// HOOKS — Root Barrel Export
//
// Este arquivo permite que imports legados do tipo:
//   import { useProductions } from '@/hooks'
// continuem funcionando após a reorganização de pastas.
//
// A partir da Fase 2, os imports devem migrar para os barrels específicos:
//   import { useProductions } from '@/hooks/ops'
//   import { useStockItems }   from '@/hooks/stock'
//   etc.
// ─────────────────────────────────────────────────────────────────────────────

export * from './ops';
export * from './stock';
export * from './purchases';
export * from './financial';
export * from './shared';
