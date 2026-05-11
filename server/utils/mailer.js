const { Resend } = require('resend');

let resend = null;

/**
 * Initialize Resend client
 * Gracefully skips if no API key is configured
 */
function init() {
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('📧 Resend email alerts initialized');
  } else {
    console.log('📧 Resend API key not set — email alerts disabled');
  }
}

/**
 * Send a "down" alert email when an endpoint fails
 * @param {Object} endpoint - The endpoint document
 * @param {Object} ping - The failed ping document
 */
async function sendDownAlert(endpoint, ping) {
  if (!resend || !endpoint.alertEmail) return;

  try {
    await resend.emails.send({
      from: 'API Health Observatory <onboarding@resend.dev>',
      to: endpoint.alertEmail,
      subject: `🔴 DOWN: ${endpoint.name}`,
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F1117; color: #fff; padding: 32px; border-radius: 12px;">
          <h1 style="color: #E24B4A; font-size: 24px; margin-bottom: 8px;">🔴 Endpoint Down</h1>
          <h2 style="color: #fff; font-size: 18px; margin-bottom: 24px;">${endpoint.name}</h2>
          
          <div style="background: #1A1D27; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
            <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">URL</p>
            <p style="color: #fff; margin: 0 0 16px 0; word-break: break-all;">${endpoint.method} ${endpoint.url}</p>
            
            <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Status Code Received</p>
            <p style="color: #E24B4A; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">${ping.statusCode || 'N/A (Connection Error)'}</p>
            
            <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Expected Status</p>
            <p style="color: #1D9E75; margin: 0 0 16px 0;">${endpoint.expectedStatus}</p>
            
            ${ping.error ? `
            <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Error</p>
            <p style="color: #EF9F27; margin: 0 0 16px 0;">${ping.error}</p>
            ` : ''}
            
            <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Timestamp</p>
            <p style="color: #9CA3AF; margin: 0;">${new Date(ping.timestamp).toISOString()}</p>
          </div>
          
          <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 24px;">
            Sent by API Health Observatory
          </p>
        </div>
      `,
    });
    console.log(`📧 Down alert sent to ${endpoint.alertEmail} for "${endpoint.name}"`);
  } catch (err) {
    console.error('Failed to send alert email:', err.message);
  }
}

/**
 * Send a "recovery" alert email when an endpoint comes back up
 */
async function sendRecoveryAlert(endpoint, ping) {
  if (!resend || !endpoint.alertEmail) return;

  try {
    await resend.emails.send({
      from: 'API Health Observatory <onboarding@resend.dev>',
      to: endpoint.alertEmail,
      subject: `🟢 RECOVERED: ${endpoint.name}`,
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F1117; color: #fff; padding: 32px; border-radius: 12px;">
          <h1 style="color: #1D9E75; font-size: 24px; margin-bottom: 8px;">🟢 Endpoint Recovered</h1>
          <h2 style="color: #fff; font-size: 18px; margin-bottom: 24px;">${endpoint.name}</h2>
          
          <div style="background: #1A1D27; padding: 20px; border-radius: 8px;">
            <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">URL</p>
            <p style="color: #fff; margin: 0 0 16px 0;">${endpoint.method} ${endpoint.url}</p>
            
            <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Status Code</p>
            <p style="color: #1D9E75; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">${ping.statusCode}</p>
            
            <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Latency</p>
            <p style="color: #fff; margin: 0 0 16px 0;">${ping.latencyMs}ms</p>
            
            <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Recovered At</p>
            <p style="color: #9CA3AF; margin: 0;">${new Date(ping.timestamp).toISOString()}</p>
          </div>
          
          <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 24px;">
            Sent by API Health Observatory
          </p>
        </div>
      `,
    });
    console.log(`📧 Recovery alert sent to ${endpoint.alertEmail} for "${endpoint.name}"`);
  } catch (err) {
    console.error('Failed to send recovery email:', err.message);
  }
}

module.exports = { init, sendDownAlert, sendRecoveryAlert };
