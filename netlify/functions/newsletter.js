// POST /api/newsletter -> /.netlify/functions/newsletter
// Separate opt-in list from the PDF lead magnet.
const { getSupabaseAdmin } = require("./_supabase");
const { isValidEmail, json } = require("./_util");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "invalid_json" });
  }

  const { email, engagement_snapshot, submitted_at } = body;
  if (!isValidEmail(email)) return json(400, { error: "invalid_email" });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("newsletter_subscribers").upsert(
    {
      email,
      engagement_snapshot: engagement_snapshot || null,
      submitted_at: submitted_at || new Date().toISOString(),
    },
    { onConflict: "email" }
  );

  if (error) {
    console.error("supabase upsert (newsletter_subscribers) failed", error);
    return json(500, { error: "db_write_failed" });
  }

  return json(200, { ok: true, message: "Subscribed." });
};
