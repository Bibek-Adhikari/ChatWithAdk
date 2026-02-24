// server/routes/payments.ts
import express from 'express';
import Stripe from 'stripe';
import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' }) : null;
const router = express.Router();
const jsonParser = express.json();

router.use((req, res, next) => {
  if (req.path === '/webhook') return next();
  return jsonParser(req, res, next);
});

const initFirebaseAdmin = () => {
  if (getApps().length > 0) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({ credential: cert(serviceAccount) });
    return;
  }

  initializeApp({ credential: applicationDefault() });
};

const requireFirebaseAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    initFirebaseAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization bearer token.' });
    }

    const decoded = await getAuth().verifyIdToken(token);
    (req as any).firebaseUser = decoded;
    return next();
  } catch (error: any) {
    console.error('Firebase token verification failed:', error?.message || error);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

type BillingCycle = 'monthly' | 'yearly';

const PRICING: Record<string, Record<BillingCycle, number>> = {
  pro: {
    monthly: Number(process.env.STRIPE_PRICE_PRO_MONTHLY_CENTS || 200),
    yearly: Number(process.env.STRIPE_PRICE_PRO_YEARLY_CENTS || 1900),
  },
  enterprise: {
    monthly: Number(process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY_CENTS || 400),
    yearly: Number(process.env.STRIPE_PRICE_ENTERPRISE_YEARLY_CENTS || 3800),
  }
};

const getPlanPricing = (planId: string, billingCycle: BillingCycle) => {
  const plan = PRICING[planId];
  if (!plan) return null;
  const amount = plan[billingCycle];
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
};

const activateSubscription = async (payload: {
  userId: string;
  userEmail?: string | null;
  planId: string;
  billingCycle: BillingCycle;
  transactionId: string;
  amount: number;
  currency: string;
  customerId?: string | null;
}) => {
  initFirebaseAdmin();
  const db = getFirestore();
  const auth = getAuth();

  const periodDays = payload.billingCycle === 'yearly' ? 365 : 30;
  const currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);

  await db.collection('subscriptions').doc(payload.userId).set({
    userId: payload.userId,
    userEmail: payload.userEmail || null,
    planId: payload.planId,
    billingCycle: payload.billingCycle,
    status: 'active',
    stripeCustomerId: payload.customerId || null,
    lastTransactionId: payload.transactionId,
    amount: payload.amount,
    currency: payload.currency,
    currentPeriodEnd: Timestamp.fromDate(currentPeriodEnd),
    updatedAt: Timestamp.now(),
  }, { merge: true });

  const user = await auth.getUser(payload.userId);
  const existingClaims = user.customClaims || {};
  await auth.setCustomUserClaims(payload.userId, {
    ...existingClaims,
    pro: true,
    planId: payload.planId,
    billingCycle: payload.billingCycle,
    proUpdatedAt: Date.now(),
  });
};

router.post('/create-payment-intent', requireFirebaseAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured on server.' });
  }

  try {
    const { planId, billingCycle = 'monthly', currency = 'usd' } = req.body || {};
    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = getPlanPricing(planId, cycle);

    if (!planId || !amount) {
      return res.status(400).json({ error: 'Invalid plan or billing cycle.' });
    }

    const firebaseUser = (req as any).firebaseUser;
    const userId = firebaseUser?.uid;
    const userEmail = firebaseUser?.email || null;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user.' });
    }

    let customer: Stripe.Customer | undefined;
    if (userEmail) {
      const existingCustomers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      }
    }

    if (!customer) {
      customer = await stripe.customers.create({
        email: userEmail || undefined,
        metadata: { firebaseUid: userId }
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: {
        planId,
        billingCycle: cycle,
        userId,
        userEmail: userEmail || '',
        integration_check: 'accept_a_payment'
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (err: any) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Webhook for payment confirmation
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(500).json({ error: 'Stripe webhook not configured.' });
  }

  const sig = req.headers['stripe-signature'] as string;
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      stripeWebhookSecret
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { planId, billingCycle, userId, userEmail } = paymentIntent.metadata || {};

      if (userId && planId && billingCycle) {
        await activateSubscription({
          userId,
          userEmail: userEmail || null,
          planId,
          billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
          transactionId: paymentIntent.id,
          amount: paymentIntent.amount_received / 100,
          currency: paymentIntent.currency || 'usd',
          customerId: paymentIntent.customer ? String(paymentIntent.customer) : null
        });
      } else {
        console.warn('Payment intent missing metadata; subscription not activated.', paymentIntent.id);
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
