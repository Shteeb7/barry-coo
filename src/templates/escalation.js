/**
 * Escalation email template
 * For critical/high-severity escalations that need immediate attention
 */
function renderEscalation(escalation) {
  const { title, description, severity, source_task, created_at } = escalation;

  const severityColors = {
    critical: '#EF4444',
    high: '#F59E0B',
    medium: '#6C8EEF',
    low: '#8888A0'
  };

  const severityEmoji = {
    critical: '🚨',
    high: '⚠️',
    medium: 'ℹ️',
    low: '💬'
  };

  const color = severityColors[severity] || severityColors.medium;
  const emoji = severityEmoji[severity] || '💬';

  const subject = `${emoji} Barry: ${title}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f14;
      color: #e8e8f0;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #1a1a24;
      border: 1px solid #2a2a3a;
      border-radius: 12px;
      overflow: hidden;
    }
    .header {
      background: #12121a;
      padding: 24px;
      border-bottom: 1px solid #2a2a3a;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      color: #e8e8f0;
    }
    .header p {
      margin: 8px 0 0;
      color: #8888a0;
      font-size: 14px;
    }
    .severity-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 12px;
    }
    .content {
      padding: 24px;
    }
    .content h2 {
      margin: 0 0 16px;
      font-size: 18px;
      color: #e8e8f0;
    }
    .content p {
      margin: 0 0 16px;
      line-height: 1.6;
      color: #c8c8d0;
    }
    .meta {
      background: #12121a;
      padding: 12px 16px;
      border-radius: 8px;
      margin: 16px 0;
      font-size: 13px;
      color: #8888a0;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: ${color};
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin-top: 8px;
    }
    .footer {
      background: #12121a;
      padding: 16px 24px;
      border-top: 1px solid #2a2a3a;
      text-align: center;
      font-size: 12px;
      color: #555570;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} Escalation</h1>
      <p>Hey meatbag, something needs your attention.</p>
      <span class="severity-badge" style="background: ${color}; color: #ffffff;">${severity.toUpperCase()}</span>
    </div>
    <div class="content">
      <h2>${title}</h2>
      <p>${description.replace(/\n/g, '<br>')}</p>
      ${source_task ? `<div class="meta">Source task: <strong>${source_task}</strong></div>` : ''}
      <div class="meta">Created: ${new Date(created_at).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Denver'
      })} MT</div>
      <a href="https://themythweaver.com/dashboard" class="btn">View in Dashboard</a>
    </div>
    <div class="footer">
      This is an automated alert from Barry COO. You're receiving this because something actually matters.
    </div>
  </div>
</body>
</html>`;

  const text = `
${emoji} ESCALATION: ${title}

Severity: ${severity.toUpperCase()}

${description}

${source_task ? `Source task: ${source_task}\n` : ''}
Created: ${new Date(created_at).toLocaleString('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Denver'
})} MT

View in Dashboard: https://themythweaver.com/dashboard

---
This is an automated alert from Barry COO.
`;

  return { subject, html, text };
}

module.exports = { renderEscalation };
