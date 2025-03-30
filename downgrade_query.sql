-- SQL query to downgrade a user from Moonlighting to Pro plan without payment
-- Replace YOUR_USER_ID_HERE with the actual user ID number

-- Option 1: Update by user ID (recommended)
UPDATE teams 
SET 
  plan_name = 'Pro', 
  subscription_status = 'active', 
  stripe_product_id = 'pro-fallback', -- Using fallback product ID from code
  updated_at = NOW()
WHERE id = (
  SELECT team_id 
  FROM team_members 
  WHERE user_id = YOUR_USER_ID_HERE
);

-- Option 2: Update by user email
-- UPDATE teams 
-- SET 
--   plan_name = 'Pro', 
--   subscription_status = 'active', 
--   stripe_product_id = 'pro-fallback', -- Using fallback product ID from code
--   updated_at = NOW()
-- WHERE id = (
--   SELECT tm.team_id 
--   FROM team_members tm
--   JOIN users u ON tm.user_id = u.id
--   WHERE u.email = 'YOUR_EMAIL_HERE'
-- );

-- Option 3: Update specific team by team ID
-- UPDATE teams 
-- SET 
--   plan_name = 'Pro', 
--   subscription_status = 'active', 
--   stripe_product_id = 'pro-fallback', -- Using fallback product ID from code
--   updated_at = NOW()
-- WHERE id = YOUR_TEAM_ID_HERE;

-- Note: This query downgrades a user from the Moonlighting plan to the Pro plan.
-- Since the Pro plan is free, there's no need to create a payment or subscription in Stripe.
-- This change should be reflected in the UI after the query runs. 