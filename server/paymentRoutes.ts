/**
 * Payment Routes - Stripe Checkout and Webhook Handling
 */

import type { Express, Request, Response } from 'express';
import { createCheckoutSession, constructWebhookEvent, CREDIT_PRODUCTS } from './services/stripeService';
import { supabaseStorage } from './supabaseStorage';

export function registerPaymentRoutes(app: Express, requireAuth: any) {
  // Create checkout session
  app.post('/api/payments/create-checkout', requireAuth, async (req: Request, res: Response) => {
    try {
      const { productKey } = req.body;

      if (!productKey || !CREDIT_PRODUCTS[productKey as keyof typeof CREDIT_PRODUCTS]) {
        return res.status(400).json({ error: 'Invalid product' });
      }

      const user = req.user!;
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const checkoutUrl = await createCheckoutSession(
        user.id,
        user.email,
        productKey as keyof typeof CREDIT_PRODUCTS,
        `${baseUrl}/dashboard?payment=success`,
        `${baseUrl}/dashboard?payment=cancelled`
      );

      console.log(`[Payment] Checkout created for user ${user.id}, product: ${productKey}`);

      res.json({ url: checkoutUrl });
    } catch (error) {
      console.error('[Payment] Checkout creation failed:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  // Stripe webhook handler
  app.post('/api/webhooks/stripe', async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
      const event = await constructWebhookEvent(
        req.rawBody as Buffer,
        signature
      );

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;

          const userId = session.metadata.userId;
          const credits = parseInt(session.metadata.credits, 10);
          const productKey = session.metadata.productKey;

          console.log(`[Payment] Processing successful payment for user ${userId}`);
          console.log(`[Payment] Credits to add: ${credits}`);

          // Get current profile
          const profile = await supabaseStorage.getProfile(userId);
          if (!profile) {
            console.error(`[Payment] User ${userId} not found`);
            return res.status(400).json({ error: 'User not found' });
          }

          const newBalance = profile.credits + credits;

          // Update credits
          await supabaseStorage.updateProfileCredits(userId, newBalance);

          // Record transaction
          await supabaseStorage.createCreditTransaction({
            user_id: userId,
            amount: credits,
            balance_after: newBalance,
            transaction_type: 'purchase',
            description: `Purchased ${CREDIT_PRODUCTS[productKey as keyof typeof CREDIT_PRODUCTS].name}`,
            patent_id: null,
          });

          // Record payment
          await supabaseStorage.createPayment({
            user_id: userId,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            amount_cents: session.amount_total,
            currency: session.currency,
            status: 'completed',
            product_key: productKey,
            credits_awarded: credits,
            metadata: {
              customer_email: session.customer_email,
            },
          });

          // Create notification
          await supabaseStorage.createNotification({
            user_id: userId,
            type: 'payment_success',
            title: 'Payment Successful',
            message: `You've added ${credits / 10} patent credits to your account!`,
            data: { credits, productKey },
          });

          console.log(`[Payment] Successfully added ${credits} credits to user ${userId}`);
          break;
        }

        case 'checkout.session.expired':
        case 'payment_intent.payment_failed': {
          const session = event.data.object as any;
          console.log(`[Payment] Payment failed or expired:`, session.id);
          break;
        }

        default:
          console.log(`[Payment] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Payment] Webhook error:', error);
      res.status(400).json({ error: 'Webhook verification failed' });
    }
  });

  // Get payment history
  app.get('/api/payments/history', requireAuth, async (req: Request, res: Response) => {
    try {
      const payments = await supabaseStorage.getPaymentsByUser(req.user!.id);
      res.json({ payments });
    } catch (error) {
      console.error('[Payment] History fetch failed:', error);
      res.status(500).json({ error: 'Failed to fetch payment history' });
    }
  });

  // Get credit products/pricing
  app.get('/api/payments/products', (req: Request, res: Response) => {
    const products = Object.entries(CREDIT_PRODUCTS).map(([key, product]) => ({
      id: key,
      ...product,
      priceFormatted: `$${(product.priceInCents / 100).toFixed(2)}`,
    }));
    res.json({ products });
  });
}
