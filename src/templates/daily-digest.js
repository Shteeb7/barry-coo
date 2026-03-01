/**
 * Daily digest email template
 * Sent after the daily_briefing task runs with a summary of the day
 */
function renderDailyDigest(data) {
  const { date, reports, escalations, queueStatus, systemHealth } = data;

  const subject = `🎩 Barry's Daily Brief — ${date}`;

  const criticalItems = [
    ...reports.filter(r => r.severity === 'critical'),
    ...escalations.filter(e => e.severity === 'critical' && !e.resolved)
  ];

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
      padding: 32px 24px;
      border-bottom: 1px solid #2a2a3a;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 8px;
      font-size: 24px;
      color: #e8e8f0;
    }
    .header p {
      margin: 0;
      color: #8888a0;
      font-size: 14px;
    }
    .section {
      padding: 24px;
      border-bottom: 1px solid #2a2a3a;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section h2 {
      margin: 0 0 16px;
      font-size: 18px;
      color: #e8e8f0;
    }
    .section p {
      margin: 0 0 12px;
      line-height: 1.6;
      color: #c8c8d0;
    }
    .critical-banner {
      background: #2a1a1a;
      border: 2px solid #EF4444;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .critical-banner h3 {
      margin: 0 0 8px;
      color: #EF4444;
      font-size: 16px;
    }
    .item {
      background: #12121a;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .item h4 {
      margin: 0 0 4px;
      font-size: 14px;
      color: #e8e8f0;
    }
    .item p {
      margin: 0;
      font-size: 13px;
      color: #8888a0;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      margin-left: 8px;
    }
    .badge-critical { background: #EF4444; color: #fff; }
    .badge-warning { background: #F59E0B; color: #fff; }
    .badge-info { background: #6C8EEF; color: #fff; }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }
    .stat {
      background: #12121a;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #e8e8f0;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 12px;
      color: #8888a0;
      text-transform: uppercase;
    }
    .footer {
      background: #12121a;
      padding: 20px 24px;
      border-top: 1px solid #2a2a3a;
      text-align: center;
      font-size: 13px;
      color: #8888a0;
      line-height: 1.6;
    }
    .footer a {
      color: #6C8EEF;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎩 Barry's Daily Brief</h1>
      <p>${date}</p>
    </div>

    ${criticalItems.length > 0 ? `
      <div class="section">
        <div class="critical-banner">
          <h3>🚨 Critical Items Require Attention</h3>
          ${criticalItems.map(item => `
            <div class="item">
              <h4>${item.title || item.task_name}</h4>
              <p>${(item.description || item.summary || '').substring(0, 150)}...</p>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="section">
      <h2>📊 Reports Generated Today</h2>
      ${reports.length > 0 ? reports.map(report => `
        <div class="item">
          <h4>
            ${report.task_name}
            <span class="badge badge-${report.severity}">${report.severity}</span>
          </h4>
          <p>${(report.summary || '').substring(0, 120)}...</p>
        </div>
      `).join('') : '<p>No reports generated today.</p>'}
    </div>

    <div class="section">
      <h2>🚨 Escalations Status</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${escalations.filter(e => !e.acknowledged).length}</div>
          <div class="stat-label">Unacknowledged</div>
        </div>
        <div class="stat">
          <div class="stat-value">${escalations.filter(e => !e.resolved).length}</div>
          <div class="stat-label">Open</div>
        </div>
      </div>
      ${escalations.filter(e => !e.acknowledged).length > 0 ? `
        <div style="margin-top: 12px;">
          ${escalations.filter(e => !e.acknowledged).slice(0, 3).map(e => `
            <div class="item">
              <h4>
                ${e.title}
                <span class="badge badge-${e.severity}">${e.severity}</span>
              </h4>
            </div>
          `).join('')}
        </div>
      ` : '<p style="margin-top: 12px; color: #4ADE80;">All escalations acknowledged. Nice.</p>'}
    </div>

    <div class="section">
      <h2>📬 Queue Status</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${queueStatus.pending || 0}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat">
          <div class="stat-value">${queueStatus.completed || 0}</div>
          <div class="stat-label">Completed Today</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>⚙️ System Health</h2>
      <p>${systemHealth.summary || 'All systems operational.'}</p>
      ${systemHealth.stuckStories > 0 ? `<p style="color: #F59E0B;">⚠️ ${systemHealth.stuckStories} stories stuck in generation</p>` : ''}
    </div>

    <div class="footer">
      <p>Reply to this email to... just kidding, I can't read email yet.</p>
      <p>Open the chat: <a href="https://barry.themythweaver.com/chat.html">barry.themythweaver.com/chat.html</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `
🎩 BARRY'S DAILY BRIEF — ${date}

${criticalItems.length > 0 ? `
🚨 CRITICAL ITEMS REQUIRE ATTENTION

${criticalItems.map(item => `- ${item.title || item.task_name}`).join('\n')}

` : ''}
📊 REPORTS GENERATED TODAY

${reports.length > 0 ? reports.map(r => `${r.task_name} [${r.severity.toUpperCase()}]
${(r.summary || '').substring(0, 100)}...`).join('\n\n') : 'No reports generated today.'}

🚨 ESCALATIONS STATUS

Unacknowledged: ${escalations.filter(e => !e.acknowledged).length}
Open: ${escalations.filter(e => !e.resolved).length}

📬 QUEUE STATUS

Pending: ${queueStatus.pending || 0}
Completed Today: ${queueStatus.completed || 0}

⚙️ SYSTEM HEALTH

${systemHealth.summary || 'All systems operational.'}
${systemHealth.stuckStories > 0 ? `⚠️ ${systemHealth.stuckStories} stories stuck in generation` : ''}

---
Open the chat: https://barry.themythweaver.com/chat.html
`;

  return { subject, html, text };
}

module.exports = { renderDailyDigest };
