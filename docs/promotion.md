# Staging to Production Promotion Guide

Per NFR-R4, no schema migration reaches production unapplied-on-staging.

## 1. Feature Complete & Verified
- All code must be merged to the `main` branch.
- CI pipeline (`ci.yml`) must have passed green (typecheck, lint, vitest for domain, playwright for E2E).

## 2. Staging Deployment
- Vercel automatically deploys the `main` branch to the Staging environment.
- Run migrations against staging first:
  ```bash
  export DATABASE_URL_MIGRATIONS=$STAGING_DB_URL
  pnpm --filter db db:migrate
  ```

## 3. Verify the Demo Path

* Run the E2E pacemaker test against the live staging URL to verify nothing broke integration:
```bash
NEXT_PUBLIC_PRESENT_URL=https://staging.present.example.com pnpm run test:e2e
```


## 4. Production Promotion

* In the Vercel Dashboard, select the successful Staging deployment and click **Promote to Production**.
* Before the site goes live, apply migrations to the production database:
```bash
export DATABASE_URL_MIGRATIONS=$PROD_DB_URL
pnpm --filter db db:migrate
```

* Trigger the projection publisher manually (or modify an entity in CRM) to ensure cache busts correctly.
