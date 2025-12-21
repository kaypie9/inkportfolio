import { Resend } from 'resend';

const resendKey = process.env.RESEND_API_KEY;

if (!resendKey) {
  console.warn('RESEND_API_KEY is not set');
}

const resend = resendKey ? new Resend(resendKey) : null;

type FeedbackPayload = {
  message: string;
  category: string;
  contact: string;
  wallet: string | null;
};

export async function sendFeedbackEmail(payload: FeedbackPayload) {
  if (!resend) return;

  const to = process.env.FEEDBACK_EMAIL_TO;
  const from = process.env.FEEDBACK_EMAIL_FROM || 'feedback@inkfolio.xyz';

  if (!to) {
    console.warn('FEEDBACK_EMAIL_TO is not set, skipping email');
    return;
  }

  const createdAt = new Date().toISOString();

  const subject = `[ink feedback] ${payload.category || 'feedback'}`;

  const textLines = [
    `New feedback on ink dashboard`,
    ``,
    `Message:`,
    payload.message,
    ``,
    `Category: ${payload.category || 'n/a'}`,
    `Contact: ${payload.contact || 'n/a'}`,
    `Wallet: ${payload.wallet || 'n/a'}`,
    `Time: ${createdAt}`,
  ];

  const text = textLines.join('\n');

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #0f172a;">
      <h2 style="margin: 0 0 12px 0;">New feedback on ink dashboard</h2>

      <p style="margin: 0 0 8px 0;"><strong>Category</strong>: ${payload.category || 'n/a'}</p>
      <p style="margin: 0 0 8px 0;"><strong>Contact</strong>: ${payload.contact || 'n/a'}</p>
      <p style="margin: 0 0 8px 0;"><strong>Wallet</strong>: ${payload.wallet || 'n/a'}</p>
      <p style="margin: 0 0 12px 0;"><strong>Time</strong>: ${createdAt}</p>

      <div style="margin-top: 16px;">
        <div style="font-weight: 600; margin-bottom: 4px;">Message</div>
        <div style="white-space: pre-wrap; border-radius: 8px; padding: 10px 12px; background: #f3f4f6; border: 1px solid #e5e7eb;">
          ${payload.message
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}
        </div>
      </div>
    </div>
  `;

  await resend.emails.send({
    from,
    to,
    subject,
    text,
    html,
  });
}
