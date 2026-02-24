// services/stripeService.ts
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  clientSecret?: string;
  error?: string;
}

export const createPaymentIntent = async (
  amount: number, 
  currency: string = 'usd',
  metadata: { planId: string; userEmail: string }
): Promise<PaymentResult> => {
  try {
    // Call your backend to create PaymentIntent
    const response = await fetch('/api/stripe/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata 
      }),
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