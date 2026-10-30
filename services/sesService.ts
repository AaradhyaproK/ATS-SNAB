/**
 * Amazon SESv2 Transactional Email Service (Frontend Client)
 * Securely dispatches email requests to the serverless /api/send-email endpoint.
 * Zero AWS credentials exist or are bundled on the client side.
 */

import { renderTemplateText, getRecruiterTemplates, EmailTemplateConfig, DEFAULT_JOB_DETAILS_FIELDS, DEFAULT_JOB_DETAILS_ITEMS, formatDeadlineDisplay } from './templateService';

export const FROM_EMAIL = 'info@interviewxpert.in';

export interface JobDetailsOptions {
  gender?: string;
  location?: string;
  education?: string;
  qualification?: string;
  experience?: string | number;
  minExperience?: number | string;
  maxExperience?: number | string;
  salary?: string;
  salaryRange?: string;
  deadline?: string;
  deadlineDate?: string;
  recruiterName?: string;
  recruiterPhone?: string;
  recruiterEmail?: string;
  employmentType?: string;
  customFields?: Array<{ key: string; value: string }>;
  whatsappSessionId?: string;
  whatsappSessionPasscode?: string;
  recruiterUid?: string;
  customTemplate?: EmailTemplateConfig;
}

export interface SendEmailResult {
  success: boolean;
  totalEmails: number;
  messageIds?: string[];
  error?: string;
}

/**
 * Formats job experience display string.
 * Handles ranges like 5-8 yrs, minExperience & maxExperience, single numbers, etc.
 */
export function formatExperienceDisplay(options?: {
  experience?: string | number;
  minExperience?: number | string;
  maxExperience?: number | string;
}): string {
  if (!options) return 'As per Job Description';

  const rawMin = options.minExperience !== undefined && options.minExperience !== null ? String(options.minExperience).trim() : '';
  const rawMax = options.maxExperience !== undefined && options.maxExperience !== null ? String(options.maxExperience).trim() : '';

  const minVal = rawMin !== '' && !isNaN(Number(rawMin)) ? Number(rawMin) : null;
  const maxVal = rawMax !== '' && !isNaN(Number(rawMax)) ? Number(rawMax) : null;

  // 1. Check numerical minExperience and maxExperience range first
  if (minVal !== null && maxVal !== null && maxVal > minVal && minVal >= 0) {
    return `${minVal} - ${maxVal} Years`;
  }

  // 2. Check if experience string itself contains a range like "3-5", "3 - 5 yrs", "3 to 5 years"
  const expStr = options.experience !== undefined && options.experience !== null ? String(options.experience).trim() : '';
  if (expStr) {
    const rangeMatch = expStr.match(/^(\d+)\s*(?:-|to)\s*(\d+)\s*(?:yrs?|years?)?$/i);
    if (rangeMatch) {
      const rMin = Number(rangeMatch[1]);
      const rMax = Number(rangeMatch[2]);
      if (rMax > rMin) {
        return `${rMin} - ${rMax} Years`;
      }
      return `${rMin} ${rMin === 1 ? 'Year' : 'Years'}`;
    }
  }

  // 3. Check equal min & max
  if (minVal !== null && maxVal !== null && minVal === maxVal && minVal > 0) {
    return `${minVal} ${minVal === 1 ? 'Year' : 'Years'}`;
  }

  // 4. Single value in experience string or minVal
  if (expStr) {
    const singleMatch = expStr.match(/^(\d+)\s*(?:yrs?|years?)?$/i);
    if (singleMatch) {
      const num = Number(singleMatch[1]);
      if (minVal !== null && maxVal !== null && maxVal > minVal) {
        return `${minVal} - ${maxVal} Years`;
      }
      return `${num} ${num === 1 ? 'Year' : 'Years'}`;
    }
    return expStr;
  }

  if (minVal !== null && minVal > 0) {
    return `${minVal}+ Years`;
  }

  return 'As per Job Description';
}

/**
 * Derives a clean candidate name from an email address if name is not explicitly passed.
 */
export function deriveNameFromEmail(email: string): string {
  if (!email || !email.includes('@')) return 'Candidate';
  const localPart = email.split('@')[0];
  return localPart
    .replace(/[0-9]/g, '')
    .replace(/[._-]/g, ' ')
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim() || 'Candidate';
}

/**
 * Ultra-Professional Designer Email Template for Interview Invitations
 */
export function getDesignerEmailTemplate(
  candidateName: string,
  jobTitle: string,
  interviewLink: string,
  accessCode: string,
  isReminder: boolean = false,
  options?: JobDetailsOptions
): string {
  const context: Record<string, string> = {
    candidate_name: candidateName,
    job_title: jobTitle,
    company_name: options?.companyName || 'InterviewXpert',
    interview_link: interviewLink,
    access_code: accessCode,
    interview_deadline: '',
    deadline: '',
    location: options?.location || 'As specified in Job Description',
    qualification: options?.qualification || options?.education || 'As per Job Description',
    experience: formatExperienceDisplay(options),
    salary: options?.salary || options?.salaryRange || 'Competitive / As per Job Description',
    employment_type: options?.employmentType || 'Full Time',
    recruiter_name: options?.recruiterName || 'HR Recruiting Team',
    recruiter_phone: options?.recruiterPhone || '9762588623 / 8484888632',
    recruiter_email: options?.recruiterEmail || FROM_EMAIL,
    support_phone: '9762588623 / 8484888632'
  };

  const custom = options?.customTemplate;
  const badgeText = custom?.badgeText
    ? renderTemplateText(custom.badgeText, context)
    : (isReminder ? "INTERVIEW PENDING REMINDER" : "YOU ARE SHORTLISTED FOR THIS ROUND");

  const headline = custom?.headline
    ? renderTemplateText(custom.headline, context)
    : `Dear ${candidateName},`;

  const bodyText = custom?.body
    ? renderTemplateText(custom.body, context)
    : (isReminder
        ? `This is a friendly reminder that you have been <strong>shortlisted for ${jobTitle}</strong> at <strong>${options?.companyName || 'InterviewXpert'}</strong>, but your AI Video Interview is still pending.<br/><br/>Please complete your interview at your convenience to move forward in the selection process.`
        : `Congratulations! 🎉<br/><br/>We are excited to inform you that your profile has been <strong>shortlisted for this interview round</strong> for the <strong>${jobTitle}</strong> role at <strong>${options?.companyName || 'InterviewXpert'}</strong>.<br/><br/>You can complete your 15-minute AI Video Interview anytime from your phone or laptop at your convenience.`);

  const ctaText = custom?.ctaButtonText
    ? renderTemplateText(custom.ctaButtonText, context)
    : 'Start Interview Now &rarr;';

  const accentColor = custom?.accentColor || '#0284c7';
  const showJobDetails = custom ? custom.showJobDetails !== false : true;
  const showCredentialsBox = custom ? custom.showCredentialsBox !== false : true;
  const footerText = custom?.customFooter
    ? renderTemplateText(custom.customFooter, context)
    : 'Need Technical Assistance? Call Support: 9762588623 / 8484888632';

  const instructionsList = custom?.instructions && custom.instructions.length > 0
    ? custom.instructions.map(inst => renderTemplateText(inst, context))
    : [
        'Ensure a working camera & microphone for the AI voice/video assessment.',
        'Use a stable internet connection in a quiet environment.',
        'Do not refresh or exit the browser tab once the assessment starts.'
      ];

  const items = custom?.jobDetailItems && custom.jobDetailItems.length > 0
    ? custom.jobDetailItems
    : DEFAULT_JOB_DETAILS_ITEMS;

  const renderedJobRows = items
    .filter(item => item.enabled !== false)
    .map(item => {
      let val = renderTemplateText(item.value, context);
      if (item.id === 'customFields') {
        if (options?.customFields && options.customFields.length > 0) {
          return options.customFields.map(cf => `<tr><td style="padding:6px 0;font-size:14px;color:#475569;width:38%;font-weight:600;">${cf.key}:</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${cf.value}</td></tr>`).join('');
        }
        return '';
      }
      if (!val) return '';
      return `<tr><td style="padding:6px 0;font-size:14px;color:#475569;width:38%;font-weight:600;">${item.icon || '🔹'} ${item.label}:</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${val}</td></tr>`;
    })
    .filter(Boolean)
    .join('');

  const recruiterName = options?.recruiterName || 'HR Recruiting Team';
  const recruiterPhone = options?.recruiterPhone || '9762588623 / 8484888632';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${jobTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;padding:20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          
          <!-- Minimalist Header Logo & Badge -->
          <tr>
            <td style="padding:24px 32px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;text-align:left;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;font-family:sans-serif;">InterviewXpert</span>
                <span style="display:inline-block;padding:4px 10px;background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.5px;color:#334155;text-transform:uppercase;float:right;margin-top:6px;">
                  ${badgeText}
                </span>
              </div>
            </td>
          </tr>

          <!-- Main Email Content -->
          <tr>
            <td style="padding:28px 32px;">
              <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0f172a;">${headline}</h2>
              <div style="margin:0 0 24px 0;font-size:15px;color:#334155;line-height:1.6;">
                ${bodyText}
              </div>

              ${showJobDetails && renderedJobRows ? `
              <!-- Job Specifications Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;overflow:hidden;">
                <tr>
                  <td style="background-color:#f8fafc;padding:10px 18px;border-bottom:1px solid #e2e8f0;">
                    <span style="font-size:12px;font-weight:700;letter-spacing:0.5px;color:#0f172a;text-transform:uppercase;">Job Requirement Details</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      ${renderedJobRows}
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${showCredentialsBox ? `
              <!-- Access Code Credentials Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px;text-align:center;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#475569;margin-bottom:6px;">Your Access Credentials</div>
                    <div style="font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:700;letter-spacing:5px;color:#0f172a;background-color:#ffffff;display:inline-block;padding:6px 20px;border-radius:6px;border:1px solid #cbd5e1;margin-bottom:6px;">
                      ${accessCode}
                    </div>
                    <div style="font-size:12px;color:#64748b;">Enter this code when launching your AI interview.</div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Primary CTA Button (Single Clean Dark Tone) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${interviewLink}" target="_blank" style="display:inline-block;padding:14px 34px;background-color:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;letter-spacing:0.2px;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Direct Link Fallback -->
              <p style="margin:0 0 24px 0;font-size:12px;color:#64748b;word-break:break-all;text-align:center;">
                Direct Link: <a href="${interviewLink}" style="color:#0f172a;text-decoration:underline;">${interviewLink}</a>
              </p>

              <!-- Recruiter & Sender Contact Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:6px;">Sender & Recruiter Contact Details</div>
                    <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:2px;">👤 Sender: ${recruiterName}</div>
                    <div style="font-size:13px;color:#334155;">📞 Contact / Phone: ${recruiterPhone}</div>
                  </td>
                </tr>
              </table>

              <!-- Pre-Interview Instructions -->
              <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
                <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:6px;">Important Instructions before starting:</div>
                <ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.6;">
                  ${instructionsList.map(inst => `<li>${inst}</li>`).join('')}
                </ul>
              </div>

            </td>
          </tr>

          <!-- Simple Clean Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:12px;color:#475569;">
                ${footerText}
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} InterviewXpert Recruitment Platform. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Core single email sender via secure serverless endpoint /api/send-email
 */
export async function sendSingleEmail(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    const endpoint = apiBase ? `${apiBase}/api/send-email` : '/api/send-email';

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientEmail,
        recipientName,
        subject,
        htmlContent,
      }),
    });

    const data = await resp.json().catch(() => null);

    if (resp.ok && data?.success) {
      console.log('✅ [Amazon SES Secure Serverless] Email delivered to:', recipientEmail, '| MessageId:', data.messageId);
      return { success: true, messageId: data.messageId };
    }

    const errorMsg = data?.error || `Email delivery failed with status ${resp.status}`;
    console.error('❌ [Amazon SES Serverless Error]:', errorMsg);
    return { success: false, error: errorMsg };
  } catch (err: any) {
    console.error('❌ [Amazon SES Dispatch Error]:', err);
    return { success: false, error: err?.message || 'Network error while contacting email service.' };
  }
}

/**
 * Bulk email sender using Amazon SESv2 and designer template
 */
export async function sendInterviewInvitations(
  candidateEmails: (string | { email: string; name?: string; phone?: string })[],
  jobTitle: string,
  interviewLink: string,
  accessCode: string,
  isReminder: boolean = false,
  options?: JobDetailsOptions
): Promise<SendEmailResult> {
  if (!candidateEmails || candidateEmails.length === 0) {
    return { success: false, totalEmails: 0, error: 'No candidate emails provided.' };
  }

  const allMessageIds: string[] = [];
  let lastError = '';

  // Load custom template for recruiter if available
  let activeTemplate: EmailTemplateConfig | undefined;
  try {
    const recruiterTemplates = await getRecruiterTemplates(options?.recruiterUid);
    if (isReminder) {
      activeTemplate = options?.customTemplate || recruiterTemplates.emailReminder;
    } else {
      activeTemplate = options?.customTemplate || recruiterTemplates.emailInvite;
    }
  } catch (e) {
    activeTemplate = options?.customTemplate;
  }

  const mergedOptions: JobDetailsOptions = {
    ...options,
    customTemplate: activeTemplate
  };

  for (const item of candidateEmails) {
    if (!item) continue;

    let email = '';
    let rawName = '';

    if (typeof item === 'string') {
      email = item.trim();
    } else if (typeof item === 'object' && item !== null) {
      email = (item.email || '').trim();
      rawName = (item.name || (item as any).candidateName || (item as any).fullName || (item as any).displayName || (item as any).candName || '').trim();
    }

    if (!email || !email.includes('@') || email.endsWith('@whatsapp.local')) continue;

    // Failsafe lookup from options.candidateData or options.candidates if rawName wasn't attached
    if (!rawName && (options as any)?.candidateData && Array.isArray((options as any).candidateData)) {
      const match = (options as any).candidateData.find((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
      if (match?.name) rawName = String(match.name).trim();
    }
    if (!rawName && (options as any)?.candidates && Array.isArray((options as any).candidates)) {
      const match = (options as any).candidates.find((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
      if (match?.name) rawName = String(match.name).trim();
    }

    // Prioritize candidate's actual full name over email username
    const candidateName = (rawName && rawName.trim() !== '' && rawName.toLowerCase() !== email.toLowerCase())
      ? rawName.trim()
      : deriveNameFromEmail(email);

    const candidateLink = interviewLink.includes('email=')
      ? interviewLink
      : `${interviewLink}${interviewLink.includes('?') ? '&' : '?'}email=${encodeURIComponent(email)}&name=${encodeURIComponent(candidateName)}`;

    const htmlContent = getDesignerEmailTemplate(candidateName, jobTitle, candidateLink, accessCode, isReminder, mergedOptions);

    const context = {
      candidate_name: candidateName,
      candidate_email: email,
      job_title: jobTitle,
      company_name: options?.companyName || 'InterviewXpert',
      interview_link: candidateLink,
      access_code: accessCode,
      location: options?.location || 'As specified in Job Description',
      qualification: options?.qualification || options?.education || 'As per Job Description',
      experience: formatExperienceDisplay(options),
      salary: options?.salary || options?.salaryRange || 'Competitive / As per Job Description',
      employment_type: options?.employmentType || 'Full Time',
      recruiter_name: options?.recruiterName || 'HR Recruiting Team',
      recruiter_phone: options?.recruiterPhone || '9762588623 / 8484888632',
      recruiter_email: options?.recruiterEmail || FROM_EMAIL,
      support_phone: '9762588623 / 8484888632'
    };

    const subject = activeTemplate?.subject
      ? renderTemplateText(activeTemplate.subject, context)
      : `${isReminder ? 'Reminder: ' : ''}Interview Invitation — ${jobTitle} | ${options?.companyName || 'InterviewXpert'}`;

    const result = await sendSingleEmail(email, candidateName, subject, htmlContent);

    if (result.success && result.messageId) {
      allMessageIds.push(result.messageId);
    } else {
      lastError = result.error || 'Unknown error';
    }
  }

  if (allMessageIds.length > 0) {
    return {
      success: true,
      totalEmails: allMessageIds.length,
      messageIds: allMessageIds,
      error: lastError || undefined,
    };
  }

  return { success: false, totalEmails: 0, error: lastError || 'Failed to send emails via Amazon SES.' };
}

/**
 * Dedicated Assessment Invitation Email Sender (Aptitude MCQ & Coding Challenge)
 * Ensures candidates receive assessment-specific communications, not generic job interview emails.
 */
export async function sendAssessmentEmailInvitations(
  candidateEmails: (string | { email: string; name?: string; phone?: string })[],
  testTitle: string,
  testLink: string,
  accessCode: string,
  testType: 'aptitude' | 'coding' | string = 'aptitude',
  testSpecs?: {
    duration?: number;
    passingScore?: number;
    questionsCount?: number;
  },
  isReminder: boolean = false,
  options?: {
    recruiterName?: string;
    recruiterEmail?: string;
    recruiterPhone?: string;
    companyName?: string;
  }
): Promise<SendEmailResult> {
  if (!candidateEmails || candidateEmails.length === 0) {
    return { success: false, totalEmails: 0, error: 'No candidate emails provided.' };
  }

  const allMessageIds: string[] = [];
  let lastError = '';
  const isCoding = testType === 'coding';
  const duration = testSpecs?.duration || 10;
  const passingScore = testSpecs?.passingScore || 70;
  const questionsCount = testSpecs?.questionsCount || 0;
  const companyName = options?.companyName || 'InterviewXpert';
  const recruiterName = options?.recruiterName || 'Talent Acquisition Team';

  for (const item of candidateEmails) {
    if (!item) continue;
    let email = '';
    let rawName = '';

    if (typeof item === 'string') {
      email = item.trim();
    } else if (typeof item === 'object' && item !== null) {
      email = (item.email || '').trim();
      rawName = (item.name || '').trim();
    }

    if (!email || !email.includes('@') || email.endsWith('@whatsapp.local')) continue;

    const candidateName = rawName || deriveNameFromEmail(email);
    const candidateLink = testLink.includes('email=')
      ? testLink
      : `${testLink}${testLink.includes('?') ? '&' : '?'}email=${encodeURIComponent(email)}&name=${encodeURIComponent(candidateName)}`;

    const subject = isReminder
      ? `⏰ Reminder: Complete Your Assessment — ${testTitle} | ${companyName}`
      : `${isCoding ? '💻 Coding Challenge' : '📝 Online Assessment'} Invitation: ${testTitle} | ${companyName}`;

    const badgeText = isReminder
      ? 'ASSESSMENT PENDING REMINDER'
      : (isCoding ? 'CODING CHALLENGE INVITATION' : 'ONLINE ASSESSMENT INVITATION');

    const formatLabel = isCoding
      ? '💻 Live Coding Challenge (Multi-Language IDE & Test Cases)'
      : '📝 MCQ / Multiple Choice Aptitude Screen';

    const bodyIntro = isReminder
      ? `This is a friendly reminder to complete your pending screening assessment for <strong>${testTitle}</strong>.<br/><br/>Please make sure to attempt the test at your earliest convenience.`
      : `You have been invited by <strong>${recruiterName}</strong> (${companyName}) to complete an automated online assessment for <strong>${testTitle}</strong>.<br/><br/>This evaluation is designed to gauge your ${isCoding ? 'coding algorithms, problem solving, and technical execution' : 'analytical reasoning, domain knowledge, and problem-solving skills'}.`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${testTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <tr>
            <td style="padding:22px 28px;background-color:#ffffff;border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">InterviewXpert</span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:4px 10px;background-color:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:0.5px;color:#334155;text-transform:uppercase;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:28px 30px;">
              <h2 style="margin:0 0 12px 0;font-size:19px;font-weight:800;color:#0f172a;">Dear ${candidateName},</h2>
              <div style="margin:0 0 20px 0;font-size:14px;color:#334155;line-height:1.65;">
                ${bodyIntro}
              </div>

              <!-- Assessment Specs Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;overflow:hidden;">
                <tr>
                  <td style="background-color:#f8fafc;padding:10px 16px;border-bottom:1px solid #e2e8f0;">
                    <span style="font-size:11px;font-weight:800;letter-spacing:0.5px;color:#0f172a;text-transform:uppercase;">Assessment Specifications</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;">
                      <tr>
                        <td style="padding:5px 0;color:#64748b;font-weight:600;width:38%;">Assessment Title:</td>
                        <td style="padding:5px 0;color:#0f172a;font-weight:700;">${testTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#64748b;font-weight:600;">Evaluation Format:</td>
                        <td style="padding:5px 0;color:#0f172a;font-weight:600;">${formatLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#64748b;font-weight:600;">Duration:</td>
                        <td style="padding:5px 0;color:#0f172a;font-weight:700;">${duration} Minutes</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#64748b;font-weight:600;">Pass Benchmark:</td>
                        <td style="padding:5px 0;color:#059669;font-weight:700;">${passingScore}%</td>
                      </tr>
                      ${questionsCount > 0 ? `
                      <tr>
                        <td style="padding:5px 0;color:#64748b;font-weight:600;">Total Questions/Problems:</td>
                        <td style="padding:5px 0;color:#0f172a;font-weight:700;">${questionsCount}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:5px 0;color:#64748b;font-weight:600;">Invited By:</td>
                        <td style="padding:5px 0;color:#0f172a;font-weight:600;">${recruiterName} (${companyName})</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${accessCode ? `
              <!-- Access Code Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px;text-align:center;">
                    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#475569;margin-bottom:6px;">Your Access Code</div>
                    <div style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:800;letter-spacing:4px;color:#0f172a;background-color:#ffffff;display:inline-block;padding:6px 18px;border-radius:6px;border:1px solid #cbd5e1;margin-bottom:6px;">
                      ${accessCode}
                    </div>
                    <div style="font-size:11px;color:#64748b;">Enter this code when launching your assessment if prompted.</div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">
                <tr>
                  <td align="center">
                    <a href="${candidateLink}" target="_blank" style="display:inline-block;padding:13px 32px;background-color:#0f172a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">
                      Launch Assessment Now &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Test Guidelines -->
              <div style="padding:14px;background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px;">
                <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#334155;margin-bottom:6px;">Test Guidelines:</div>
                <ul style="margin:0;padding-left:18px;font-size:12px;color:#475569;line-height:1.6;">
                  <li>Open the link on a modern browser (Chrome, Edge, Firefox, Brave) with a stable internet connection.</li>
                  <li>Live browser anti-cheating monitoring and tab-switching restrictions are enabled.</li>
                  <li>Ensure uninterrupted connectivity during the ${duration}-minute session.</li>
                  <li>Your scorecard and performance breakdown will be generated immediately upon submission.</li>
                </ul>
              </div>

              <div style="font-size:12px;color:#64748b;margin-top:16px;line-height:1.5;">
                Best regards,<br/>
                <strong style="color:#0f172a;">${recruiterName}</strong><br/>
                ${companyName} Talent Evaluation Team
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
              This is an automated evaluation dispatch sent via InterviewXpert Assessment Studio.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const result = await sendSingleEmail(email, candidateName, subject, htmlContent);
    if (result.success && result.messageId) {
      allMessageIds.push(result.messageId);
    } else {
      lastError = result.error || 'Unknown error';
    }
  }

  if (allMessageIds.length > 0) {
    return {
      success: true,
      totalEmails: allMessageIds.length,
      messageIds: allMessageIds,
      error: lastError || undefined,
    };
  }

  return { success: false, totalEmails: 0, error: lastError || 'Failed to send assessment emails via Amazon SES.' };
}
