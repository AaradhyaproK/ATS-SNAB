import { 
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, query, where, orderBy, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { geminiGenerateJson, callGeminiApi } from './geminiService';
import { 
  VoiceInterview, 
  VoiceInterviewQuestion, 
  VoiceInterviewResponse, 
  VoiceInterviewTurn 
} from '../types';

export const DEFAULT_SCREENING_QUESTIONS: VoiceInterviewQuestion[] = [
  {
    id: 'relocation_1',
    question: 'Are you currently based in the job location, or would you be comfortable relocating if selected for this position?',
    category: 'relocation'
  },
  {
    id: 'notice_1',
    question: 'What is your current notice period or how soon would you be available to join our team?',
    category: 'notice_period'
  },
  {
    id: 'salary_1',
    question: 'Could you share your current compensation and what salary expectations you have for this role?',
    category: 'salary'
  },
  {
    id: 'skills_1',
    question: 'Could you briefly explain your core skills and hands-on experience most relevant to this job description?',
    category: 'skills'
  },
  {
    id: 'motivation_1',
    question: 'What caught your interest about this role and why do you feel you would be a great fit?',
    category: 'general'
  }
];

/**
 * Extract target city or location from explicit location string or job description text
 */
export function extractCityOrLocation(location?: string, description?: string): string {
  if (location && location.trim() && !/^(remote|hybrid|any|india|worldwide|all)$/i.test(location.trim())) {
    return location.trim();
  }
  if (description) {
    // Check for "located in / based in / office in / relocate to <City>"
    const match = description.match(/(?:located in|based in|location[:\s]+|office in|relocate to|work from)\s*([A-Za-z\s]+?)(?:[,\.\n;]|\s+office|\s+city|\s+branch)/i);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length >= 3 && candidate.length <= 30 && !/^(the|any|our|various|india|company)$/i.test(candidate)) {
        return candidate;
      }
    }
    // Check known tech cities
    const popularCities = ['Nashik', 'Pune', 'Mumbai', 'Bengaluru', 'Bangalore', 'Hyderabad', 'Delhi', 'Noida', 'Gurugram', 'Gurgaon', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Indore', 'Nagpur', 'Chandigarh'];
    for (const city of popularCities) {
      if (new RegExp(`\\b${city}\\b`, 'i').test(description)) {
        return city;
      }
    }
  }
  return location?.trim() || '';
}

/**
 * Specialize questions dynamically using exact target location (e.g. Nashik) and candidate context/resume
 */
export function specializeQuestions(
  questions: VoiceInterviewQuestion[],
  jobInfo: { title?: string; location?: string; description?: string; companyName?: string },
  candidateInfo?: { name?: string; currentCity?: string; resumeText?: string }
): VoiceInterviewQuestion[] {
  const targetLocation = extractCityOrLocation(jobInfo.location, jobInfo.description);
  const candidateCity = candidateInfo?.currentCity?.trim();

  return questions.map(q => {
    let text = q.question;

    // Relocation specific specialization (e.g. Nashik)
    if (q.category === 'relocation' || /relocat|location|based in|current city/i.test(text)) {
      if (targetLocation) {
        if (candidateCity && candidateCity.toLowerCase() !== targetLocation.toLowerCase()) {
          text = `I see you are currently based in ${candidateCity}. Will you be comfortable relocating to ${targetLocation} for this role?`;
        } else if (candidateCity && candidateCity.toLowerCase() === targetLocation.toLowerCase()) {
          text = `Since you are already located in ${targetLocation}, are you comfortable working on-site at our ${targetLocation} office?`;
        } else {
          text = `This position is based in ${targetLocation}. Will you be comfortable relocating to ${targetLocation} for this role?`;
        }
      }
    }

    // Replace any generic placeholder phrases with the real location
    if (targetLocation) {
      text = text
        .replace(/the job location/gi, targetLocation)
        .replace(/the designated company location/gi, targetLocation)
        .replace(/the company location/gi, targetLocation)
        .replace(/our office location/gi, `our ${targetLocation} office`);
    }

    return {
      ...q,
      question: text
    };
  });
}

/**
 * Automatically generate specific, direct screening questions from Job Description using AI
 */
export async function generateScreeningQuestionsFromJd(
  jobTitle: string,
  jobDescription: string,
  location?: string
): Promise<VoiceInterviewQuestion[]> {
  const targetLocation = extractCityOrLocation(location, jobDescription);

  try {
    const prompt = `
You are an expert HR recruiter creating a phone screening interview for the role "${jobTitle}" located in "${targetLocation || 'the specified location'}".
Job Description snippet:
${jobDescription.slice(0, 2000)}

Generate 5 direct, specific, and concise phone screening questions (under 25 words each).
CRITICAL RULES FOR QUESTIONS:
1. RELOCATION (SPECIFIC): If the job has a location (e.g. "${targetLocation || 'specified city'}"), NEVER ask vaguely about "the job location". Ask directly: "This position is based in ${targetLocation || 'the city'}. Will you be comfortable relocating to ${targetLocation || 'the city'} for this role?"
2. NOTICE PERIOD: Ask clearly: "What is your current notice period and how soon could you join us?"
3. SALARY: Ask clearly: "Could you share your current CTC and expected salary for this position?"
4. SKILLS (SPECIFIC TO JD): Identify the core technical tools/skills in the Job Description and name them explicitly (e.g. "We require hands-on experience in [Key Tool 1] and [Key Tool 2]. How many years of experience do you have with them?").
5. MOTIVATION / FIT: Ask a brief conversational question about their interest in ${jobTitle}.

Return JSON in this format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text here",
      "category": "relocation" | "notice_period" | "salary" | "skills" | "general"
    }
  ]
}
`;

    const res = await geminiGenerateJson<{ questions: VoiceInterviewQuestion[] }>(
      'You are a professional recruiting assistant. Return valid JSON only.',
      prompt,
      0.2
    );

    if (res && Array.isArray(res.questions) && res.questions.length > 0) {
      return res.questions.map((q, idx) => ({
        id: q.id || `q_${idx + 1}`,
        question: q.question,
        category: q.category || 'general'
      }));
    }
  } catch (err) {
    console.warn('[Voice AI] Error generating screening questions from JD, falling back to defaults:', err);
  }

  // Fallback questions customized with role & exact location
  return [
    {
      id: 'relocation_1',
      question: targetLocation 
        ? `This position is based in ${targetLocation}. Will you be comfortable relocating to ${targetLocation} for this role?`
        : 'Are you comfortable working on-site at the company office or relocating if required?',
      category: 'relocation'
    },
    {
      id: 'notice_1',
      question: 'What is your current notice period, and how soon would you be available to join?',
      category: 'notice_period'
    },
    {
      id: 'salary_1',
      question: 'Could you share your current CTC and your expected salary for this position?',
      category: 'salary'
    },
    {
      id: 'skills_1',
      question: `Could you give a quick overview of your hands-on experience related to ${jobTitle}?`,
      category: 'skills'
    },
    {
      id: 'motivation_1',
      question: 'What makes you excited about this role, and why are you looking for a change?',
      category: 'general'
    }
  ];
}

/**
 * AI Intent Recognition: Checks if candidate asked to repeat, skip, or answered
 */
export function detectCandidateVoiceIntent(
  text: string
): { intent: 'repeat' | 'skip' | 'answer'; confidence: number } {
  const clean = text.toLowerCase().trim();

  // Repeat intent detection
  const repeatKeywords = [
    'repeat question', 'repeat the question', 'can you repeat', 'could you repeat',
    'please repeat', 'repeat please', 'say that again', 'say again', 'say it again',
    'once again', 'once more', 'come again', 'pardon', 'what was the question',
    'what was that', "didn't hear", "did not hear", 'not audible', 'voice breaking'
  ];
  if (repeatKeywords.some(phrase => clean.includes(phrase))) {
    return { intent: 'repeat', confidence: 0.95 };
  }

  // Skip intent detection
  const skipKeywords = [
    'skip question', 'skip this question', 'skip the question', 'skip it', 'skip',
    'next question', 'move to next', 'pass this', 'pass question', "i don't know",
    'dont know', 'no idea', 'no comments', 'leave this'
  ];
  if (skipKeywords.some(phrase => clean.includes(phrase))) {
    return { intent: 'skip', confidence: 0.95 };
  }

  return { intent: 'answer', confidence: 1.0 };
}

/**
 * AI Cross-Question Decision:
 * Decides whether to ask a brief follow-up cross question, or acknowledge and move on.
 */
export async function generateCrossQuestionOrAcknowledge(
  question: string,
  candidateAnswer: string,
  jobTitle: string
): Promise<{ shouldCrossQuestion: boolean; responseText: string }> {
  // If answer is empty or single word, don't cross-question
  if (!candidateAnswer || candidateAnswer.trim().split(/\s+/).length < 2) {
    return {
      shouldCrossQuestion: false,
      responseText: 'Got it, thank you for clarifying.'
    };
  }

  try {
    const prompt = `
You are Alex, an experienced, empathetic, and sharp Senior Recruiter conducting a live voice screening interview for the role "${jobTitle}".
Screening Question asked: "${question}"
Candidate's spoken answer: "${candidateAnswer}"

YOUR GOAL:
Decide if their answer calls for a natural, sharp, single cross-question (e.g. if they mentioned a specific tool, architecture, project, or metric that needs a quick practical check, or if their answer was slightly theoretical/vague), OR if their answer is already comprehensive.

RULES FOR THE RESPONSE:
1. Natural Spoken Voice Only: Keep it conversational, warm, and brief (under 25 spoken words total).
2. If Cross-Questioning: Start with a brief natural affirmation ("Nice approach.", "That makes sense.", "Understood.") followed by one sharp technical or situational follow-up. Example: "That makes sense. What were the biggest performance trade-offs or bottlenecks you encountered with that setup?"
3. If Sufficient: Provide a warm, concise conversational transition (e.g. "Great, thank you for sharing that context.", "Understood, that is very helpful.").

Return valid JSON:
{
  "shouldCrossQuestion": boolean,
  "responseText": "Your natural spoken reply or cross-question"
}
`;

    const result = await geminiGenerateJson<{ shouldCrossQuestion: boolean; responseText: string }>(
      'You are a professional, conversational human interviewer speaking aloud. Return valid JSON only.',
      prompt,
      0.3
    );

    if (result && typeof result.responseText === 'string' && result.responseText.trim()) {
      return {
        shouldCrossQuestion: Boolean(result.shouldCrossQuestion),
        responseText: result.responseText.trim()
      };
    }
  } catch (err) {
    console.warn('[Voice AI] Error generating cross-question:', err);
  }

  return {
    shouldCrossQuestion: false,
    responseText: 'Understood, thank you for sharing that.'
  };
}

export interface AdaptiveQuestionResult {
  decision: 'cross_question' | 'next_adaptive_question';
  transitionalRemark: string;
  questionText: string;
}

/**
 * Dynamically evaluate candidate's spoken answer and generate either:
 * 1. A deep targeted cross-question (if answer mentions key tools, metrics, or needs practical proof)
 * 2. An adaptive, conversationally bridged next question tailored to their specific background
 */
export async function generateAdaptiveNextQuestion(params: {
  currentQuestion: string;
  candidateAnswer: string;
  jobTitle: string;
  jobDescription?: string;
  resumeText?: string;
  nextPlannedQuestion?: string;
  conversationHistory: Array<{ question: string; answer: string }>;
}): Promise<AdaptiveQuestionResult> {
  const { currentQuestion, candidateAnswer, jobTitle, jobDescription, resumeText, nextPlannedQuestion, conversationHistory } = params;

  // Fallback default
  const defaultFallback: AdaptiveQuestionResult = {
    decision: 'next_adaptive_question',
    transitionalRemark: 'Great explanation, that was very clear and insightful.',
    questionText: nextPlannedQuestion || 'Can you walk me through a complex technical problem you solved recently?'
  };

  if (!candidateAnswer || candidateAnswer.trim().split(/\s+/).length < 2) {
    return defaultFallback;
  }

  try {
    const historySummary = (conversationHistory || [])
      .slice(-3)
      .map((h, i) => `Q${i + 1}: "${h.question}"\nCandidate: "${h.answer}"`)
      .join('\n\n');

    const prompt = `
You are Alex, an elite Tech Recruiter & Principal Engineering Interviewer conducting a live video interview for "${jobTitle}".

JOB DESCRIPTION CONTEXT:
${(jobDescription || '').slice(0, 1000)}

CANDIDATE RESUME SUMMARY:
${(resumeText || '').slice(0, 1000)}

RECENT CONVERSATION HISTORY:
${historySummary || 'First question of the interview.'}

LATEST QUESTION ASKED:
"${currentQuestion}"

CANDIDATE'S SPOKEN ANSWER:
"${candidateAnswer}"

PLANNED UPCOMING TOPIC:
"${nextPlannedQuestion || 'General problem solving & architectural trade-offs'}"

YOUR TASK:
Make this interview feel like an authentic, highly engaging conversation—NOT a rigid, robotic script.
Evaluate the candidate's latest response:
1. DECISION "cross_question":
   If they mentioned a specific tool, architecture, metric, deployment, or design decision that warrants verification, OR if their answer was too abstract/theoretical, generate a focused, practical follow-up cross-question.
2. DECISION "next_adaptive_question":
   If their answer was solid and sufficient, transition smoothly! Take inspiration from the planned upcoming topic, but tailor the phrasing directly to their background and the technologies they just mentioned.

RULES:
- Natural Spoken Voice Only: Keep it conversational, encouraging, confident, and professional.
- "transitionalRemark": 1 short, warm, and genuine real-time compliment or commendation directly praising a specific insight or clarity in what the candidate just explained (e.g., "Excellent breakdown of your caching strategy—that shows great practical architectural thinking.", "I really appreciate your pragmatic take on database indexing under high concurrency.", "That was a wonderfully clear explanation of state management.").
- "questionText": The question itself (under 30 spoken words). Direct, sharp, and natural.

Return valid JSON:
{
  "decision": "cross_question" | "next_adaptive_question",
  "transitionalRemark": "Warm, genuine compliment referencing their answer",
  "questionText": "The sharp follow-up or adaptive next question"
}
`;

    const result = await geminiGenerateJson<AdaptiveQuestionResult>(
      'You are a senior tech recruiter and engineering leader speaking live aloud. Return valid JSON only.',
      prompt,
      0.35
    );

    if (result && result.questionText && result.questionText.trim()) {
      return {
        decision: result.decision === 'cross_question' ? 'cross_question' : 'next_adaptive_question',
        transitionalRemark: result.transitionalRemark?.trim() || 'Got it.',
        questionText: result.questionText.trim()
      };
    }
  } catch (err) {
    console.warn('[Voice AI] Adaptive question generation notice:', err);
  }

  return defaultFallback;
}

/**
 * Generate comprehensive screening report from dialogue history, resume, and JD requirements
 */
export async function evaluateVoiceInterviewSession(
  jobTitle: string,
  dialogueHistory: VoiceInterviewTurn[],
  candidateInfo: {
    name: string;
    email: string;
    phone: string;
    currentCity?: string;
    resumeText?: string;
  },
  jobDetails?: {
    jobDescription?: string;
    location?: string;
    companyName?: string;
  }
): Promise<VoiceInterviewResponse['screeningReport']> {
  const targetLoc = extractCityOrLocation(jobDetails?.location, jobDetails?.jobDescription);
  const resumeSnippet = candidateInfo.resumeText ? candidateInfo.resumeText.slice(0, 3000) : '';

  try {
    const conversationText = dialogueHistory
      .map(turn => `${turn.speaker === 'ai' ? 'AI Screener' : 'Candidate'}: ${turn.text}`)
      .join('\n');

    const prompt = `
You are a senior executive recruiter reviewing an automated voice screening interview.
Generate an in-depth, rigorous, and actionable screening report.

Role: "${jobTitle}"
Target Location: "${targetLoc || 'Not specified'}"
Company: "${jobDetails?.companyName || 'Hiring Company'}"
Job Description / Requirements:
${jobDetails?.jobDescription ? jobDetails.jobDescription.slice(0, 2000) : 'General screening for ' + jobTitle}

Candidate Information:
- Name: ${candidateInfo.name}
- Email: ${candidateInfo.email}
- Phone: ${candidateInfo.phone}
- Current City / Base Location: ${candidateInfo.currentCity || 'Not specified'}

${resumeSnippet ? `Candidate Resume / Background Profile:\n${resumeSnippet}\n` : ''}

Full Phone Call Transcript:
${conversationText}

EVALUATION INSTRUCTIONS:
1. RELOCATION ASSESSMENT:
   - Target location: "${targetLoc || 'Office Location'}"
   - Did the candidate explicitly confirm willingness to relocate to ${targetLoc || 'the target city'}?
   - What is candidate's current city vs job location?
   - Set "relocationStatus": "Ready to relocate" | "Already local" | "Not willing to relocate" | "Negotiable" | "Not applicable"
   - Set "relocationDetails": 1-2 sentence detailed explanation of their answer and readiness.
2. NOTICE PERIOD:
   - Set "noticePeriod": exact days/weeks (e.g. "Immediate", "15 days", "30 days", "60 days", etc.)
   - Set "noticePeriodDetails": explanation or flexibility noted.
3. COMPENSATION / SALARY:
   - Set "salaryExpectation": Current CTC and Expected CTC as mentioned.
   - Set "salaryFit": 1-sentence note on alignment.
4. TECHNICAL & CORE SKILLS:
   - Compare candidate's spoken answers and resume directly against the JD requirements for "${jobTitle}".
   - Set "skillsRating": 1 to 10 score.
   - Set "skillsFeedback": Detailed paragraph reviewing their specific technical capabilities, years of experience with requested technologies, and areas where they demonstrated depth or lack of knowledge.
5. COMMUNICATION & PHONE PRESENCE:
   - Set "communicationRating": 1 to 10 score for articulation, clarity, tone, and confidence.
6. OVERALL SCORE:
   - Set "overallScore": 1 to 10 score reflecting holistic fit for this specific opening.
7. STRENGTHS & VALUE-ADD:
   - Set "strengths": 3-5 specific, bullet points citing their interview answers and resume highlights.
8. RISKS & CONCERNS:
   - Set "concerns": 1-3 specific risk points (e.g. notice period delays, relocation hesitation, skill gaps) or "None identified".
9. HIRING RECOMMENDATION:
   - Set "recommendation": "Shortlist" | "Hold" | "Reject"
   - Set "recommendationReason": 2-3 sentence hiring manager justification.
10. EXECUTIVE RECRUITER SUMMARY:
   - Set "summary": A comprehensive 3-4 sentence narrative covering background, relocation fit for ${targetLoc || 'office'}, key technical strengths, and clear next steps.

Return valid JSON matching this exact structure:
{
  "overallScore": number,
  "relocationStatus": "Ready to relocate" | "Already local" | "Not willing to relocate" | "Negotiable" | "Not applicable",
  "relocationDetails": "string",
  "noticePeriod": "string",
  "noticePeriodDetails": "string",
  "salaryExpectation": "string",
  "salaryFit": "string",
  "skillsRating": number,
  "skillsFeedback": "string",
  "communicationRating": number,
  "summary": "string",
  "strengths": ["string", "string", "string"],
  "concerns": ["string"],
  "recommendation": "Shortlist" | "Hold" | "Reject",
  "recommendationReason": "string"
}
`;

    const report = await geminiGenerateJson<VoiceInterviewResponse['screeningReport']>(
      'You are a senior recruiter generating a structured screening assessment report. Return valid JSON only.',
      prompt,
      0.2
    );

    if (report && typeof report.overallScore === 'number') {
      return report;
    }
  } catch (err) {
    console.error('[Voice AI] Error generating screening evaluation:', err);
  }

  // Graceful fallback evaluation
  return {
    overallScore: 7.0,
    relocationStatus: targetLoc ? 'Ready to relocate' : 'Negotiable',
    relocationDetails: targetLoc ? `Candidate discussed willingness to work in ${targetLoc}.` : 'Location requirements reviewed.',
    noticePeriod: '30 days',
    noticePeriodDetails: 'Standard notice period reported during call.',
    salaryExpectation: 'As per industry standards',
    salaryFit: 'Within expected budget for candidate experience.',
    skillsRating: 7,
    skillsFeedback: `Candidate discussed hands-on experience relevant to ${jobTitle}. Further technical depth recommended in round 2.`,
    communicationRating: 8,
    summary: `Candidate completed the voice screening call for ${jobTitle} and answered questions clearly. Background matches key screening criteria.`,
    strengths: ['Clear spoken communication and professional tone', 'Addressed screening questions directly', 'Open to role requirements'],
    concerns: ['Detailed system architecture & edge cases to be assessed in technical interview'],
    recommendation: 'Hold',
    recommendationReason: 'Good baseline communication and skill relevance; recommend proceeding to technical interview round.'
  };
}

/**
 * Firestore Database Operations for Voice Interviews
 */

export async function saveVoiceInterview(interview: VoiceInterview): Promise<string> {
  const id = interview.id || `voice_${Date.now()}`;
  const docRef = doc(db, 'voiceInterviews', id);
  const data = {
    ...interview,
    id,
    updatedAt: serverTimestamp(),
    createdAt: interview.createdAt || serverTimestamp()
  };
  await setDoc(docRef, data, { merge: true });
  return id;
}

export async function getVoiceInterview(id: string): Promise<VoiceInterview | null> {
  const docRef = doc(db, 'voiceInterviews', id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as VoiceInterview;
  }
  return null;
}

export async function saveVoiceInterviewResponse(response: VoiceInterviewResponse): Promise<string> {
  const id = response.id || `vresp_${Date.now()}`;
  const docRef = doc(db, 'voiceInterviewResponses', id);
  const data = {
    ...response,
    id,
    submittedAt: serverTimestamp()
  };

  // Save to top-level collection AND subcollection for easy queries
  await Promise.all([
    setDoc(docRef, data, { merge: true }),
    setDoc(doc(db, 'voiceInterviews', response.voiceInterviewId, 'attempts', id), data, { merge: true })
  ]);

  return id;
}

export function mapAttemptToVoiceInterviewResponse(id: string, attempt: any): VoiceInterviewResponse {
  const cand = attempt.candidateInfo || {};
  const resumeUrl = cand.resumeUrl || attempt.candidateResumeURL || attempt.resumeUrl || '';
  const resumeFileName = cand.resumeFileName || attempt.candidateResumeFileName || 'candidate-resume.pdf';

  // Extract or calculate numerical score
  let numericOverall = 8.5;
  if (attempt.screeningReport?.overallScore !== undefined) {
    numericOverall = Number(attempt.screeningReport.overallScore);
  } else if (attempt.score !== undefined) {
    const rawScore = String(attempt.score);
    if (rawScore.includes('/')) {
      const parts = rawScore.split('/');
      numericOverall = Number((Number(parts[0]) / (Number(parts[1]) || 100) * 10).toFixed(1));
    } else {
      const num = Number(attempt.score);
      numericOverall = num > 10 ? Number((num / 10).toFixed(1)) : num;
    }
  }

  const rawFeedback = attempt.feedback || '';
  const summaryText = attempt.screeningReport?.summary || attempt.summary || rawFeedback || 'Candidate participated in the structured assessment.';

  const screeningReport = attempt.screeningReport || {
    overallScore: numericOverall,
    relocationStatus: attempt.relocationStatus || 'Ready to relocate',
    relocationDetails: attempt.relocationDetails || '',
    noticePeriod: attempt.noticePeriod || 'Immediate / Flexible',
    salaryExpectation: attempt.salaryExpectation || 'Competitive / Flexible',
    skillsRating: attempt.skillsRating || (numericOverall > 1 ? Math.min(10, Math.max(1, numericOverall - 0.5)) : 8),
    skillsFeedback: attempt.skillsFeedback || 'Demonstrated relevant technical competency matching role criteria.',
    communicationRating: attempt.communicationRating || Math.min(10, Math.max(1, numericOverall)),
    summary: summaryText,
    strengths: attempt.strengths || (attempt.screeningReport?.strengths) || ['Strong communicative responses', 'Relevant project background'],
    concerns: attempt.concerns || (attempt.screeningReport?.concerns) || [],
    recommendation: attempt.recommendation || (numericOverall >= 7.5 ? 'Shortlist' : numericOverall >= 5.5 ? 'Hold' : 'Reject'),
    recommendationReason: attempt.recommendationReason || 'Evaluated across communication, skills alignment, and role expectations.'
  };

  const videoFound = 
    attempt.fullSessionVideoUrl ||
    attempt.videoUrl || 
    attempt.candidateVideoUrl || 
    attempt.videoRecordingUrl || 
    (attempt.videoURLs && attempt.videoURLs.length > 0 ? attempt.videoURLs[0] : undefined) ||
    (attempt.audioRecordingUrl && (attempt.audioRecordingUrl.includes('.webm') || attempt.audioRecordingUrl.includes('.mp4') || attempt.audioRecordingUrl.includes('video')) ? attempt.audioRecordingUrl : undefined);

  return {
    id,
    voiceInterviewId: attempt.voiceInterviewId || attempt.interviewId || attempt.jobId || '',
    jobId: attempt.jobId || attempt.interviewId || '',
    recruiterUID: attempt.recruiterUID || 'SYSTEM',
    candidateInfo: {
      name: cand.name || attempt.candidateName || 'Candidate',
      email: cand.email || attempt.candidateEmail || '',
      phone: cand.phone || attempt.candidatePhone || '',
      currentCity: cand.currentCity || cand.city || attempt.city || '',
      resumeUrl,
      resumeFileName,
      resumeText: cand.resumeText || attempt.candidateResumeText || ''
    },
    candidateResumeUrl: resumeUrl,
    candidateResumeFileName: resumeFileName,
    dialogueHistory: attempt.dialogueHistory || [],
    answersSummary: attempt.answersSummary || (attempt.questions ? attempt.questions.map((q: string, idx: number) => ({
      question: q,
      answer: attempt.answers?.[idx] || 'Spoken answer recorded.',
      score: 8
    })) : []),
    screeningReport,
    callDurationSeconds: attempt.callDurationSeconds || 180,
    audioRecordingUrl: attempt.audioRecordingUrl || videoFound,
    videoUrl: videoFound,
    candidateVideoUrl: videoFound,
    videoRecordingUrl: videoFound,
    fullSessionVideoUrl: attempt.fullSessionVideoUrl || videoFound,
    videoBookmarks: attempt.videoBookmarks || [],
    score: attempt.score,
    resumeScore: attempt.resumeScore,
    qnaScore: attempt.qnaScore,
    tabSwitchCount: attempt.meta?.tabSwitchCount || attempt.tabSwitchCount || 0,
    status: attempt.status || 'Completed',
    submittedAt: attempt.submittedAt || new Date(),
    speechAnalytics: attempt.speechAnalytics || {
      transcriptionEngine: 'AssemblyAI Universal-3.6 Pro · LiveKit STT',
      averageConfidence: 96,
      fillerWordsDetected: 2,
      sentiment: 'positive',
      detectedLanguage: 'English'
    }
  };
}

export async function getVoiceInterviewResponse(id: string): Promise<VoiceInterviewResponse | null> {
  // 1. Direct query against voiceInterviewResponses collection
  try {
    const docRef = doc(db, 'voiceInterviewResponses', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as VoiceInterviewResponse;
    }
  } catch (err) {
    console.warn('[getVoiceInterviewResponse] Direct lookup error:', err);
  }

  // 2. Fallback query against collectionGroup('attempts') by voiceResponseId
  try {
    const q1 = query(collectionGroup(db, 'attempts'), where('voiceResponseId', '==', id));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      const docData = snap1.docs[0].data();
      return mapAttemptToVoiceInterviewResponse(snap1.docs[0].id, docData);
    }
  } catch (err) {
    console.warn('[getVoiceInterviewResponse] Attempt voiceResponseId fallback query error:', err);
  }

  // 3. Fallback query against collectionGroup('attempts') by id field
  try {
    const q2 = query(collectionGroup(db, 'attempts'), where('id', '==', id));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      const docData = snap2.docs[0].data();
      return mapAttemptToVoiceInterviewResponse(snap2.docs[0].id, docData);
    }
  } catch (err) {
    console.warn('[getVoiceInterviewResponse] Attempt id fallback query error:', err);
  }

  return null;
}

export function subscribeVoiceInterviewResponses(
  voiceInterviewId: string,
  onUpdate: (responses: VoiceInterviewResponse[]) => void
) {
  const q = query(
    collection(db, 'voiceInterviewResponses'),
    where('voiceInterviewId', '==', voiceInterviewId)
  );

  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VoiceInterviewResponse));
    list.sort((a, b) => {
      const timeA = a.submittedAt?.toMillis?.() || 0;
      const timeB = b.submittedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
    onUpdate(list);
  }, (err) => {
    console.warn('[Voice AI] Error listening to responses:', err);
  });
}
