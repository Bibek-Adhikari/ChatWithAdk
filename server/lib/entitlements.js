// server/lib/entitlements.js
// Who is a paying customer?
//
// Three sources, in order of speed:
//   1. In-memory cache (primed on checkout, 5 minute TTL).
//   2. The `subscriptions` doc written by firebase-admin.
//   3. Stripe itself: a succeeded PaymentIntent carrying `metadata.userId`.
//
// Step 3 matters because custom claims require a service account for the same
// Firebase project as the web app. Until FIREBASE_SERVICE_ACCOUNT_JSON is
// replaced, Stripe keeps entitlement correct without blocking paid users.
import Stripe from 'stripe';
import { getDb } from './firebaseAuth.js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const CACHE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000; // don't hammer Stripe for free users
const cache = new Map();

const safeUserId = (userId) => String(userId || '').replace(/[^A-Za-z0-9_-]/g, '');

const periodEndToDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const entitlementFrom = (fields) => ({
  pro: true,
  planId: fields.planId || null,
  billingCycle: fields.billingCycle || null,
  currentPeriodEnd: periodEndToDate(fields.currentPeriodEnd)?.toISOString() || null,
  source: fields.source || 'unknown',
});

export function rememberEntitlement(userId, fields) {
  const id = safeUserId(userId);
  if (!id) return;
  cache.set(id, { at: Date.now(), value: entitlementFrom(fields) });
}

async function fromFirestore(userId) {
  try {
    const snap = await getDb().collection('subscriptions').doc(userId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (data.status !== 'active') return null;
    const end = periodEndToDate(data.currentPeriodEnd);
    if (end && end.getTime() < Date.now()) return null;
    return entitlementFrom({ ...data, source: 'firestore' });
  } catch {
    // Service account may belong to another project; Stripe is the authority.
    return null;
  }
}

async function fromStripe(userId) {
  if (!stripe) return null;
  try {
    const result = await stripe.paymentIntents.search({
      query: `metadata['userId']:'${userId}' AND status:'succeeded'`,
      limit: 1,
    });
    const intent = result?.data?.[0];
    if (!intent) return null;
    const metadata = intent.metadata || {};
    return entitlementFrom({
      planId: metadata.planId,
      billingCycle: metadata.billingCycle,
      currentPeriodEnd: null,
      source: 'stripe',
    });
  } catch (error) {
    console.warn('[entitlements] Stripe lookup failed:', error?.message || error);
    return null;
  }
}

/**
 * Resolve a user's paid plan. Never throws; returns null for non-payers.
 */
export async function getEntitlement(userId) {
  const id = safeUserId(userId);
  if (!id || id.startsWith('guest_')) return null;

  const hit = cache.get(id);
  if (hit) {
    const ttl = hit.value ? CACHE_TTL_MS : NEGATIVE_TTL_MS;
    if (Date.now() - hit.at < ttl) return hit.value;
  }

  const entitlement = (await fromFirestore(id)) || (await fromStripe(id));

  if (entitlement) rememberEntitlement(id, entitlement);
  else cache.set(id, { at: Date.now(), value: null });

  return entitlement;
}
