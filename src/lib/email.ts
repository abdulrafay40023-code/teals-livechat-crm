import nodemailer from 'nodemailer';

export const GMAIL_USER = process.env.GMAIL_USER || 'garryamelia6265@gmail.com';
export const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS || 'ogdixmwirfmoadbs';

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASS,
  },
});

export interface BookingEmailParams {
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  date: string;
  time: string;
  clientDate?: string;
  clientTime?: string;
  visitorTimezone?: string;
  pktDate?: string;
  pktTime?: string;
  service?: string;
  websiteName?: string;
  websiteUrl?: string;
  adminEmail?: string;
  agentEmail?: string;
  agentName?: string;
  conversationId?: string;
}

/**
 * 1. Dispatches confirmation email to Visitor
 */
export async function sendBookingConfirmationToVisitor({
  visitorName,
  visitorEmail,
  visitorPhone,
  date,
  time,
  clientDate,
  clientTime,
  visitorTimezone,
  service = 'E-commerce Consultation',
  websiteName = 'AMZ Solutions Hub',
}: BookingEmailParams) {
  if (!visitorEmail || !visitorEmail.includes('@')) return false;

  const displayDate = clientDate || date;
  const displayTime = clientTime || time;
  const displayTz = visitorTimezone ? visitorTimezone.replace('_', ' ') : 'Your Local Time';

  const mailOptions = {
    from: `"${websiteName}" <${GMAIL_USER}>`,
    to: visitorEmail,
    subject: `Meeting Request Received: 1-on-1 Consultation with ${websiteName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b1120; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="text-align: center; padding-bottom: 24px; border-bottom: 1px solid #1e293b;">
          <h1 style="color: #38bdf8; margin: 0 0 8px 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">${websiteName}</h1>
          <p style="color: #94a3b8; margin: 0; font-size: 14px;">Consultation & Custom Quote Request</p>
        </div>

        <div style="padding: 24px 0;">
          <div style="margin-bottom: 12px;">
            <span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(245, 158, 11, 0.4); text-transform: uppercase;">
              Status: Request Received · Pending Agent Claim
            </span>
          </div>
          <h2 style="color: #ffffff; font-size: 20px; margin-top: 8px;">Hello ${visitorName || 'Valued Client'},</h2>
          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Thank you for scheduling a consultation with <strong>${websiteName}</strong>! Your meeting request has been placed in our agent queue.
          </p>

          <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="color: #38bdf8; margin: 0 0 16px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Requested Booking Details</h3>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #94a3b8; width: 140px;">Selected Service:</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">${service}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Preferred Date:</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">${displayDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Scheduled Time:</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">${displayTime} <span style="color: #38bdf8; font-weight: normal; font-size: 13px;">(${displayTz})</span></td>
              </tr>
              ${visitorPhone ? `
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Contact Phone:</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">${visitorPhone}</td>
              </tr>` : ''}
            </table>
          </div>

          <div style="background: rgba(56, 189, 248, 0.08); border-left: 4px solid #38bdf8; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
            <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6; margin: 0;">
              <strong>What Happens Next?</strong><br/>
              Your meeting request is currently queued for host agent assignment. As soon as a sales specialist or live agent claims your meeting, you will immediately receive an updated confirmation email with their name, contact info, and your private <strong>Zoom Meeting link</strong>.
            </p>
          </div>

          <p style="color: #94a3b8; font-size: 13px; margin: 0;">
            If you need to make changes or have questions before your call, simply reply directly to this email.
          </p>
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 20px; text-align: center; color: #64748b; font-size: 12px;">
          &copy; ${new Date().getFullYear()} ${websiteName}. All rights reserved.
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Booking confirmation sent to visitor ${visitorEmail}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Error sending booking to visitor:`, err);
    return false;
  }
}

/**
 * 2. Dispatches instant booking alert to Admin / Sales Team
 */
export async function sendBookingAlertToAdmin({
  visitorName,
  visitorEmail,
  visitorPhone,
  date,
  time,
  clientDate,
  clientTime,
  visitorTimezone,
  pktDate,
  pktTime,
  service = 'E-commerce Consultation',
  websiteName = 'AMZ Solutions Hub',
  adminEmail,
  agentEmail,
  agentName,
  conversationId,
}: BookingEmailParams) {
  // If an agent is actively assigned to the chat, send booking alert ONLY to that agent!
  // If no agent is assigned (pure AI chat), send to adminEmail.
  const cleanAgent = agentEmail && agentEmail.includes('@') ? agentEmail.trim() : null;
  const recipients = cleanAgent
    ? [cleanAgent]
    : [adminEmail || 'garryamelia6265@gmail.com'].filter((e, idx, arr) => Boolean(e) && e.includes('@') && arr.indexOf(e) === idx);

  const displayPktDate = pktDate || date;
  const displayPktTime = pktTime || time;
  const displayClientDate = clientDate || date;
  const displayClientTime = clientTime || time;
  const displayTz = visitorTimezone ? visitorTimezone.replace('_', ' ') : 'Client Time';

  const crmChatUrl = `https://salesflow-ai-main.vercel.app/livechat${conversationId ? `?chat=${conversationId}` : ''}`;

  const mailOptions = {
    from: `"Teals CRM Notifications" <${GMAIL_USER}>`,
    to: recipients.join(', '),
    subject: `🔥 New Consultation Booking: ${visitorName} - ${displayPktTime} [PKT] (${websiteName})`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b1120; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="padding-bottom: 20px; border-bottom: 1px solid #1e293b;">
          <span style="background: rgba(34, 197, 94, 0.2); color: #4ade80; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(34, 197, 94, 0.4); text-transform: uppercase;">New Consultation Booking</span>
          <h2 style="color: #ffffff; margin: 12px 0 4px 0; font-size: 22px;">${visitorName} requested a consultation</h2>
          <p style="color: #94a3b8; margin: 0; font-size: 14px;">Origin Website: <strong>${websiteName}</strong></p>
          ${agentName ? `<p style="color: #38bdf8; margin: 4px 0 0 0; font-size: 13px;">Assigned Agent: <strong>${agentName}</strong></p>` : ''}
        </div>

        <div style="padding: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; background-color: #0f172a; border-radius: 12px; border: 1px solid #334155;">
            <tr style="background: rgba(34, 197, 94, 0.12);">
              <td style="padding: 12px 16px; color: #4ade80; font-weight: 700; border-bottom: 1px solid #1e293b; width: 170px;">🇵🇰 Pakistan Time [PKT]:</td>
              <td style="padding: 12px 16px; color: #4ade80; font-weight: 800; font-size: 15px; border-bottom: 1px solid #1e293b;">${displayPktDate} at ${displayPktTime}</td>
            </tr>
            <tr style="background: rgba(56, 189, 248, 0.08);">
              <td style="padding: 12px 16px; color: #38bdf8; font-weight: 700; border-bottom: 1px solid #1e293b;">🌐 Client Local Time:</td>
              <td style="padding: 12px 16px; color: #ffffff; font-weight: 700; border-bottom: 1px solid #1e293b;">${displayClientDate} at ${displayClientTime} (${displayTz})</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #94a3b8; border-bottom: 1px solid #1e293b;">Client Name:</td>
              <td style="padding: 12px 16px; color: #ffffff; font-weight: 600; border-bottom: 1px solid #1e293b;">${visitorName}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #94a3b8; border-bottom: 1px solid #1e293b;">Client Email:</td>
              <td style="padding: 12px 16px; color: #38bdf8; font-weight: 600; border-bottom: 1px solid #1e293b;"><a href="mailto:${visitorEmail}" style="color: #38bdf8; text-decoration: none;">${visitorEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #94a3b8; border-bottom: 1px solid #1e293b;">Phone Number:</td>
              <td style="padding: 12px 16px; color: #ffffff; font-weight: 600; border-bottom: 1px solid #1e293b;">${visitorPhone || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #94a3b8; border-bottom: 1px solid #1e293b;">Requested Service:</td>
              <td style="padding: 12px 16px; color: #f59e0b; font-weight: 600; border-bottom: 1px solid #1e293b;">${service}</td>
            </tr>
            ${agentName ? `
            <tr>
              <td style="padding: 12px 16px; color: #94a3b8;">Chat Handled By:</td>
              <td style="padding: 12px 16px; color: #a78bfa; font-weight: 600;">${agentName} (${cleanAgent || ''})</td>
            </tr>` : ''}
          </table>

          <div style="margin: 28px 0 16px 0; text-align: center;">
            <a href="${crmChatUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);">
              Open Conversation in CRM &rarr;
            </a>
          </div>
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; color: #64748b; font-size: 12px;">
          Teals LiveChat & CRM Automation System
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Booking alert dispatched to admin (${recipients.join(', ')})`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Error sending alert to admin:`, err);
    return false;
  }
}
