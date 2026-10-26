// Netlify runs this automatically after every verified (non-spam) form submission.
// For the homepage "inquiry" form it sends the person an instant confirmation
// email tailored to what they asked for. The team alert is handled separately by
// the site's Netlify email notification to info@woodleysolutions.tech.
const { getResend, FROM_ADDRESS } = require("./_resend");
const { isValidEmail } = require("./_util");

const NEXT_STEPS = {
  "Free audit":
    "We'll review your website, Google and map listings, reviews and social, then email your 0–10 scorecard and top five fixes within three business days.",
  "Website & listings":
    "We'll look at what you have now and reply within one business day with a few questions and a time for a short call.",
  "Social media":
    "We'll look at your current profiles and reply within one business day with a few questions and a time for a short call.",
  "Paid ads":
    "We'll reply within one business day to learn your goals and budget. Ads always run from an ad account in your name, so you see every dollar.",
  "Event sponsorships":
    "We'll reply within one business day to learn about your event, audience and dates, so we can see which brands are a fit.",
};

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || "{}").payload || {};
  } catch (e) {
    return { statusCode: 200, body: "ignored: bad json" };
  }
  if (payload.form_name !== "inquiry") return { statusCode: 200, body: "ignored: other form" };

  const d = payload.data || {};
  const email = (d.email || "").trim();
  if (!isValidEmail(email)) return { statusCode: 200, body: "ignored: no email" };

  const need = NEXT_STEPS[d.need] ? d.need : "Free audit";
  const first = esc((d.name || "").trim().split(/\s+/)[0] || "there");

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#14213D;max-width:560px">
<p>Hi ${first},</p>
<p>Thanks for reaching out about <strong>${esc(need.toLowerCase())}</strong>${d.business ? ` for ${esc(d.business)}` : ""}. We got your request.</p>
<p><strong>What happens next:</strong> ${esc(NEXT_STEPS[need])}</p>
<p>If anything is time-sensitive, just reply to this email.</p>
<p>Paul &amp; Peter Woodley<br>Woodley Solutions<br><a href="https://woodleysolutions.tech" style="color:#8A6224">woodleysolutions.tech</a></p>
</div>`;
  const text = `Hi ${first},\n\nThanks for reaching out about ${need.toLowerCase()}${d.business ? ` for ${d.business}` : ""}. We got your request.\n\nWhat happens next: ${NEXT_STEPS[need]}\n\nIf anything is time-sensitive, just reply to this email.\n\nPaul & Peter Woodley\nWoodley Solutions\nwoodleysolutions.tech`;

  try {
    await getResend().emails.send({
      from: FROM_ADDRESS,
      to: email,
      replyTo: "info@woodleysolutions.tech",
      subject: "We got your request | Woodley Solutions",
      html,
      text,
    });
    return { statusCode: 200, body: "confirmation sent" };
  } catch (e) {
    // Never fail the submission over email; the team alert still fires.
    console.error("confirmation email failed", e && e.message);
    return { statusCode: 200, body: "confirmation failed" };
  }
};
