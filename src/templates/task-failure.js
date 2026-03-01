/**
 * Task failure email template
 * When a scheduled task fails or hits the circuit breaker
 */
function renderTaskFailure(data) {
  const { taskName, error, retryCount, maxRetries, failedAt, isPermanent } = data;

  const subject = isPermanent
    ? `🛑 Barry: Task "${taskName}" permanently failed`
    : `⚠️ Barry: Task "${taskName}" failed`;

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
      background: ${isPermanent ? '#2a1a1a' : '#2a2214'};
      padding: 24px;
      border-bottom: 1px solid ${isPermanent ? '#EF4444' : '#F59E0B'};
    }
    .header h1 {
      margin: 0 0 8px;
      font-size: 20px;
      color: #e8e8f0;
    }
    .header p {
      margin: 0;
      color: ${isPermanent ? '#EF4444' : '#F59E0B'};
      font-size: 14px;
      font-weight: 600;
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
    .code-block {
      background: #12121a;
      border: 1px solid #2a2a3a;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #EF4444;
      overflow-x: auto;
    }
    .meta {
      background: #12121a;
      padding: 12px 16px;
      border-radius: 8px;
      margin: 16px 0;
      font-size: 13px;
      color: #8888a0;
    }
    .meta strong {
      color: #e8e8f0;
    }
    .warning-box {
      background: #2a2214;
      border-left: 4px solid #F59E0B;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }
    .warning-box p {
      margin: 0;
      color: #F59E0B;
      font-weight: 600;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: #6C8EEF;
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
      <h1>${isPermanent ? '🛑' : '⚠️'} Task Failure</h1>
      <p>${taskName}</p>
    </div>
    <div class="content">
      ${isPermanent ? `
        <h2>I've stopped retrying.</h2>
        <p>The scheduled task "${taskName}" has failed ${maxRetries} times consecutively. This needs a code fix, not more attempts.</p>
        <div class="warning-box">
          <p>⚠️ Task has been automatically disabled to prevent further failures.</p>
        </div>
      ` : `
        <h2>Scheduled task failed</h2>
        <p>The task "${taskName}" encountered an error during execution. I'll retry, but you should know about this.</p>
        <div class="meta">
          <strong>Retry count:</strong> ${retryCount} / ${maxRetries}
        </div>
      `}

      <h2>Error Details</h2>
      <div class="code-block">${error}</div>

      <div class="meta">
        <strong>Failed at:</strong> ${new Date(failedAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'America/Denver'
        })} MT
      </div>

      ${isPermanent ? `
        <p>Next steps:</p>
        <ul style="color: #c8c8d0; line-height: 1.8;">
          <li>Check the error message above for clues</li>
          <li>Review the task configuration in the database</li>
          <li>Fix the underlying issue</li>
          <li>Re-enable the task manually once fixed</li>
        </ul>
      ` : `
        <p>I'll automatically retry ${maxRetries - retryCount} more time${maxRetries - retryCount === 1 ? '' : 's'}. If it keeps failing, I'll disable the task and escalate.</p>
      `}

      <a href="https://themythweaver.com/dashboard" class="btn">View in Dashboard</a>
    </div>
    <div class="footer">
      This is an automated alert from Barry COO.
    </div>
  </div>
</body>
</html>`;

  const text = `
${isPermanent ? '🛑' : '⚠️'} TASK FAILURE: ${taskName}

${isPermanent ? `
I've stopped retrying. This task has failed ${maxRetries} times consecutively and needs a code fix.

⚠️ Task has been automatically disabled.
` : `
The scheduled task "${taskName}" encountered an error during execution.

Retry count: ${retryCount} / ${maxRetries}
`}

ERROR DETAILS:
${error}

Failed at: ${new Date(failedAt).toLocaleString('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Denver'
})} MT

${isPermanent ? `
Next steps:
- Check the error message above
- Review the task configuration
- Fix the underlying issue
- Re-enable the task manually once fixed
` : `
I'll automatically retry ${maxRetries - retryCount} more time${maxRetries - retryCount === 1 ? '' : 's'}.
`}

View in Dashboard: https://themythweaver.com/dashboard

---
This is an automated alert from Barry COO.
`;

  return { subject, html, text };
}

module.exports = { renderTaskFailure };
