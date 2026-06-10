# Holo Card Studio — World Cup 2026

Create a personalized holographic World Cup trading card and download a 10s holo video. Purchases are processed by Stripe; net proceeds are donated to [San Francisco Youth Soccer](https://www.sfyouthsoccer.org/donate).

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_…` or `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Yes (prod) | Webhook signing secret from Stripe Dashboard |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public URL, e.g. `https://yourdomain.com` |

## Stripe setup

1. Create a [Stripe account](https://dashboard.stripe.com/register) and complete verification.
2. Copy **Secret key** from Developers → API keys into `STRIPE_SECRET_KEY`.
3. For local webhook testing, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

4. In production, add a webhook endpoint in Stripe Dashboard:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`

5. Test with card number `4242 4242 4242 4242`, any future expiry, any CVC.

## Purchase flow

1. User designs a card and clicks **Buy Card — $2**
2. App creates a Stripe Checkout Session via `/api/checkout`
3. User pays on Stripe’s hosted page
4. On return, `/api/checkout/verify` confirms payment
5. App renders the holo video and triggers download

## Deploy

Works on Vercel or any Node host that supports Next.js App Router.

1. Set environment variables in your host
2. `npm run build && npm start`
3. Add production webhook URL in Stripe
4. Switch Stripe keys from test to live when ready

## Donations to SFYS

Track Stripe payouts in your dashboard and donate net proceeds to SFYS via their [donate page](https://www.sfyouthsoccer.org/donate) (PayPal) or by check:

> SF Youth Soccer, 1434 Taraval, San Francisco, CA 94116

Tax ID: 94-3322034
