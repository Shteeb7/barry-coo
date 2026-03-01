const { Resend } = require('resend');

const FROM_EMAIL = process.env.BARRY_FROM_EMAIL || 'barry@themythweaver.com';
const STEVEN_EMAIL = process.env.ALLOWED_EMAILS?.split(',')[0]?.trim() || 'steven.labrum@gmail.com';

let resend = null;

// Initialize Resend only if API key is available
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

/**
 * Send an email via Resend
 * @param {Object} params
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML content
 * @param {string} params.text - Plain text fallback
 * @returns {Promise<{success: boolean, id?: string, reason?: string}>}
 */
async function sendEmail({ subject, html, text }) {
  if (!resend || !process.env.RESEND_API_KEY) {
    console.log('📧 [Barry] Email skipped (no RESEND_API_KEY configured):', subject);
    return { success: false, reason: 'no_api_key' };
  }

  try {
    const result = await resend.emails.send({
      from: `Barry COO <${FROM_EMAIL}>`,
      to: STEVEN_EMAIL,
      subject,
      html,
      text
    });

    console.log(`📧 [Barry] Email sent: "${subject}" → ${STEVEN_EMAIL}`);
    return { success: true, id: result.data?.id || result.id };
  } catch (error) {
    console.error('📧 [Barry] Email send error:', error);
    return { success: false, reason: 'send_error', error: error.message };
  }
}

module.exports = { sendEmail, FROM_EMAIL, STEVEN_EMAIL };
