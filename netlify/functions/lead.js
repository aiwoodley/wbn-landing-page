// POST /api/lead -> /.netlify/functions/lead
// Captures a PDF lead-magnet signup, stores it in Supabase, emails the guide
// via Resend, and hands back a direct download link as a same-request
// fallback so the funnel delivers real value even if the email bounces/delays.
const { getSupabaseAdmin } = require("./_supabase");
const { getResend, FROM_ADDRESS } = require("./_resend");
const { isValidEmail, json } = require("./_util");

const DOWNLOAD_PATH = "/assets/woodley-solutions-home-network-starter-stack.pdf";

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
  const { error: dbError } = await supabase.from("leads").insert({
    email,
    engagement_snapshot: engagement_snapshot || null,
    submitted_at: submitted_at || new Date().toISOString(),
  });
  if (dbError) {
    console.error("supabase insert (leads) failed", dbError);
    return json(500, { error: "db_write_failed" });
  }

  const siteUrl = process.env.SITE_URL || "https://woodleysolutions.tech";
  const downloadUrl = siteUrl + DOWNLOAD_PATH;

  let emailSent = false;
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: "Your Home Network Starter Stack guide",
      html: `<p>Here's your copy of <strong>The Complete Home Network Starter Stack</strong>:</p>
<p><a href="${downloadUrl}">${downloadUrl}</a></p>
<p>Want it built for you instead? Reply to this email or book a build at ${siteUrl}#contact.</p>
<p>— Woodley Solutions</p>`,
    });
    emailSent = true;
  } catch (e) {
    // Don't fail the request over email — the direct download_url below still
    // delivers real value. Log for follow-up once Resend is fully verified.
    console.error("resend send failed", e);
  }

  return json(200, {
    ok: true,
    message: emailSent ? "Lead captured. Guide emailed." : "Lead captured.",
    download_url: downloadUrl,
  });
};
