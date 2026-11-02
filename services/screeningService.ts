/**
 * Screening Service for Quick Apply Pre-Screening Questions
 * Generates tailored screening questions from Job Descriptions (JD),
 * evaluates candidate responses, and calculates verified match scores.
 */

export interface ScreeningQuestion {
  id: string;
  question: string;
  type: 'yes_no' | 'short_text' | 'number';
  category?: 'experience' | 'skills' | 'relocation' | 'notice_period' | 'education' | 'custom';
  expectedAnswer?: string; // 'yes' | 'no' | number
  required: boolean;
}

export interface CandidateScreeningAnswer {
  questionId: string;
  question: string;
  type: 'yes_no' | 'short_text' | 'number';
  answer: string;
  expectedAnswer?: string;
  isPassed: boolean;
  category?: string;
}

export interface ScreenerEvaluationResult {
  answers: CandidateScreeningAnswer[];
  passedCount: number;
  totalCount: number;
  passPercentage: number;
  screenerScore: number;
  enhancedMatchScore: number;
  summary: string;
}

/**
 * Automatically generate smart screening questions from a job's details and JD
 */
export function generateDefaultScreeningQuestions(job: any): ScreeningQuestion[] {
  if (!job) return [];
  const questions: ScreeningQuestion[] = [];
  const ts = Date.now();
  const title = job.title || job.role || 'this role';
  const location = job.location || job.city || '';
  const jdText = (job.description || job.jobDescription || job.extractedText || '').toString();

  // 1. Extract key skills from skills array, string, or JD text
  let skillsText = '';
  if (Array.isArray(job.skills) && job.skills.length > 0) {
    skillsText = job.skills.slice(0, 3).join(', ');
  } else if (typeof job.skills === 'string' && job.skills.trim()) {
    skillsText = job.skills.split(',').slice(0, 3).map((s: string) => s.trim()).join(', ');
  } else if (Array.isArray(job.requiredSkills) && job.requiredSkills.length > 0) {
    skillsText = job.requiredSkills.slice(0, 3).join(', ');
  }

  // Fallback: extract prominent skills if skillsText is still empty
  if (!skillsText && jdText) {
    const commonTech = ['React', 'Node.js', 'Python', 'Java', 'SQL', 'TypeScript', 'AWS', 'AutoCAD', 'SolidWorks', 'ISO 9001', 'Quality Control', 'Six Sigma', 'Excel', 'Digital Marketing', 'Sales'];
    const found = commonTech.filter(tech => new RegExp(`\\b${tech}\\b`, 'i').test(jdText));
    if (found.length > 0) {
      skillsText = found.slice(0, 3).join(', ');
    }
  }

  const minExp = job.minExperience ?? (typeof job.experience === 'number' ? job.experience : parseFloat(String(job.experience || '')) || 0);

  // 1. Experience Question (Numeric / Number)
  questions.push({
    id: `sq_exp_${ts}_1`,
    question: minExp > 0
      ? `How many years of relevant experience do you have in ${title}? (Requirement: ${minExp}+ yrs)`
      : `How many years of total relevant experience do you have in ${title}?`,
    type: 'number',
    category: 'experience',
    expectedAnswer: minExp > 0 ? String(minExp) : '0',
    required: true,
  });

  // 2. Key Skills Confirmation (Yes / No)
  if (skillsText) {
    questions.push({
      id: `sq_skills_${ts}_2`,
      question: `Do you have hands-on practical experience in ${skillsText}?`,
      type: 'yes_no',
      category: 'skills',
      expectedAnswer: 'yes',
      required: true,
    });
  } else {
    questions.push({
      id: `sq_skills_${ts}_2`,
      question: `Do you meet the core technical and functional requirements listed for ${title}?`,
      type: 'yes_no',
      category: 'skills',
      expectedAnswer: 'yes',
      required: true,
    });
  }

  // 3. Education / Qualification (Yes / No) if specified in job
  const qual = job.qualifications || job.education || '';
  if (qual && typeof qual === 'string' && qual.trim().length > 2) {
    questions.push({
      id: `sq_edu_${ts}_3`,
      question: `Do you have a degree or certification in ${qual.trim()}?`,
      type: 'yes_no',
      category: 'education',
      expectedAnswer: 'yes',
      required: true,
    });
  }

  // 4. Relocation & Location Confirmation (Yes / No)
  if (location && !location.toLowerCase().includes('remote') && !location.toLowerCase().includes('any')) {
    questions.push({
      id: `sq_relocation_${ts}_4`,
      question: `Are you currently based in ${location} or comfortable relocating / commuting to ${location}?`,
      type: 'yes_no',
      category: 'relocation',
      expectedAnswer: 'yes',
      required: true,
    });
  } else {
    questions.push({
      id: `sq_relocation_${ts}_4`,
      question: `Are you comfortable with the work arrangement (Remote / Hybrid / On-site) for this position?`,
      type: 'yes_no',
      category: 'relocation',
      expectedAnswer: 'yes',
      required: true,
    });
  }

  // 5. Notice Period Confirmation (Short Text / One-Word)
  questions.push({
    id: `sq_notice_${ts}_5`,
    question: `What is your official notice period (e.g., Immediate, 15 Days, 30 Days)?`,
    type: 'short_text',
    category: 'notice_period',
    required: true,
  });

  return questions;
}

/**
 * Evaluate screening answers and calculate the enhanced matching score
 */
export function evaluateScreeningAnswers(
  questions: ScreeningQuestion[],
  answersMap: Record<string, string>,
  baseResumeScore: number = 75,
  job?: any
): ScreenerEvaluationResult {
  const evaluatedAnswers: CandidateScreeningAnswer[] = [];
  let passedCount = 0;

  const minExp = job?.minExperience ?? (typeof job?.experience === 'number' ? job.experience : parseFloat(String(job?.experience || '')) || 0);

  questions.forEach((q) => {
    const rawAns = (answersMap[q.id] || '').trim();
    const lowerAns = rawAns.toLowerCase();
    let isPassed = false;

    if (q.type === 'yes_no') {
      const target = (q.expectedAnswer || 'yes').toLowerCase();
      isPassed = lowerAns === target || (target === 'yes' && (lowerAns === 'y' || lowerAns.includes('yes') || lowerAns === 'true'));
    } else if (q.type === 'number') {
      const parsedNum = Math.max(0, parseFloat(rawAns.replace(/[^0-9.]/g, '')) || 0);
      const requiredNum = Math.max(0, parseFloat(String(q.expectedAnswer || minExp || '0')) || 0);
      isPassed = requiredNum > 0 ? parsedNum >= requiredNum : parsedNum >= 0;
    } else {
      // Short text (e.g. Notice period)
      if (q.category === 'notice_period') {
        isPassed = rawAns.length > 0 && !lowerAns.includes('90') && !lowerAns.includes('3 month');
      } else {
        isPassed = rawAns.length > 0;
      }
    }

    if (isPassed) {
      passedCount += 1;
    }

    evaluatedAnswers.push({
      questionId: q.id,
      question: q.question,
      type: q.type,
      category: q.category,
      answer: rawAns || 'Not Answered',
      expectedAnswer: q.expectedAnswer,
      isPassed,
    });
  });

  const totalCount = questions.length || 1;
  const passPercentage = Math.round((passedCount / totalCount) * 100);
  const screenerScore = passPercentage;

  // Enhanced Match Score blending resume score (55%) with verified screener score (45%)
  let enhancedMatchScore = Math.round((baseResumeScore * 0.55) + (screenerScore * 0.45));

  // If candidate passed 100% of screener criteria, grant a verified excellence bonus
  if (passedCount === totalCount) {
    enhancedMatchScore = Math.max(enhancedMatchScore, Math.min(98, baseResumeScore + 12));
  } else if (passedCount === 0) {
    enhancedMatchScore = Math.min(40, baseResumeScore);
  }

  enhancedMatchScore = Math.min(99, Math.max(20, enhancedMatchScore));

  const summary = `${passedCount}/${totalCount} Criteria Verified (${passPercentage}% Pass Rate)`;

  return {
    answers: evaluatedAnswers,
    passedCount,
    totalCount,
    passPercentage,
    screenerScore,
    enhancedMatchScore,
    summary,
  };
}
