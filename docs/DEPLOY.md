# FavorBank – Deploy to Vercel

This guide walks you through a clean deploy with Stripe + PlanetScale and Vercel Cron.

## 1) Environment variables (Vercel → Settings → Environment Variables)

Required:
- `DATABASE_URL`: PlanetScale connection string (use `sslaccept=strict`)
- `NEXTAUTH_SECRET`: 32-byte random string
- `NEXTAUTH_URL`: your production URL (e.g., `https://app.example.com`)
- `STRIPE_SECRET_KEY`: your Stripe secret key (starts with `sk_`)
- `STRIPE_WEBHOOK_SECRET`: from Stripe webhook UI (see below)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: your Stripe publishable key (starts with `pk_`)

## 2) PlanetScale / Prisma
- Create DB in PlanetScale, set `DATABASE_URL`
- Run `npx prisma generate` locally and `npx prisma db push` (or via CI) so tables exist
- Optionally run seed endpoint locally (see below)

## 3) Stripe webhook
- Add a webhook endpoint in Stripe Dashboard: `https://YOUR_DOMAIN/api/stripe/webhook`
- Events: `checkout.session.completed`, `invoice.paid`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`

## 4) Vercel Cron
Using `vercel.json`, set schedules:
- `/api/cron/expire` (every 30 min)
- `/api/cron/loan-repay` (daily morning)
- `/api/cron/disputes-auto` (hourly)
- `/api/cron/pro-payout` (Mondays)
- `/api/cron/demurrage` (1st of month)

In Vercel, Cron can be configured via the UI or by keeping `vercel.json` in repo.

## 5) Seeding demo data
A simple seed route is available for demos/dev:
- POST `https://YOUR_DOMAIN/api/dev/seed`
- Default users: `alice@example.com`, `bob@example.com` (password: `password123`)
- Creates two circles, treasury funds, Pro profile, Plus subscription, example slots/requests

Disable seeding in production by leaving `ALLOW_SEED` unset (default). To allow once, set `ALLOW_SEED=true`, call the route, then remove it.

## 6) Post-deploy smoke test
Run through these end-to-end checks:
1. Sign in as demo user; join the demo circle if needed
2. Buy credits (Stripe test card `4242 4242 4242 4242`) and verify balance increases
3. Post a request; from the other user, submit an offer; accept
4. Or book a SlotShop slot; confirm escrow lock happens
5. Check-in, finish, release credits; see ledger and reciprocity update
6. File a Guaranteed claim (simulated) and auto-resolve small dispute (< 50 credits)
7. Pro bonus accrual appears for completed booking of Pro user
8. Treasury match (if enabled) deposits matched credits to helper
9. Plus benefits: monthly credit grant; fee waiver behavior where applicable
10. Notifications: in-app toasts for offers/reminders; test email digest endpoint

If any step fails, check server logs and Stripe/DB dashboards.

## 7) Domains
Attach your domain in Vercel. Ensure `NEXTAUTH_URL` reflects your canonical URL.

## 8) Security & safety
- Keep `ALLOW_SEED` disabled in production
- Review House Rules and Terms links in footer
- Confirm aXe audit on `/test/a11y` shows no critical issues on your key flows

---

Happy launch! 🎉

