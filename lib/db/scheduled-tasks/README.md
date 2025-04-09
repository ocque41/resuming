# Automatic User Plan Upgrade System

This module provides automated functionality to ensure all users have at least Pro plan access, while preserving existing Moonlighting subscriptions.

## How It Works

1. The system automatically upgrades all users to the Pro plan except those who are already on the Moonlighting plan
2. This ensures everyone has access to Pro features without affecting paying Moonlighting customers

## Available Scripts

### One-time Migration

To run a one-time migration that upgrades all users to Pro plan:

```bash
node lib/db/migrations/set-all-users-pro.ts
```

### Scheduled Tasks

The scheduled task module can be used in different ways:

1. **Direct execution**: Run manually when needed
   ```bash
   node lib/db/scheduled-tasks/auto-upgrade.ts
   ```

2. **API endpoint**: Call the secure API endpoint
   ```bash
   curl -X GET -H "x-api-key: YOUR_API_KEY" https://your-domain.com/api/admin/upgrade-all-users
   ```

3. **Cron job**: Set up automatic periodic execution (recommended)
   ```bash
   # Run the setup script
   ./scripts/setup-auto-upgrade-cron.sh https://your-domain.com YOUR_API_KEY
   ```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```
ADMIN_API_KEY=your-secure-api-key-here
```

This key is used to authenticate automated calls to the API endpoint.

### Security Considerations

- The API endpoint can only be accessed by:
  - Authenticated users with admin role
  - Automated scripts with the correct API key
- All upgrades are logged for audit purposes

## Troubleshooting

If users are not being upgraded properly, check:

1. Database logs for any SQL errors
2. API logs for authentication issues
3. That the WHERE clause correctly identifies users who should be upgraded

## Development Notes

The SQL query specifically excludes Moonlighting users with this condition:
```sql
WHERE 
  (plan_name IS NULL OR plan_name = 'Free' OR plan_name != 'Moonlighting')
  AND (plan_name != 'Moonlighting')
```

This ensures we don't downgrade paying customers while still upgrading everyone else to Pro. 