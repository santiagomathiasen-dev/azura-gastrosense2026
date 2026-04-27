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

/** Subscription duration in days after payment */
export const SUBSCRIPTION_DAYS = 30;
/** Days before expiry to start showing warnings */
export const WARNING_DAYS = 3;

export function usePlanLimits() {
  const { profile } = useProfile();
  const plan: PlanType = (profile?.subscription_plan as PlanType) || 'gratis';
  const limits = PLAN_LIMITS[plan];

  const now = new Date();

  // --- Trial logic (gratis plan, 7 days from account creation) ---
  const isTrialExpired = (): boolean => {
    if (profile?.status_pagamento === true) return false;
    if (plan !== 'gratis') return false;
    if (!profile?.created_at) return false;
    const created = new Date(profile.created_at);
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  };

  const trialDaysRemaining = (): number | null => {
    if (plan !== 'gratis' || !profile?.created_at) return null;
    if (profile?.status_pagamento === true) return null;
    const created = new Date(profile.created_at);
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    const remaining = Math.ceil(7 - diffDays);
    return Math.max(0, remaining);
  };

  // --- Subscription logic (paid users, 30 days from subscription_end_date) ---
  const subscriptionEndDate = profile?.subscription_end_date
    ? new Date(profile.subscription_end_date)
    : null;

  const isSubscriptionExpired = (): boolean => {
    // Not paid = no subscription to expire (handled by trial logic)
    if (profile?.status_pagamento !== true) return false;
    // No end date set = unlimited (admin-granted or legacy)
    if (!subscriptionEndDate) return false;
    return now > subscriptionEndDate;
  };

  const daysUntilExpiry = (): number | null => {
    if (profile?.status_pagamento !== true) return null;
    if (!subscriptionEndDate) return null;
    const diff = (subscriptionEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return Math.ceil(diff);
  };

  const isSubscriptionExpiring = (): boolean => {
    const days = daysUntilExpiry();
    if (days === null) return false;
    return days > 0 && days <= WARNING_DAYS;
  };

  // --- Combined access check ---
  const shouldBlockAccess = (): boolean => {
    const role = profile?.role as string;
    // Owner and admin bypass payment — they manage the platform
    if (role === 'owner' || role === 'admin') return false;
    // Collaborators don't pay — their gestor pays
    if (role === 'colaborador') return false;
    // Profile not loaded yet — don't block
    if (!profile) return false;

    // Subscription expired
    if (isSubscriptionExpired()) return true;
    // Trial expired and never paid
    if (isTrialExpired()) return true;

    return false;
  };

  const canCreate = (resource: 'fichas' | 'gestores' | 'colaboradores', currentCount: number) => {
    const limit = limits[resource];
    if (limit === Infinity) return true;
    return currentCount < limit;
  };

  return {
    plan,
    limits,
    // Trial
    isTrialExpired: isTrialExpired(),
    trialDaysRemaining: trialDaysRemaining(),
    // Subscription
    isSubscriptionExpired: isSubscriptionExpired(),
    isSubscriptionExpiring: isSubscriptionExpiring(),
    daysUntilExpiry: daysUntilExpiry(),
    subscriptionEndDate,
    // Combined
    shouldBlockAccess: shouldBlockAccess(),
    // Limits
    canCreate,
    isUltra: plan === 'ultra',
    isPro: plan === 'pro',
    isFree: plan === 'gratis',
  };
}
