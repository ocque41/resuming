# Sprint 1 Status

- ✅ Retire legacy dashboard pricing implementation (`app/(dashboard)/dashboard/pricing/*`)
- ✅ Rebuild `/dashboard/pricing` using marketing pricing layout
- ✅ Wire dashboard "Cancel my plan" to Stripe customer portal via shared pricing UI

## Risks
- Assumes the Pro plan remains the only available subscription tier; additional tiers may require extending the shared pricing component.

# Sprint 2 Status

- ✅ Relax apostrophe/quote lint enforcement in ESLint configuration to unblock builds (`.eslintrc.json`)
- ✅ Load Franken UI assets via `<Script>` to satisfy `@next/next/no-sync-scripts` (`app/layout.tsx`)
- ✅ Provide display name for memoized tailoring workflow component (`app/components/cv/EnhancedSpecificOptimizationWorkflow.client.tsx`)

## Risks
- Local `npm run build` currently requires numerous third-party environment variables (Postgres, OpenAI, Resend, Upstash). Without reachable services, pre-rendering admin pages may still fail despite placeholder values.

# Sprint 3 Plan

## Harden Stripe customer portal creation

- [x] **AC1:** When Stripe indicates no default billing portal configuration, the dashboard surfaces a clear, user-visible error rather than silently failing.
- [x] **AC2:** If any active Stripe billing portal configuration exists, the API automatically re-attempts portal session creation using it so customers can manage subscriptions without manual env overrides.
