-- Fix #1: Update profile creation trigger to give 30 credits instead of 100

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, credits)
    VALUES (NEW.id, NEW.email, 30);  -- Changed from 100 to 30

    -- Create signup bonus transaction
    INSERT INTO public.credit_transactions (user_id, amount, balance_after, transaction_type, description)
    VALUES (NEW.id, 30, 30, 'signup_bonus', 'Welcome bonus: 3 free patent analyses');  -- Changed from 100 to 30

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the trigger exists and uses the new function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verification
SELECT 'Trigger updated successfully! New users will now receive 30 credits instead of 100.' AS status;
