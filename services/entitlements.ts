// services/entitlements.ts
// Client-side view of the user's paid plan.
//
// Entitlement is authoritative on the server (Stripe / Firebase), so this
// helper just asks the metered API. It never trusts a client-side claim.
import { auth } from './firebase';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export interface Entitlement {
  pro: boolean;
  planId: string | null;
  billingCycle: 'monthly' | 'yearly' | null;
  currentPeriodEnd?: string | null;
  source?: string;
}

export async function fetchEntitlement(): Promise<Entitlement> {
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    if (!token) return { pro: false, planId: null, billingCycle: null };
    const response = await fetch(`${API_BASE}/api/payments/entitlement`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { pro: false, planId: null, billingCycle: null };
    const data = await response.json().catch(() => ({}));
    return {
      pro: !!data.pro,
      planId: data.planId ?? null,
      billingCycle: data.billingCycle ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      source: data.source,
    };
  } catch {
    return { pro: false, planId: null, billingCycle: null };
  }
}
