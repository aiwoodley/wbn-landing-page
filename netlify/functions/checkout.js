// POST /api/checkout -> /.netlify/functions/checkout
// Creates a Stripe Checkout session for the premium guide (one-time payment).
// Extend `PRODUCTS` if/when a booking deposit or other paid item is added.
const Stripe = require("stripe");
const { isValidEmail, json } = require("./_util");

const PRODUCTS = {
  premium_guide: {
    name: "Woodley Solutions Premium Home Network Guide",
    description:
      "Expanded edition: VLAN segmentation, Suricata IDS/IPS, Frigate NVR builds, and our client audit-report templates.",
    amount_cents: 1999, // $19.99 — adjust in Stripe/env once final pricing is set
  },
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(500, { error: "stripe_not_configured" });
  const stripe = new Stripe(secretKey);

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "invalid_json" });
  }

  const { email, product = "premium_guide" } = body;
  if (!isValidEmail(email)) return json(400, { error: "invalid_email" });
  const item = PRODUCTS[product];
  if (!item) return json(400, { error: "unknown_product" });

  const siteUrl = process.env.SITE_URL || "https://woodleysolutions.tech";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: item.name, description: item.description },
          unit_amount: item.amount_cents,
        },
        quantity: 1,
      },
    ],
    metadata: { product, email },
    success_url: `${siteUrl}/?checkout=success#premium-upsell`,
    cancel_url: `${siteUrl}/?checkout=cancelled#guide`,
  });

  return json(200, { ok: true, checkout_url: session.url });
};
