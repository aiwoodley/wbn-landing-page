# Woodley Solutions — Landing Page

Lead-capture landing page for **Woodley Solutions**. Cinematic dark landing
page + PDF lead magnet + returning-visitor personalization + booking
pipeline, deployed on:

- **Netlify** — static site hosting + serverless Functions (`netlify/functions/`)
- **Supabase** — Postgres database (leads, newsletter subscribers, bookings, orders)
- **Resend** — transactional email (guide delivery, booking notifications, receipts)
- **Stripe** — one-time payment checkout for the premium guide
- **GoDaddy** — DNS for `woodleysolutions.tech`

## Local development

```bash
npm install
netlify dev
```

`netlify dev` serves `index.html`/`style.css`/`script.js` statically and runs
the functions in `netlify/functions/` locally, proxying `/api/*` per the
redirects in `netlify.toml`. It reads environment variables from a local
`.env` file (copy `.env.example` — never commit the filled-in version) or
from `netlify env:import`.

## Environment variables (set in Netlify: Site settings → Environment variables)

See `.env.example` for the full list. Required per provider:

- **Supabase**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role —
  server-side only, never shipped to the browser)
- **Resend**: `RESEND_API_KEY`, `RESEND_FROM`, `BOOKING_NOTIFY_EMAIL`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Site**: `SITE_URL` (used to build absolute links in emails/checkout redirects)

## Database schema

Run `supabase/schema.sql` in the Supabase SQL editor (or `supabase db push`
once the project is linked) before the functions can write anything. Tables:
`leads`, `newsletter_subscribers`, `bookings`, `orders`. RLS is enabled with
no anon policies — the public site never talks to Supabase directly, only
through the service-role-authenticated Netlify Functions.

## Stripe webhook

After the first deploy, add a webhook endpoint in the Stripe dashboard
pointing at `https://<your-domain>/api/stripe-webhook`, subscribed to
`checkout.session.completed`. Copy the signing secret into
`STRIPE_WEBHOOK_SECRET`.

## Resend domain verification

Add `woodleysolutions.tech` in the Resend dashboard and add the DKIM/SPF/
tracking DNS records it gives you to the GoDaddy DNS zone — required before
`RESEND_FROM` can send as `info@woodleysolutions.tech` instead of a
resend.dev sandbox address.

## The PDF lead magnet

`assets/woodley-solutions-home-network-starter-stack.pdf` is the real Guide 1
of 4 in the Home Network Series ("The Complete Home Network Starter Stack").
`guide_content.md` / `build_pdf_spec.py` / `guide_spec.json` are leftover
tooling from an earlier draft-generation pass and are not what's currently
served — kept only as a reference workflow for authoring future guides in
the series (2: NAS/Jellyfin, 3: local AI, 4: self-hosted video/security).

## Personalization

`script.js` tracks per-browser engagement (localStorage) — which sections a
visitor dwelt on and which CTAs they clicked — and rewrites the hero
headline/subhead/CTA on their next visit toward whichever service (security,
connectivity, monitoring) or the guide they showed the most interest in.
This is per-browser, not per-person (no cross-device identity).
