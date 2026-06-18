import { Resend } from 'resend';
import { prisma } from './db';
import { marked } from 'marked';

export async function sendDigest() {
  console.log('[sendDigest] Starting email delivery process...');
  const resendKey = process.env.RESEND_API_KEY;
  const digestEmail = process.env.DIGEST_EMAIL;

  if (!resendKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }
  if (!digestEmail) {
    throw new Error('DIGEST_EMAIL is not configured.');
  }

  const resend = new Resend(resendKey);

  // 1. Fetch latest brief
  const latestBrief = await prisma.dailyBrief.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!latestBrief) {
    console.log('[sendDigest] No brief found to send.');
    return { success: false, error: 'No briefs generated yet.' };
  }

  // 2. Fetch pending findings to mark as delivered
  const pendingFindings = await prisma.finding.findMany({
    where: { delivered: false },
    select: { id: true }
  });

  // 3. Render HTML
  const htmlContent = await marked.parse(latestBrief.content);

  // Provide basic styling for email clients
  const styledHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111; border-bottom: 1px solid #eee; padding-bottom: 10px;">Daily Portfolio Disruption Brief</h1>
        <div style="margin-top: 20px;">
          ${htmlContent}
        </div>
        <p style="margin-top: 40px; font-size: 12px; color: #888;">
          Generated automatically by your Disruption Radar
        </p>
      </body>
    </html>
  `;

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const subject = `Daily Portfolio Disruption Brief - ${dateStr}`;

  console.log(`[sendDigest] Dispatching email to ${digestEmail}...`);

  // 4. Send via Resend
  const { data, error } = await resend.emails.send({
    from: 'Disruption Radar <onboarding@resend.dev>',
    to: digestEmail,
    subject: subject,
    html: styledHtml,
  });

  if (error) {
    console.error('[sendDigest] Resend failed:', error);
    throw new Error(error.message);
  }

  console.log(`[sendDigest] Successfully sent email. ID: ${data?.id}`);

  // 5. Mark as delivered
  if (pendingFindings.length > 0) {
    const findingIds = pendingFindings.map(f => f.id);
    await prisma.finding.updateMany({
      where: { id: { in: findingIds } },
      data: { delivered: true }
    });
    console.log(`[sendDigest] Marked ${findingIds.length} findings as delivered.`);
  }

  return { success: true, emailId: data?.id };
}
