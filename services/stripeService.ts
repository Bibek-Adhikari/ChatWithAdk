// services/stripeService.ts
import { loadStripe } from '@stripe/stripe-js';
import { auth } from './firebase';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  clientSecret?: string;
  error?: string;
}

export const createPaymentIntent = async (
  planId: string,
  billingCycle: 'monthly' | 'yearly' = 'monthly',
  currency: string = 'usd'
): Promise<PaymentResult> => {
  try {
    // Backend requires a Firebase ID token (see server/routes/payments.ts requireFirebaseAuth)
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    if (!token) {
      return { success: false, error: 'Please sign in before paying.' };
    }
    // Backend mounts at /api/payments (see server/index.js), route /create-payment-intent
    const response = await fetch(`${API_BASE}/api/payments/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ planId, billingCycle, currency }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create payment intent');
    }

    return {
      success: true,
      clientSecret: data.clientSecret,
      transactionId: data.paymentIntentId
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message
    };
  }
};

export const confirmCardPayment = async (
  clientSecret: string,
  cardElement: any,
  billingDetails: { email: string; name?: string }
): Promise<PaymentResult> => {
  const stripe = await stripePromise;
  if (!stripe) return { success: false, error: 'Stripe failed to load' };

  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement,
      billing_details: billingDetails,
    },
  });

  if (error) {
    return {
      success: false,
      error: error.message
    };
  }

  return {
    success: true,
    transactionId: paymentIntent.id
  };
};