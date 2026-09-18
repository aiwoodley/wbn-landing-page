// POST /api/booking -> /.netlify/functions/booking
// The real sales pipeline: a quote/booking request. Notifies WBN via Resend
// so a lead doesn't sit unseen in a database.
const { getSupabaseAdmin } = require("./_supabase");
const { getResend, FROM_ADDRESS } = require("./_resend");
const { isValidEmail, json } = require("./_util");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "invalid_json" });
  }

  const { name, email, interest, details, engagement_snapshot, submitted_at } = body;
  if (!isValidEmail(email) || !name) return json(400, { error: "invalid_submission" });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("bookings").insert({
    name,
    email,
    interest: interest || "unspecified",
    details: details || "",
    engagement_snapshot: engagement_snapshot || null,
    submitted_at: submitted_at || new Date().toISOString(),
  });

  if (error) {
    console.error("supabase insert (bookings) failed", error);
    return json(500, { error: "db_write_failed" });
  }

  const notifyTo = process.env.BOOKING_NOTIFY_EMAIL || "info@woodleysolutions.tech";
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: notifyTo,
      subject: `New WBN booking request: ${interest || "unspecified"} — ${name}`,
      html: `<p><strong>${name}</strong> (${email}) requested: ${interest || "unspecified"}</p>
<p>${(details || "").replace(/</g, "&lt;")}</p>`,
      reply_to: email,
    });
  } catch (e) {
    console.error("resend notify (booking) failed", e);
  }

  return json(200, { ok: true, message: "Booking request captured." });
};
