// Shared Resend client for Netlify Functions.
const { Resend } = require("resend");

let client = null;

function getResend() {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  client = new Resend(apiKey);
  return client;
}

const FROM_ADDRESS = process.env.RESEND_FROM || "Woodley Solutions <info@woodleysolutions.tech>";

module.exports = { getResend, FROM_ADDRESS };
