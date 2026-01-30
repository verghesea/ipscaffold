-- ============================================
-- Payments Table for Stripe Integration
-- ============================================
-- Tracks Stripe payment transactions for credit purchases
--
-- Run this migration in Supabase SQL Editor

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_payment_intent_id TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd' NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    product_key TEXT NOT NULL,
    credits_awarded INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own payments
CREATE POLICY "Users can view own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can manage all payments (for webhooks)
CREATE POLICY "Service role can manage payments"
    ON public.payments FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON public.payments(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.payments IS 'Stripe payment transactions for credit purchases';
COMMENT ON COLUMN public.payments.stripe_session_id IS 'Stripe Checkout Session ID (unique)';
COMMENT ON COLUMN public.payments.stripe_payment_intent_id IS 'Stripe Payment Intent ID';
COMMENT ON COLUMN public.payments.amount_cents IS 'Amount in cents (e.g., 2500 = $25.00)';
COMMENT ON COLUMN public.payments.status IS 'Payment status: pending, completed, failed, refunded';
COMMENT ON COLUMN public.payments.product_key IS 'Product identifier (e.g., credits_30)';
COMMENT ON COLUMN public.payments.credits_awarded IS 'Number of credits awarded for this payment';
COMMENT ON COLUMN public.payments.metadata IS 'Additional payment metadata (customer_email, etc.)';
