const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialize Nodemailer transporter with Gmail SMTP
 * Requires SMTP_USER (your Gmail) and SMTP_PASS (Google App Password)
 */
function init() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    console.log('📧 Nodemailer (Gmail) email alerts initialized');
  } else {
    console.log('📧 SMTP credentials not set — email alerts disabled');
  }
}

/**
 * Send a "down" alert email when an endpoint is confirmed DOWN
 * @param {Object} endpoint - The endpoint document
 * @param {Object} incident - The incident document
 */
async function sendDownAlert(endpoint, incident) {
  if (!transporter || !endpoint.alertEmail) return;

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from: `PRISM Alerts <${fromAddress}>`,
      to: endpoint.alertEmail,
      subject: `🔴 DOWN: ${endpoint.name}`,
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #001E2B; color: #E0F2F1; padding: 32px; border-radius: 12px;">
          <h1 style="color: #FF4757; font-size: 24px; margin-bottom: 8px;">🔴 Endpoint Down</h1>
          <h2 style="color: #E0F2F1; font-size: 18px; margin-bottom: 24px;">${endpoint.name}</h2>
          
          <div style="background: #002B3D; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">URL</p>
            <p style="color: #E0F2F1; margin: 0 0 16px 0; word-break: break-all;">${endpoint.method} ${endpoint.url}</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Reason</p>
            <p style="color: #FF4757; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">${incident.reason || 'Unknown'}</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Expected Status</p>
            <p style="color: #00ED64; margin: 0 0 16px 0;">${endpoint.expectedStatus}</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Confirmed Down After</p>
            <p style="color: #FFB647; margin: 0 0 16px 0;">3 consecutive failures</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Started At</p>
            <p style="color: #B2DFDB; margin: 0;">${new Date(incident.startedAt).toISOString()}</p>
          </div>
          
          <p style="color: #4DB6AC; font-size: 12px; text-align: center; margin-top: 24px;">
            Sent by PRISM — Proactive Request Inspection & Status Monitor
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
 * Send a "recovery" alert email when an endpoint is confirmed back UP
 * @param {Object} endpoint - The endpoint document
 * @param {Object} incident - The resolved incident document
 */
async function sendRecoveryAlert(endpoint, incident) {
  if (!transporter || !endpoint.alertEmail) return;

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  const duration = incident.resolvedAt && incident.startedAt
    ? formatDuration(new Date(incident.resolvedAt) - new Date(incident.startedAt))
    : 'Unknown';

  try {
    await transporter.sendMail({
      from: `PRISM Alerts <${fromAddress}>`,
      to: endpoint.alertEmail,
      subject: `🟢 RECOVERED: ${endpoint.name}`,
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #001E2B; color: #E0F2F1; padding: 32px; border-radius: 12px;">
          <h1 style="color: #00ED64; font-size: 24px; margin-bottom: 8px;">🟢 Endpoint Recovered</h1>
          <h2 style="color: #E0F2F1; font-size: 18px; margin-bottom: 24px;">${endpoint.name}</h2>
          
          <div style="background: #002B3D; padding: 20px; border-radius: 8px;">
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">URL</p>
            <p style="color: #E0F2F1; margin: 0 0 16px 0;">${endpoint.method} ${endpoint.url}</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Downtime Duration</p>
            <p style="color: #FFB647; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">${duration}</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Total Failures During Outage</p>
            <p style="color: #E0F2F1; margin: 0 0 16px 0;">${incident.failureCount || 0}</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Resolved At</p>
            <p style="color: #B2DFDB; margin: 0;">${new Date(incident.resolvedAt).toISOString()}</p>
          </div>
          
          <p style="color: #4DB6AC; font-size: 12px; text-align: center; margin-top: 24px;">
            Sent by PRISM — Proactive Request Inspection & Status Monitor
          </p>
        </div>
      `,
    });
    console.log(`📧 Recovery alert sent to ${endpoint.alertEmail} for "${endpoint.name}"`);
  } catch (err) {
    console.error('Failed to send recovery email:', err.message);
  }
}

/**
 * Send a "degraded performance" alert email when an endpoint responds
 * successfully but slower than the user's expected response time.
 * @param {Object} endpoint - The endpoint document
 * @param {Object} ping - The ping document with latency info
 */
async function sendDegradedAlert(endpoint, ping) {
  if (!transporter || !endpoint.alertEmail) return;

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  const expectedSec = ((endpoint.expectedResponseMs || 5000) / 1000).toFixed(1);
  const actualSec = ((ping.latencyMs || 0) / 1000).toFixed(1);

  try {
    await transporter.sendMail({
      from: `PRISM Alerts <${fromAddress}>`,
      to: endpoint.alertEmail,
      subject: `⚠️ SLOW: ${endpoint.name}`,
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #001E2B; color: #E0F2F1; padding: 32px; border-radius: 12px;">
          <h1 style="color: #FFB647; font-size: 24px; margin-bottom: 8px;">⚠️ Performance Degraded</h1>
          <h2 style="color: #E0F2F1; font-size: 18px; margin-bottom: 24px;">${endpoint.name}</h2>
          
          <div style="background: #002B3D; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">URL</p>
            <p style="color: #E0F2F1; margin: 0 0 16px 0; word-break: break-all;">${endpoint.method} ${endpoint.url}</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Actual Response Time</p>
            <p style="color: #FFB647; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">${actualSec}s</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Expected Response Time</p>
            <p style="color: #00ED64; margin: 0 0 16px 0;">${expectedSec}s</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Status Code</p>
            <p style="color: #E0F2F1; margin: 0 0 16px 0;">${ping.statusCode || 'N/A'}</p>
            
            <p style="color: #80CBC4; font-size: 12px; text-transform: uppercase; margin: 0 0 4px 0;">Detected At</p>
            <p style="color: #B2DFDB; margin: 0;">${new Date(ping.timestamp).toISOString()}</p>
          </div>
          
          <p style="color: #FFB647; font-size: 13px; text-align: center; margin-top: 16px; padding: 12px; background: rgba(255,182,71,0.1); border-radius: 8px;">
            Your API is still responding correctly, but slower than your expected threshold. No downtime has been recorded.
          </p>
          
          <p style="color: #4DB6AC; font-size: 12px; text-align: center; margin-top: 24px;">
            Sent by PRISM — Proactive Request Inspection & Status Monitor
          </p>
        </div>
      `,
    });
    console.log(`📧 Degraded alert sent to ${endpoint.alertEmail} for "${endpoint.name}"`);
  } catch (err) {
    console.error('Failed to send degraded alert email:', err.message);
  }
}

/**
 * Format milliseconds into human-readable duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

module.exports = { init, sendDownAlert, sendRecoveryAlert, sendDegradedAlert };

