// POST /api/stripe-webhook -> /.netlify/functions/stripe-webhook
// Verifies the Stripe signature, records the order in Supabase, and (on
// success) emails the premium guide via Resend. Configure this URL in the
// Stripe dashboard (Developers > Webhooks) once deployed, and set
// STRIPE_WEBHOOK_SECRET from the signing secret Stripe gives you there.
const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./_supabase");
const { getResend, FROM_ADDRESS } = require("./_resend");
const { json } = require("./_util");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) return json(500, { error: "stripe_not_configured" });

  const stripe = new Stripe(secretKey);
  const sig = event.headers["stripe-signature"];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error("stripe webhook signature verification failed", err);
    return json(400, { error: "invalid_signature" });
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const email = session.customer_email || session.metadata?.email;
    const product = session.metadata?.product || "premium_guide";

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("orders").upsert(
      {
        email,
        product,
        amount_cents: session.amount_total,
        currency: session.currency,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
        status: "paid",
        paid_at: new Date().toISOString(),
      },
      { onConflict: "stripe_checkout_session_id" }
    );
    if (error) console.error("supabase upsert (orders) failed", error);

    if (email) {
      try {
        const resend = getResend();
        await resend.emails.send({
          from: FROM_ADDRESS,
          to: email,
          subject: "Your Woodley Solutions Premium Guide",
          html: `<p>Thanks for the purchase — your premium guide is on its way.</p>
<p>If you don't see the attachment shortly, reply to this email and we'll resend it directly.</p>
<p>— Woodley Solutions</p>`,
          // NOTE: attach the actual premium PDF here once it's written, e.g.
          // attachments: [{ filename: 'woodley-solutions-premium-guide.pdf', path: '<url or base64>' }]
        });
      } catch (e) {
        console.error("resend send (premium guide) failed", e);
      }
    }
  }

  return json(200, { received: true });
};
