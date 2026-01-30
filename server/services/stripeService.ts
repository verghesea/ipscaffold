/**
 * Stripe Service - Handles payment processing and checkout sessions
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export const CREDIT_PRODUCTS = {
  credits_30: {
    name: '3 Patent Credits',
    credits: 30, // 3 patents x 10 credits each
    priceInCents: 2500, // $25.00
    description: 'Analyze 3 additional patents',
  },
} as const;

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  productKey: keyof typeof CREDIT_PRODUCTS,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const product = CREDIT_PRODUCTS[productKey];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: userEmail,
    client_reference_id: userId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      productKey,
      credits: product.credits.toString(),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session.url!;
}

export async function constructWebhookEvent(
  rawBody: Buffer,
  signature: string
): Promise<Stripe.Event> {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

export { stripe };
