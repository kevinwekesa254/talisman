/* Email to the team when a table request arrives.

   Needs BREVO_API_KEY, plus EMAIL_FROM (e.g. "The Talisman <hello@talisman.co.ke>")
   and NOTIFY_EMAIL (who receives it). Without a key nothing is sent. */

const EMAIL_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'The Talisman <hello@talisman.co.ke>';
const SITE = process.env.SITE_URL || 'https://talisman-karen.vercel.app';

function parseFrom(s) { const m = /^(.*)<([^>]+)>$/.exec(s.trim()); return m ? { name: m[1].trim(), email: m[2].trim() } : { email: s.trim() }; }

async function sendEmail({ to, name, subject, html, replyTo }) {
  if (!EMAIL_KEY) return;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': EMAIL_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: parseFrom(EMAIL_FROM), to: [{ email: to, name: name || undefined }], subject, htmlContent: html, replyTo: replyTo ? { email: replyTo } : undefined })
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || ('Email failed (' + r.status + ')')); }
}

module.exports = { sendEmail, SITE };
