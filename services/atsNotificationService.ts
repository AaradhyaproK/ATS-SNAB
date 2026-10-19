import { sendSingleEmail, FROM_EMAIL } from './sesService';
import { sendWhatsAppMessage, formatPhoneForWhatsApp } from './waSenderService';

export interface AtsStatusEmailParams {
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  newStatus: string;
  scheduleDetails?: {
    contactPerson?: string;
    date?: string;
    time?: string;
    mode?: string;
    location?: string;
    link?: string;
    notes?: string;
  };
  recruiterNotes?: string;
  recruiterName?: string;
  recruiterPhone?: string;
  recruiterEmail?: string;
  candidatePortalLink?: string;
}

export const getStatusColorTheme = (status: string) => {
  switch (status) {
    case 'Shortlisted':
      return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', badge: 'SHORTLISTED' };
    case 'Interview Scheduled':
      return { bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe', badge: 'INTERVIEW SCHEDULED' };
    case 'Technical Round':
      return { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe', badge: 'TECHNICAL ROUND' };
    case 'HR Round':
      return { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4', badge: 'HR ROUND' };
    case 'Offer Extended':
      return { bg: '#fffbeb', text: '#d97706', border: '#fde68a', badge: 'OFFER EXTENDED' };
    case 'Hired':
      return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', badge: 'CONGRATULATIONS - HIRED' };
    case 'Rejected':
      return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', badge: 'APPLICATION CONCLUDED' };
    case 'On Hold':
      return { bg: '#f8fafc', text: '#64748b', border: '#cbd5e1', badge: 'ON HOLD' };
    default:
      return { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd', badge: 'UNDER REVIEW' };
  }
};

export const generateAtsStatusEmailHtml = (params: AtsStatusEmailParams): string => {
  const {
    candidateName,
    jobTitle,
    companyName,
    newStatus,
    scheduleDetails,
    recruiterNotes,
    recruiterName = 'Talent Acquisition Team',
    recruiterPhone,
    recruiterEmail,
    candidatePortalLink
  } = params;

  const theme = getStatusColorTheme(newStatus);
  const portalUrl = candidatePortalLink || `${window.location.origin}/#/candidate`;

  let statusExplanation = `Your application status has been updated to: <strong>${newStatus}</strong>.`;
  if (newStatus === 'Shortlisted') {
    statusExplanation = `Congratulations! Your profile has been reviewed and <strong>shortlisted</strong> for the <strong>${jobTitle}</strong> position. Our recruiting team was impressed by your qualifications and will reach out with next steps.`;
  } else if (newStatus === 'Interview Scheduled') {
    statusExplanation = `We are pleased to invite you to an interview for the <strong>${jobTitle}</strong> role. Below are the confirmed details for your interview session.`;
  } else if (newStatus === 'Offer Extended') {
    statusExplanation = `Congratulations! Following your recent rounds, we are thrilled to extend an <strong>Offer of Employment</strong> for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>. Our team will follow up with the formal documentation.`;
  } else if (newStatus === 'Hired') {
    statusExplanation = `Welcome aboard! 🎉 You have been officially <strong>hired</strong> for the <strong>${jobTitle}</strong> role at <strong>${companyName}</strong>. We look forward to having you on the team.`;
  } else if (newStatus === 'Rejected') {
    statusExplanation = `Thank you for taking the time to apply and interview for the <strong>${jobTitle}</strong> position. While we were impressed with your background, we have decided to move forward with other candidates whose experience more closely matches our immediate needs for this role. We will keep your profile in our talent pool for future openings.`;
  }

  let scheduleSectionHtml = '';
  if (newStatus === 'Interview Scheduled' && scheduleDetails) {
    scheduleSectionHtml = `
      <div style="margin:24px 0;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <h4 style="margin:0 0 14px 0;color:#0f172a;font-size:15px;font-weight:700;">📅 Confirmed Interview Details</h4>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${scheduleDetails.contactPerson ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;width:35%;font-weight:600;">Contact Person:</td>
              <td style="padding:6px 0;color:#0f172a;font-weight:600;">${scheduleDetails.contactPerson}</td>
            </tr>
          ` : ''}
          ${scheduleDetails.date ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;width:35%;font-weight:600;">Date:</td>
              <td style="padding:6px 0;color:#0f172a;font-weight:600;">${scheduleDetails.date}</td>
            </tr>
          ` : ''}
          ${scheduleDetails.time ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;width:35%;font-weight:600;">Time:</td>
              <td style="padding:6px 0;color:#0f172a;font-weight:600;">${scheduleDetails.time}</td>
            </tr>
          ` : ''}
          ${scheduleDetails.mode ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;width:35%;font-weight:600;">Interview Mode:</td>
              <td style="padding:6px 0;color:#0f172a;font-weight:600;">${scheduleDetails.mode}</td>
            </tr>
          ` : ''}
          ${scheduleDetails.location ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;width:35%;font-weight:600;">Location / Venue:</td>
              <td style="padding:6px 0;color:#0f172a;font-weight:600;">${scheduleDetails.location}</td>
            </tr>
          ` : ''}
          ${scheduleDetails.link ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;width:35%;font-weight:600;">Meeting Link:</td>
              <td style="padding:6px 0;color:#2563eb;font-weight:600;">
                <a href="${scheduleDetails.link}" style="color:#2563eb;word-break:break-all;" target="_blank">${scheduleDetails.link}</a>
              </td>
            </tr>
          ` : ''}
          ${scheduleDetails.notes ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;width:35%;font-weight:600;">Instructions / Notes:</td>
              <td style="padding:6px 0;color:#0f172a;">${scheduleDetails.notes}</td>
            </tr>
          ` : ''}
        </table>
      </div>
    `;
  }

  let recruiterNotesSectionHtml = '';
  if (recruiterNotes && recruiterNotes.trim()) {
    recruiterNotesSectionHtml = `
      <div style="margin:20px 0;padding:16px;background:#f0f9ff;border-left:4px solid #0284c7;border-radius:6px;">
        <span style="display:block;font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;margin-bottom:4px;">Note from Recruiter:</span>
        <span style="font-size:14px;color:#0f172a;line-height:1.5;">${recruiterNotes}</span>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Status Update</title>
      </head>
      <body style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color:#f1f5f9; margin:0; padding:24px 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.06); border:1px solid #e2e8f0; margin:0 auto;">
          <!-- Header Bar -->
          <tr>
            <td style="background:linear-gradient(135deg, #09090b 0%, #18181b 100%); padding:28px 32px; text-align:left;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h2 style="color:#ffffff; margin:0; font-size:20px; font-weight:800; letter-spacing:-0.5px;">
                      ${companyName || 'SNAB hireX'}
                    </h2>
                    <p style="color:#a1a1aa; margin:4px 0 0 0; font-size:12px; text-transform:uppercase; letter-spacing:1px; font-weight:600;">
                      Applicant Tracking System • Status Notification
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px;">
              <p style="font-size:16px; color:#0f172a; margin:0 0 16px 0; font-weight:600;">
                Dear ${candidateName},
              </p>

              <p style="font-size:14px; line-height:1.6; color:#334155; margin:0 0 20px 0;">
                We are writing to provide an update on your job application for the role of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.
              </p>

              <!-- Status Card -->
              <div style="background-color:${theme.bg}; border:1px solid ${theme.border}; border-radius:10px; padding:18px 20px; margin:20px 0; text-align:left;">
                <span style="font-size:11px; font-weight:800; color:${theme.text}; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:6px;">
                  Current Application Status
                </span>
                <span style="font-size:20px; font-weight:800; color:${theme.text}; display:block;">
                  ${newStatus}
                </span>
              </div>

              <div style="font-size:14px; line-height:1.6; color:#334155; margin:16px 0;">
                ${statusExplanation}
              </div>

              ${scheduleSectionHtml}
              ${recruiterNotesSectionHtml}

              <!-- Call to Action -->
              <div style="text-align:center; margin:32px 0 24px 0;">
                <a href="${portalUrl}" style="background-color:#09090b; color:#ffffff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px; display:inline-block; box-shadow:0 4px 12px rgba(0,0,0,0.12);" target="_blank">
                  View Candidate Portal &rarr;
                </a>
              </div>

              <p style="font-size:12px; color:#64748b; line-height:1.5; margin:0 0 24px 0; text-align:center;">
                You can log into the candidate portal with your registered email and phone number anytime to track all active job applications.
              </p>

              <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />

              <!-- Recruiter Signoff -->
              <div style="font-size:13px; color:#475569; line-height:1.5;">
                <p style="margin:0; font-weight:700; color:#0f172a;">${recruiterName}</p>
                <p style="margin:2px 0 0 0; color:#64748b;">${companyName}</p>
                ${recruiterEmail ? `<p style="margin:2px 0 0 0; color:#64748b;">Email: <a href="mailto:${recruiterEmail}" style="color:#2563eb;">${recruiterEmail}</a></p>` : ''}
                ${recruiterPhone ? `<p style="margin:2px 0 0 0; color:#64748b;">Phone: ${recruiterPhone}</p>` : ''}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc; border-top:1px solid #e2e8f0; padding:18px 32px; text-align:center;">
              <p style="color:#94a3b8; font-size:11px; margin:0; line-height:1.4;">
                This automated update was sent via ${companyName || 'SNAB hireX'} ATS Recruitment System.<br/>
                Please do not reply directly to this automated email.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

export const sendAtsCandidateStatusEmail = async (params: AtsStatusEmailParams): Promise<{ success: boolean; error?: string }> => {
  try {
    const { candidateEmail, candidateName, jobTitle, companyName, newStatus } = params;
    if (!candidateEmail || !candidateEmail.includes('@') || candidateEmail.endsWith('@whatsapp.local')) {
      return { success: false, error: 'Invalid candidate email address.' };
    }

    const subject = `Application Status Update: ${newStatus} — ${jobTitle} | ${companyName}`;
    const htmlContent = generateAtsStatusEmailHtml(params);

    const res = await sendSingleEmail(
      candidateEmail,
      candidateName || candidateEmail.split('@')[0],
      subject,
      htmlContent
    );

    return res;
  } catch (err: any) {
    console.error('Failed to send ATS candidate status email:', err);
    return { success: false, error: err?.message || 'Failed to dispatch email.' };
  }
};

export interface AtsStatusWhatsAppParams {
  candidatePhone: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  newStatus: string;
  scheduleDetails?: {
    contactPerson?: string;
    date?: string;
    time?: string;
    mode?: string;
    location?: string;
    link?: string;
    notes?: string;
  };
  recruiterNotes?: string;
  recruiterName?: string;
  candidatePortalLink?: string;
  sessionId?: string;
  passcode?: string;
}

export const generateAtsStatusWhatsAppMessage = (params: AtsStatusWhatsAppParams): string => {
  const {
    candidateName,
    jobTitle,
    companyName,
    newStatus,
    scheduleDetails,
    recruiterNotes,
    recruiterName = 'Talent Acquisition Team',
    candidatePortalLink
  } = params;

  let msg = `Hello *${candidateName || 'Candidate'}*,\n\n`;
  msg += `Your job application status for *${jobTitle}* at *${companyName}* has been updated to:\n`;
  msg += `📌 *${newStatus}*\n\n`;

  if (newStatus === 'Interview Scheduled' && scheduleDetails) {
    msg += `📅 *Interview Schedule Details:*\n`;
    if (scheduleDetails.contactPerson) msg += `👤 *Contact Person:* ${scheduleDetails.contactPerson}\n`;
    if (scheduleDetails.date) msg += `🗓 *Date:* ${scheduleDetails.date}\n`;
    if (scheduleDetails.time) msg += `⏰ *Time:* ${scheduleDetails.time}\n`;
    if (scheduleDetails.mode) msg += `💼 *Mode:* ${scheduleDetails.mode}\n`;
    if (scheduleDetails.location) msg += `📍 *Location / Venue:* ${scheduleDetails.location}\n`;
    if (scheduleDetails.link) msg += `🔗 *Meeting Link:* ${scheduleDetails.link}\n`;
    if (scheduleDetails.notes) msg += `📝 *Notes:* ${scheduleDetails.notes}\n`;
    msg += `\n`;
  } else if (newStatus === 'Shortlisted') {
    msg += `🎉 Congratulations! Your profile has been shortlisted. Our recruiting team will follow up with you on next steps.\n\n`;
  } else if (newStatus === 'Technical Round') {
    msg += `💻 Your application has progressed to the Technical Round. Please stay tuned for detailed session information.\n\n`;
  } else if (newStatus === 'HR Round') {
    msg += `🤝 Your application has progressed to the HR Round. Our team will reach out with interview details.\n\n`;
  } else if (newStatus === 'Offer Extended') {
    msg += `🎊 Congratulations! We are thrilled to extend an Offer of Employment. Our team will share the formal offer letter shortly.\n\n`;
  } else if (newStatus === 'Hired') {
    msg += `🌟 Welcome to the team! You have been officially hired. We are excited to work with you!\n\n`;
  } else if (newStatus === 'Rejected') {
    msg += `Thank you for your interest and the time invested in applying. Although we are unable to proceed at this time, we will retain your profile in our candidate pool for future opportunities.\n\n`;
  }

  if (recruiterNotes && recruiterNotes.trim()) {
    msg += `💬 *Recruiter Note:*\n${recruiterNotes.trim()}\n\n`;
  }

  if (candidatePortalLink) {
    msg += `🌐 Track your application status anytime:\n${candidatePortalLink}\n\n`;
  }

  msg += `Best regards,\n*${recruiterName}*\n${companyName}`;

  return msg;
};

export const sendAtsCandidateStatusWhatsApp = async (params: AtsStatusWhatsAppParams): Promise<{ success: boolean; error?: string }> => {
  try {
    const { candidatePhone } = params;
    const cleanPhone = formatPhoneForWhatsApp(candidatePhone);
    if (!cleanPhone) {
      return { success: false, error: 'Valid candidate phone number is required.' };
    }

    const messageText = generateAtsStatusWhatsAppMessage(params);
    const res = await sendWhatsAppMessage(cleanPhone, messageText, {
      sessionId: params.sessionId,
      passcode: params.passcode,
    });

    return {
      success: res.success,
      error: res.error,
    };
  } catch (err: any) {
    console.error('Failed to send ATS WhatsApp status notification:', err);
    return { success: false, error: err?.message || 'Failed to dispatch WhatsApp message.' };
  }
};

