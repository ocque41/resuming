-- Remove existing free plan assignments for teams without active subscription
UPDATE teams
SET plan_name = NULL,
    subscription_status = NULL
WHERE stripe_subscription_id IS NULL
   OR subscription_status != 'active';
