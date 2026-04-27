'use client';

import { useProfile } from './useProfile';

export type PlanType = 'gratis' | 'pro' | 'ultra';

export const PLAN_LIMITS = {
  gratis: {
    fichas: 5,
    gestores: 1,
    colaboradores: 1,
    trialDays: 7,
  },
  pro: {
    fichas: 50,
    gestores: 2,
    colaboradores: 3,
    trialDays: null,
  },
  ultra: {
    fichas: Infinity,
    gestores: Infinity,
    colaboradores: Infinity,
    trialDays: null,
  },
};

export const PLAN_PRICES = {
  gratis: { monthly: 0, label: 'Grátis' },
  pro:    { monthly: 197, label: 'Pro' },
  ultra:  { monthly: 397, label: 'Ultra' },
};

export function usePlanLimits() {
  const { profile } = useProfile();
  const plan: PlanType = (profile?.plan as PlanType) || 'gratis';
  const limits = PLAN_LIMITS[plan];

  const isTrialExpired = () => {
    // Paid users never have an expired trial — status_pagamento overrides plan field
    if (profile?.status_pagamento === true) return false;
    if (plan !== 'gratis') return false;
    if (!profile?.created_at) return false;
    const created = new Date(profile.created_at);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  };

  const canCreate = (resource: 'fichas' | 'gestores' | 'colaboradores', currentCount: number) => {
    const limit = limits[resource];
    if (limit === Infinity) return true;
    return currentCount < limit;
  };

  return {
    plan,
    limits,
    isTrialExpired: isTrialExpired(),
    canCreate,
    isUltra: plan === 'ultra',
    isPro: plan === 'pro',
    isFree: plan === 'gratis',
  };
}
