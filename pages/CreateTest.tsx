import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Check,
  Code,
  FileText,
  Link as LinkIcon,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock,
  Target,
  Layers,
  CheckCircle,
  ArrowRight,
  Sliders,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Settings2,
  Paperclip,
  X,
  FileUp
} from 'lucide-react';
import { grokGenerateJson } from '../services/grokService';
import { useMessageBox } from '../components/MessageBox';
import { useCompanyRateLimits } from '../hooks/useRecruiterRateLimits';
import { getRateLimitReachedMessage, isRateLimitReached, RateLimitResource } from '../services/rateLimitService';
import { readResumeText } from '../services/resumeService';

const CreateTest: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { testId: paramTestId } = useParams();
  const editId = searchParams.get('editId') || paramTestId;
  const isEditing = Boolean(editId);
  const [loadingExistingTest, setLoadingExistingTest] = useState(Boolean(editId));

  const { showError, showSuccess } = useMessageBox();
  const { status: rateLimitStatus, loading: rateLimitLoading, refresh: refreshRateLimit } = useCompanyRateLimits();
  
  const initialType = searchParams.get('type') === 'coding' ? 'coding' : 'aptitude';
  const [type, setType] = useState<'aptitude' | 'coding'>(initialType);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(10);
  const [questions, setQuestions] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [nextInterviewId, setNextInterviewId] = useState('');
  const [recruiterInterviews, setRecruiterInterviews] = useState<any[]>([]);
  const [automationType, setAutomationType] = useState<'internal' | 'external'>('internal');
  const [externalLink, setExternalLink] = useState('');
  const [externalAccessCode, setExternalAccessCode] = useState('');
  
  const activeLimitResource: RateLimitResource = type === 'coding' ? 'codingAssessments' : 'assessments';
  const activeLimitReached = !isEditing && isRateLimitReached(rateLimitStatus, activeLimitResource);

  // AI Question Generator Controls & Customization
  const [aiDifficulty, setAiDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed');
  const [aiQuestionType, setAiQuestionType] = useState<string>('mixed');
  const [aiSeniority, setAiSeniority] = useState<'entry' | 'mid' | 'senior' | 'lead'>('mid');
  const [aiCount, setAiCount] = useState<number>(initialType === 'coding' ? 1 : 5);
  const [aiCustomNotes, setAiCustomNotes] = useState<string>('');
  const [aiCodingLang, setAiCodingLang] = useState<string>('Any');
  const [showAdvancedAi, setShowAdvancedAi] = useState<boolean>(true);

  // Attached PDF / Reference Document for AI Generation
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState<string>('');
  const [pdfText, setPdfText] = useState<string>('');
  const [parsingPdf, setParsingPdf] = useState<boolean>(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.docx') && !lowerName.endsWith('.txt')) {
      showError('Please upload a PDF (.pdf), Word document (.docx), or text file (.txt).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showError('File size exceeds 20MB limit.');
      return;
    }

    setParsingPdf(true);
    try {
      const extracted = await readResumeText(file, file.name);
      if (!extracted || extracted.trim().length < 15) {
        throw new Error('No readable text found in document. Please verify the PDF is not a scanned image.');
      }
      setPdfFile(file);
      setPdfName(file.name);
      setPdfText(extracted);
      showSuccess(`Attached "${file.name}" (~${Math.round(extracted.length / 5)} words extracted). AI will strictly generate questions from this document.`);
    } catch (err: any) {
      console.error('Document parse error:', err);
      showError(err?.message || 'Failed to extract text from document. Please try another file.');
    } finally {
      setParsingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfName('');
    setPdfText('');
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const [manualQ, setManualQ] = useState({
    question: '',
    options: ['', '', '', ''],
    correct: 0,
    difficulty: 'medium',
    questionType: 'theoretical',
    explanation: '',
  });
  const [manualCodeQ, setManualCodeQ] = useState({
    title: '',
    description: '',
    testCases: '',
    difficulty: 'medium',
    questionType: 'dsa',
    hints: '',
  });

  useEffect(() => {
    if (!editId) {
      const requestedType = searchParams.get('type');
      if (requestedType === 'aptitude' || requestedType === 'coding') {
        setType(requestedType);
      }
    }
  }, [searchParams, editId]);

  useEffect(() => {
    if (!editId) return;
    const fetchExistingTest = async () => {
      setLoadingExistingTest(true);
      try {
        const testSnap = await getDoc(doc(db, 'tests', editId));
        if (testSnap.exists()) {
          const data = testSnap.data();
          setTitle(data.title || '');
          if (data.type === 'coding' || data.type === 'aptitude') {
            setType(data.type);
          }
          if (data.duration) setDuration(Number(data.duration));
          if (data.passingScore !== undefined) setPassingScore(Number(data.passingScore));
          if (data.status) {
            setStatus(data.status === 'Inactive' ? 'Inactive' : 'Active');
          } else if (data.isActive === false) {
            setStatus('Inactive');
          } else {
            setStatus('Active');
          }
          if (Array.isArray(data.questions)) setQuestions(data.questions);
          if (data.nextInterviewId) setNextInterviewId(data.nextInterviewId);
          if (data.externalInterviewLink) {
            setAutomationType('external');
            setExternalLink(data.externalInterviewLink);
            setExternalAccessCode(data.externalAccessCode || '');
          }
        } else {
          showError('Assessment not found.');
          navigate('/recruiter/tests');
        }
      } catch (err) {
        console.error('Error fetching test for edit:', err);
        showError('Unable to load assessment for editing.');
      } finally {
        setLoadingExistingTest(false);
      }
    };

    fetchExistingTest();
  }, [editId, navigate, showError]);

  useEffect(() => {
    const fetchInterviews = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(collection(db, 'interviews'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setRecruiterInterviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error loading interviews:', error);
      }
    };

    fetchInterviews();
  }, []);

  const completionItems = useMemo(() => {
    return [
      { step: '01', label: 'Basic Details', desc: 'Title, type & duration', complete: Boolean(title.trim()) && duration > 0 },
      { step: '02', label: 'Scoring Criteria', desc: 'Passing score percentage', complete: passingScore >= 0 && passingScore <= 100 },
      { step: '03', label: 'Questions Bank', desc: `${questions.length} questions configured`, complete: questions.length > 0 },
      {
        step: '04',
        label: 'Candidate Routing',
        desc: automationType === 'internal' ? (nextInterviewId ? 'Interview mapped' : 'None selected') : (externalLink ? 'URL configured' : 'Optional'),
        complete: automationType === 'internal' ? Boolean(nextInterviewId) : Boolean(externalLink.trim()),
        optional: true,
      },
    ];
  }, [automationType, duration, externalLink, nextInterviewId, passingScore, questions.length, title]);

  const handleTypeChange = (nextType: 'aptitude' | 'coding') => {
    if (nextType === type) return;
    setType(nextType);
    setQuestions([]);
    setManualQ({
      question: '',
      options: ['', '', '', ''],
      correct: 0,
      difficulty: 'medium',
      questionType: 'theoretical',
      explanation: '',
    });
    setManualCodeQ({
      title: '',
      description: '',
      testCases: '',
      difficulty: 'medium',
      questionType: 'dsa',
      hints: '',
    });
    setAiCount(nextType === 'coding' ? 1 : 5);
    setAiQuestionType('mixed');
  };

  const handleAiGenerate = async () => {
    const trimmedPrompt = aiPrompt.trim();
    if (!trimmedPrompt) {
      showError('Please enter a role, topic, or tech stack.');
      return;
    }

    setGenerating(true);
    try {
      const count = Math.max(1, Math.min(aiCount, type === 'coding' ? 5 : 20));

      const difficultyDesc = {
        mixed: 'Diverse difficulty mix (~30% easy fundamentals, ~50% medium problem solving, ~20% hard tricky/advanced)',
        easy: 'Difficulty: Easy (Foundations, syntax, core definitions, basic logic)',
        medium: 'Difficulty: Medium (Real-world usage, edge cases, intermediate problem solving)',
        hard: 'Difficulty: Hard (Advanced internal mechanisms, corner cases, deep optimization, tricky pitfalls)',
      }[aiDifficulty];

      const seniorityDesc = {
        entry: 'Target Candidate: Junior / Entry-Level (0-2 years experience)',
        mid: 'Target Candidate: Mid-Level Engineer (2-5 years experience)',
        senior: 'Target Candidate: Senior Engineer (5-8 years experience)',
        lead: 'Target Candidate: Principal / Staff / Tech Lead (8+ years experience)',
      }[aiSeniority];

      const typeDescAptitude = {
        mixed: 'Question Style: Balanced combination of conceptual/theoretical questions, code output/debugging questions, and scenario-based architecture questions',
        theoretical: 'Question Style: Theoretical concepts, terminology, language specifications, and architecture theory',
        practical: 'Question Style: Practical code analysis, "What is the output?", bug identification, and snippet debugging',
        scenario: 'Question Style: Real-world engineering scenarios, design decisions, performance bottlenecks, and architectural trade-offs',
        aptitude: 'Question Style: Analytical logic, quantitative aptitude, algorithmic reasoning, and problem solving',
      }[aiQuestionType] || 'Question Style: High-quality technical assessment';

      const typeDescCoding = {
        mixed: 'Problem Style: Balanced practical and algorithmic programming challenges',
        dsa: 'Problem Style: Classic Data Structures & Algorithms (Arrays, Trees, Graphs, Dynamic Programming, Sorting)',
        practical: 'Problem Style: Practical data transformation, API payload validation, business logic implementation',
        bugfix: 'Problem Style: Refactoring and fixing broken algorithms or subtle logic flaws',
        system_design: 'Problem Style: Low-level Object-Oriented design / in-memory data store (e.g., LRU Cache, Rate Limiter)',
      }[aiQuestionType] || 'Problem Style: Practical coding challenges';

      const strictNotes = aiCustomNotes.trim()
        ? `\nCRITICAL MANDATORY INSTRUCTION FROM RECRUITER (STRICT CONSTRAINT): Only generate questions that strictly satisfy these requirements: "${aiCustomNotes.trim()}". Do NOT deviate from or ask anything outside these instructions.`
        : '';

      const pdfConstraint = pdfText.trim()
        ? `\nCRITICAL REFERENCE MATERIAL (${pdfName || 'Attached Document / Syllabus'}):
The recruiter has attached a reference syllabus / specification document. You MUST formulate questions directly from the concepts, APIs, topics, and curriculum detailed in this source material:
"""
${pdfText.slice(0, 4500)}
"""
Prioritize the topics in this attached material. Do NOT ask questions on topics that contradict or fall outside this provided material.`
        : '';

      const codingLangConstraint =
        type === 'coding' && aiCodingLang !== 'Any'
          ? `\nLanguage focus: Formulate problems and sample test cases tailored to ${aiCodingLang}.`
          : '';

      const prompt =
        type === 'aptitude'
          ? `Generate exactly ${count} multiple choice questions about "${trimmedPrompt}".
Requirements:
- ${difficultyDesc}
- ${seniorityDesc}
- ${typeDescAptitude}${codingLangConstraint}${strictNotes}${pdfConstraint}
- Provide 4 distinct options per question. Only ONE must be correct.
- Ensure options are plausible and prevent obvious giveaways.
- Keep question text and explanations concise and direct (1-2 sentences max).
- Do NOT use unescaped double quotes or raw newlines inside JSON strings.

Return ONLY a valid JSON object matching this schema:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "difficulty": "easy" | "medium" | "hard",
      "questionType": "theoretical" | "practical" | "scenario" | "aptitude",
      "explanation": "string"
    }
  ]
}`
          : `Generate exactly ${count} coding problem(s) about "${trimmedPrompt}".
Requirements:
- ${difficultyDesc}
- ${seniorityDesc}
- ${typeDescCoding}${codingLangConstraint}${strictNotes}${pdfConstraint}
- Include a clear title, complete problem statement with constraints and expected complexity, and formatted sample test cases with inputs and outputs.
- Keep problem description and hints concise and direct.
- Do NOT use unescaped double quotes or raw newlines inside JSON strings.

Return ONLY a valid JSON object matching this schema:
{
  "questions": [
    {
      "title": "string",
      "description": "string",
      "testCases": "string",
      "difficulty": "easy" | "medium" | "hard",
      "questionType": "dsa" | "practical" | "bugfix" | "system_design",
      "hints": "string"
    }
  ]
}`;

      const tokenBudget = Math.min(8192, Math.max(2048, count * (type === 'aptitude' ? 450 : 1200)));

      const parsed = await grokGenerateJson<{ questions?: any[]; problems?: any[] }>(
        'You are a world-class technical assessment author and principal interviewer. Return only clean, valid JSON without markdown wrapping. Never leave strings unterminated.',
        prompt,
        0.5,
        tokenBudget
      );

      const generated: any[] = parsed.questions || parsed.problems || [];
      if (!Array.isArray(generated) || generated.length === 0) {
        throw new Error('No valid questions could be generated. Please try again with a more specific topic.');
      }

      setQuestions((currentQuestions) => [...currentQuestions, ...generated]);
      showSuccess(`Successfully generated ${generated.length} question(s) into your Question Bank.`);
    } catch (error: any) {
      console.error('AI Error:', error);
      const errorMsg = error?.message || 'Failed to generate questions. Please try again.';
      showError(errorMsg);
    } finally {
      setGenerating(false);
    }
  };

  const addManualQuestion = () => {
    if (type === 'aptitude') {
      const hasQuestion = manualQ.question.trim();
      const hasOptions = manualQ.options.every(option => option.trim());
      if (!hasQuestion || !hasOptions) {
        showError('Question text and all four options are required.');
        return;
      }

      setQuestions((currentQuestions) => [
        ...currentQuestions,
        {
          question: manualQ.question.trim(),
          options: manualQ.options.map(option => option.trim()),
          correctIndex: Number(manualQ.correct),
          difficulty: manualQ.difficulty || 'medium',
          questionType: manualQ.questionType || 'theoretical',
          explanation: manualQ.explanation?.trim() || '',
        },
      ]);
      setManualQ({
        question: '',
        options: ['', '', '', ''],
        correct: 0,
        difficulty: 'medium',
        questionType: 'theoretical',
        explanation: '',
      });
      showSuccess('Question added to bank.');
      return;
    }

    if (!manualCodeQ.title.trim() || !manualCodeQ.description.trim()) {
      showError('Problem title and description are required.');
      return;
    }

    setQuestions((currentQuestions) => [
      ...currentQuestions,
      {
        title: manualCodeQ.title.trim(),
        description: manualCodeQ.description.trim(),
        testCases: manualCodeQ.testCases.trim(),
        difficulty: manualCodeQ.difficulty || 'medium',
        questionType: manualCodeQ.questionType || 'dsa',
        hints: manualCodeQ.hints?.trim() || '',
      },
    ]);
    setManualCodeQ({
      title: '',
      description: '',
      testCases: '',
      difficulty: 'medium',
      questionType: 'dsa',
      hints: '',
    });
    showSuccess('Coding problem added to bank.');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isEditing) {
      const latestRateLimit = await refreshRateLimit();
      if (!latestRateLimit) {
        showError('Unable to verify the company assessment limit. Please try again.');
        return;
      }
      if (isRateLimitReached(latestRateLimit, activeLimitResource)) {
        showError(getRateLimitReachedMessage(activeLimitResource));
        return;
      }
    }

    if (!title.trim()) {
      showError('Assessment title is required.');
      return;
    }
    if (questions.length === 0) {
      showError('At least one question is required.');
      return;
    }

    setSaving(true);
    try {
      const testData: any = {
        title: title.trim(),
        type,
        duration: Number(duration),
        questions,
        passingScore: Number(passingScore),
        status,
        isActive: status === 'Active',
      };

      if (automationType === 'internal' && nextInterviewId) {
        testData.nextInterviewId = nextInterviewId;
        testData.externalInterviewLink = null;
        testData.externalAccessCode = null;
      } else if (automationType === 'external' && externalLink.trim()) {
        testData.externalInterviewLink = externalLink.trim();
        testData.externalAccessCode = externalAccessCode.trim();
        testData.nextInterviewId = null;
      }

      if (isEditing && editId) {
        testData.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'tests', editId), testData);
        showSuccess('Assessment updated successfully!');
      } else {
        const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        testData.accessCode = accessCode;
        testData.recruiterUID = auth.currentUser?.uid;
        testData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'tests'), testData);
        showSuccess('Assessment created successfully!');
      }

      navigate('/recruiter/tests');
    } catch (error) {
      console.error(error);
      showError(isEditing ? 'Failed to update assessment.' : 'Failed to create assessment.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full h-11 px-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs sm:text-sm text-[#111215] dark:text-[#F8F9F5] placeholder:text-[#73766C] dark:placeholder:text-neutral-500 outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] disabled:cursor-not-allowed disabled:opacity-50";
  const textareaClass = "w-full min-h-[110px] p-4 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs sm:text-sm text-[#111215] dark:text-[#F8F9F5] placeholder:text-[#73766C] dark:placeholder:text-neutral-500 outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C] focus:bg-white dark:focus:bg-[#15161A] leading-relaxed resize-y";
  const selectClass = `${inputClass} cursor-pointer`;
  const labelClass = "text-xs font-bold text-[#111215] dark:text-[#F8F9F5] mb-2 flex items-center justify-between";
  const secondaryButtonClass = "inline-flex h-11 items-center justify-center rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 px-5 font-bold text-xs text-[#111215] dark:text-white transition-all hover:bg-[#F1F3EB] dark:hover:bg-white/10 cursor-pointer shadow-2xs gap-2 disabled:cursor-not-allowed disabled:opacity-40";
  const primaryButtonClass = "inline-flex h-11 items-center justify-center rounded-full bg-[#111215] text-white hover:bg-[#202227] dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c5ea24] px-6 font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 gap-2";

  return (
    <div className="w-full min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] font-sans antialiased selection:bg-[#D4F82C] selection:text-[#111215]">
      
      {/* Top Header */}
      <header className="border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#0D0E11] px-4 py-5 sm:py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2 sm:gap-3 mb-2">
              <button
                type="button"
                onClick={() => navigate('/recruiter/tests')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white hover:border-[#111215] dark:hover:border-white/30 transition-all shadow-2xs shrink-0"
              >
                <ArrowLeft size={13} />
                <span>Assessments</span>
              </button>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[11px] font-bold text-[#111215] dark:text-[#F8F9F5] shadow-2xs max-w-full">
                <span className="size-2 rounded-full bg-[#8FB305] dark:bg-[#D4F82C] animate-pulse shrink-0"></span>
                <span className="font-mono uppercase text-[10px] text-[#73766C] dark:text-neutral-400 shrink-0">{isEditing ? 'EDIT MODE' : 'STUDIO'}</span>
                <span className="text-[#E4E7DC] dark:text-white/20">|</span>
                <span className="truncate">{type === 'coding' ? 'Technical Coding Screen' : 'Aptitude & Logic Screen'}</span>
              </div>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-[#F8F9F5] tracking-tight">
              {isEditing ? 'Edit Assessment' : 'Create Assessment'}
            </h1>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              {isEditing
                ? 'Update assessment configuration, adjust questions bank, scoring benchmarks, or candidate routing.'
                : 'Build a focused candidate screen, configure passing criteria, auto-generate questions with AI, and automate routing into the next interview round.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/recruiter/tests')}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-assessment-form"
              disabled={saving || generating || questions.length === 0 || (!isEditing && (rateLimitLoading || activeLimitReached))}
              className={primaryButtonClass}
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : isEditing ? 'Save Changes' : activeLimitReached ? 'Limit Reached' : 'Save Assessment'}</span>
            </button>
          </div>
        </div>

        {activeLimitReached && (
          <div className="max-w-7xl mx-auto mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 sm:p-4 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 flex items-start sm:items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0 mt-0.5 sm:mt-0" />
            <span className="min-w-0 flex-1 leading-snug">{getRateLimitReachedMessage(activeLimitResource)}</span>
          </div>
        )}
      </header>

      {/* Main 2-Column Bento Workspace */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">

          {/* Left Column: Progress & Draft Summary (4 cols) */}
          <aside className="xl:col-span-4 space-y-6 xl:sticky xl:top-6 min-w-0">
            
            {/* Workflow Card */}
            <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] flex items-center justify-center font-bold shadow-2xs">
                    <Layers size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#111215] dark:text-[#F8F9F5]">Workflow</h2>
                    <p className="text-[11px] text-[#73766C] dark:text-neutral-400">Setup checklist & readiness</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#F1F3EB] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[10px] font-mono font-bold text-[#8FB305] dark:text-[#D4F82C]">
                  {completionItems.filter(i => i.complete).length} / {completionItems.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {completionItems.map((item) => (
                  <div
                    key={item.label}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      item.complete
                        ? 'bg-[#F4F9EB] dark:bg-emerald-950/20 border-[#D2E7B3] dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300'
                        : 'bg-[#F8F9F5] dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`size-7 rounded-xl flex items-center justify-center text-xs font-mono font-black ${
                        item.complete
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white dark:bg-white/10 text-[#73766C] dark:text-neutral-400 border border-[#E4E7DC] dark:border-white/10'
                      }`}>
                        {item.complete ? <Check size={14} /> : item.step}
                      </span>
                      <div>
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className="text-[11px] text-[#73766C] dark:text-neutral-400">{item.desc}</div>
                      </div>
                    </div>
                    {item.optional && !item.complete && (
                      <span className="text-[10px] font-mono text-[#73766C] px-2 py-0.5 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                        Optional
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Draft Summary Card */}
            <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E7DC] dark:border-white/10">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                  Assessment Specs
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#111215] text-[#D4F82C] text-[10px] font-mono font-bold">
                  DRAFT
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-[#73766C] dark:text-neutral-400 font-medium">Evaluation Type</span>
                  <span className="font-bold text-[#111215] dark:text-white capitalize px-2.5 py-0.5 rounded-full bg-[#F1F3EB] dark:bg-white/10 text-xs">
                    {type}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-[#73766C] dark:text-neutral-400 font-medium">Status</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                    status === 'Active'
                      ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border border-red-200 bg-red-50 text-red-700'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-600 animate-pulse' : 'bg-red-500'}`} />
                    <span>{status}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-[#73766C] dark:text-neutral-400 font-medium">Duration</span>
                  <span className="font-mono font-bold text-[#111215] dark:text-white">
                    {duration} Minutes
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-[#73766C] dark:text-neutral-400 font-medium">Passing Threshold</span>
                  <span className="font-mono font-bold text-[#8FB305] dark:text-[#D4F82C]">
                    {passingScore}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-[#73766C] dark:text-neutral-400 font-medium">Questions Configured</span>
                  <span className="font-mono font-bold text-[#111215] dark:text-white">
                    {questions.length} Questions
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[11px] text-[#575A51] dark:text-neutral-300 leading-relaxed flex items-start gap-2.5">
                <Sparkles size={15} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0 mt-0.5" />
                <span>
                  Candidates who score ≥ {passingScore}% will automatically receive next steps or unlock the subsequent interview round.
                </span>
              </div>
            </div>

          </aside>

          {/* Right Column: Main Form (8 cols) */}
          <form id="create-assessment-form" onSubmit={handleSave} className="xl:col-span-8 space-y-6 min-w-0">

            {/* SECTION 1: Assessment Profile */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-[10px] font-mono font-black">
                    01
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[#111215] dark:text-[#F8F9F5]">Assessment Profile</h2>
                    <p className="text-xs text-[#73766C] dark:text-neutral-400">Name the assessment, select test format and set time limit</p>
                  </div>
                </div>
                <Target size={18} className="text-[#8FB305] dark:text-[#D4F82C]" />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                
                {/* Title */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>Assessment Title</span>
                    <span className="text-[10px] text-red-500 font-semibold">* Required</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                    className={inputClass}
                    placeholder="e.g. Frontend React & State Management Screen"
                    required
                  />
                </div>

                {/* Format Segment Control */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>Assessment Format</span>
                    <span className="text-[10px] text-[#73766C] font-normal">Choose question type</span>
                  </label>
                  <div className="grid grid-cols-2 p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114]">
                    <button
                      type="button"
                      onClick={() => handleTypeChange('aptitude')}
                      className={`py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        type === 'aptitude'
                          ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                          : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                      }`}
                    >
                      <FileText size={15} />
                      <span>Multiple Choice (MCQ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('coding')}
                      className={`py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        type === 'coding'
                          ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                          : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                      }`}
                    >
                      <Code size={15} />
                      <span>Technical Coding Challenge</span>
                    </button>
                  </div>
                </div>

                {/* Duration Stepper */}
                <div>
                  <label className={labelClass}>
                    <span className="flex items-center gap-1.5"><Clock size={13} className="text-[#8FB305]" /> Duration</span>
                    <span className="text-[10px] text-[#73766C] font-normal">Minutes</span>
                  </label>
                  <div className="flex h-11 items-center rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] overflow-hidden">
                    <button
                      type="button"
                      disabled={duration <= 5}
                      onClick={() => setDuration(Math.max(1, duration - 5))}
                      className="h-full w-12 flex items-center justify-center font-bold text-base text-[#111215] dark:text-white hover:bg-[#E4E7DC] dark:hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={duration}
                      onChange={event => setDuration(Math.max(1, Number(event.target.value)))}
                      className="h-full min-w-0 flex-1 border-none bg-transparent px-3 text-center font-mono font-bold text-sm text-[#111215] dark:text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setDuration(duration + 5)}
                      className="h-full w-12 flex items-center justify-center font-bold text-base text-[#111215] dark:text-white hover:bg-[#E4E7DC] dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[11px] text-[#73766C] dark:text-neutral-400 mt-1.5">Candidate countdown starts on test launch.</p>
                </div>

                {/* Passing Score */}
                <div>
                  <label className={labelClass}>
                    <span className="flex items-center gap-1.5"><Target size={13} className="text-[#8FB305]" /> Passing Score</span>
                    <span className="text-[10px] text-[#73766C] font-normal">Percentage</span>
                  </label>
                  <div className="relative flex h-11 items-center rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] overflow-hidden">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={passingScore}
                      onChange={event => setPassingScore(Number(event.target.value))}
                      className="h-full min-w-0 flex-1 border-none bg-transparent px-4 font-mono font-bold text-sm text-[#111215] dark:text-white outline-none"
                    />
                    <span className="px-3.5 py-1 mr-2 text-xs font-mono font-black rounded-lg bg-white dark:bg-white/10 border border-[#E4E7DC] dark:border-white/10 text-[#8FB305] dark:text-[#D4F82C]">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-[#73766C] dark:text-neutral-400 mt-1.5">Scores at or above this trigger automated progression.</p>
                </div>

                {/* Status Toggle (Active / Inactive) */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    <span>Assessment Status</span>
                    <span className="text-[10px] text-[#73766C] font-normal">Controls candidate availability</span>
                  </label>
                  <div className="grid grid-cols-2 p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114]">
                    <button
                      type="button"
                      onClick={() => setStatus('Active')}
                      className={`py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        status === 'Active'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 shadow-xs'
                          : 'text-[#73766C] hover:text-[#111215] dark:hover:text-white font-medium'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      <span>Active (Open for Candidates)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('Inactive')}
                      className={`py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        status === 'Inactive'
                          ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 shadow-xs'
                          : 'text-[#73766C] hover:text-[#111215] dark:hover:text-white font-medium'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      <span>Inactive (Deactivated)</span>
                    </button>
                  </div>
                </div>

              </div>
            </section>

            {/* SECTION 2: Next-round Routing Automation */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-[10px] font-mono font-black">
                    02
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[#111215] dark:text-[#F8F9F5]">Next-Round Automation</h2>
                    <p className="text-xs text-[#73766C] dark:text-neutral-400">Direct passing candidates straight into an interview</p>
                  </div>
                </div>
                <LinkIcon size={18} className="text-[#8FB305] dark:text-[#D4F82C]" />
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>
                    <span>Routing Destination</span>
                    <span className="text-[10px] text-[#73766C] font-normal">Optional</span>
                  </label>
                  <div className="grid grid-cols-2 p-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114]">
                    <button
                      type="button"
                      onClick={() => setAutomationType('internal')}
                      className={`py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        automationType === 'internal'
                          ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                          : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                      }`}
                    >
                      <span>Internal Interview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutomationType('external')}
                      className={`py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        automationType === 'external'
                          ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                          : 'text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                      }`}
                    >
                      <span>External Link / Tool</span>
                    </button>
                  </div>
                </div>

                {automationType === 'internal' ? (
                  <div>
                    <label className={labelClass}>
                      <span>Target Interview</span>
                      <span className="text-[10px] text-[#73766C] font-normal">Mapped after test completion</span>
                    </label>
                    <select
                      value={nextInterviewId}
                      onChange={event => setNextInterviewId(event.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select an interview opening...</option>
                      {recruiterInterviews.map(interview => (
                        <option key={interview.id} value={interview.id}>{interview.title}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[#73766C] dark:text-neutral-400 mt-1.5">
                      Passing candidates immediately receive the selected interview invitation and access code.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>
                        <span>External Interview URL</span>
                      </label>
                      <input
                        type="url"
                        value={externalLink}
                        onChange={event => setExternalLink(event.target.value)}
                        className={inputClass}
                        placeholder="https://meet.google.com/... or Calendly"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        <span>Access Code</span>
                        <span className="text-[10px] text-[#73766C] font-normal">Optional</span>
                      </label>
                      <input
                        type="text"
                        value={externalAccessCode}
                        onChange={event => setExternalAccessCode(event.target.value)}
                        className={inputClass}
                        placeholder="e.g. SEC-901"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* SECTION 3: AI Question Generator */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-xl bg-[#D4F82C] text-[#111215] flex items-center justify-center font-black shadow-2xs shrink-0">
                    <Wand2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-[#111215] dark:text-[#F8F9F5]">AI Question Generator</h2>
                      <span className="px-2 py-0.5 rounded-full bg-[#D4F82C]/20 border border-[#D4F82C]/40 text-[10px] font-mono font-bold text-[#111215] dark:text-[#D4F82C]">
                        Smart Engine
                      </span>
                    </div>
                    <p className="text-xs text-[#73766C] dark:text-neutral-400">
                      Tailored generation with difficulty, question types, seniority & strict custom notes
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedAi(!showAdvancedAi)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F1F3EB] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs font-bold text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white transition-all cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Sliders size={13} />
                  <span>{showAdvancedAi ? 'Hide Settings' : 'Customize AI'}</span>
                  {showAdvancedAi ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Primary Search / Topic Input Bar */}
              <div className="space-y-3">
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5">
                    <Bot size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                    <span>Role, Tech Stack, or Topic Prompt</span>
                  </span>
                  <span className="text-[11px] text-[#73766C] font-normal">Core skill to assess</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Bot size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#73766C]" />
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={event => setAiPrompt(event.target.value)}
                      placeholder={
                        type === 'aptitude'
                          ? 'e.g. React 19 Hooks & Server Components, TypeScript Generics, or SQL Optimization'
                          : 'e.g. Two Pointers, Dynamic Programming, Tree Traversal, or LRU Cache'
                      }
                      className={`${inputClass} pl-11`}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAiGenerate();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={generating || saving}
                    className={primaryButtonClass}
                  >
                    {generating ? (
                      <>
                        <div className="size-4 rounded-full border-2 border-white dark:border-[#111215] border-t-transparent animate-spin" />
                        <span>Generating {aiCount}...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        <span>Generate {aiCount} {type === 'aptitude' ? 'MCQ(s)' : 'Problem(s)'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick Topic Suggestions */}
                <div className="flex items-center flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-[#73766C] mr-1">Suggestions:</span>
                  {(type === 'aptitude' ? [
                    'React 19 & Next.js App Router',
                    'JavaScript ES6+ & Event Loop',
                    'TypeScript Types & Generics',
                    'Python & FastAPI / Django',
                    'SQL Indexing & Query Tuning',
                    'System Architecture & REST',
                  ] : [
                    'Two Pointers & Sliding Window',
                    'Binary Search & Tree Traversals',
                    'Dynamic Programming & Memoization',
                    'LRU Cache & Low-Level Design',
                    'String Parsing & Regex Matrix',
                    'Graph BFS / DFS & Shortest Path',
                  ]).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setAiPrompt(suggestion)}
                      className="px-2.5 py-1 rounded-full bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[11px] font-medium text-[#575A51] dark:text-neutral-300 hover:border-[#111215] dark:hover:border-white/40 hover:text-[#111215] dark:hover:text-white transition-all cursor-pointer"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Generator Controls Section */}
              {/* Granular Generator Controls Section */}
              {showAdvancedAi && (
                <div className="p-5 sm:p-6 rounded-2xl bg-[#F8F9F5] dark:bg-[#101114] border border-[#E4E7DC] dark:border-white/10 space-y-6 animate-in fade-in duration-200">
                  {/* Section Title */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-[#E4E7DC] dark:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="size-6 rounded-lg bg-white dark:bg-white/10 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#8FB305] dark:text-[#D4F82C] shrink-0">
                        <Sliders size={13} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5] tracking-tight">
                          Generation Parameters
                        </h3>
                        <p className="text-[11px] text-[#73766C] dark:text-neutral-400">
                          Tailor question challenge depth, evaluation style, and target level
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[10px] font-mono font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                      Tuning
                    </span>
                  </div>

                  {/* 1. Difficulty Level (Segmented Button Group) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5]">
                        Difficulty Level
                      </label>
                      <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-medium">
                        {aiDifficulty === 'mixed' && 'Balanced (~30% Easy, ~50% Med, ~20% Hard)'}
                        {aiDifficulty === 'easy' && 'Foundations & direct syntax'}
                        {aiDifficulty === 'medium' && 'Practical problem-solving'}
                        {aiDifficulty === 'hard' && 'Advanced nuances & corner cases'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'mixed', label: 'Balanced Mix', desc: 'Mixed Depths' },
                        { id: 'easy', label: 'Easy', desc: 'Foundations' },
                        { id: 'medium', label: 'Medium', desc: 'Intermediate' },
                        { id: 'hard', label: 'Hard', desc: 'Advanced' },
                      ].map(d => {
                        const isSelected = aiDifficulty === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setAiDifficulty(d.id as any)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#111215] text-[#D4F82C] border-[#111215] dark:bg-[#D4F82C] dark:text-[#111215] dark:border-[#D4F82C] shadow-xs'
                                : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-[#111215]/30 dark:hover:border-white/30 hover:text-[#111215] dark:hover:text-white'
                            }`}
                          >
                            <span className="text-xs font-bold truncate">{d.label}</span>
                            <span className={`text-[10px] truncate ${isSelected ? 'opacity-80' : 'text-[#73766C] dark:text-neutral-400'}`}>
                              {d.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Question Style / Category (Interactive Pill Grid) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5]">
                        Question Style
                      </label>
                      <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-medium">
                        Targeted assessment format
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-1.5">
                      {(type === 'aptitude' ? [
                        { id: 'mixed', label: 'All Formats (Balanced)' },
                        { id: 'theoretical', label: 'Theory & Architecture' },
                        { id: 'practical', label: 'Code Output & Debugging' },
                        { id: 'scenario', label: 'Production Scenarios' },
                        { id: 'aptitude', label: 'Logical & Quantitative' },
                      ] : [
                        { id: 'mixed', label: 'All Formats (Balanced)' },
                        { id: 'dsa', label: 'DSA & Algorithms' },
                        { id: 'practical', label: 'Business & App Logic' },
                        { id: 'bugfix', label: 'Bug-Fixing & Edge Cases' },
                        { id: 'system_design', label: 'Low-Level Design (OOP)' },
                      ]).map(styleItem => {
                        const isSelected = aiQuestionType === styleItem.id;
                        return (
                          <button
                            key={styleItem.id}
                            type="button"
                            onClick={() => setAiQuestionType(styleItem.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-[#111215] text-[#D4F82C] border-[#111215] dark:bg-[#D4F82C] dark:text-[#111215] dark:border-[#D4F82C] font-bold shadow-2xs'
                                : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-[#111215]/30 dark:hover:border-white/30 hover:text-[#111215] dark:hover:text-white'
                            }`}
                          >
                            {styleItem.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Seniority & Batch Quantity (Responsive 2-column layout) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Target Seniority */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5]">
                        Candidate Seniority
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'entry', label: 'Junior', exp: '0–2 yrs' },
                          { id: 'mid', label: 'Mid-Level', exp: '2–5 yrs' },
                          { id: 'senior', label: 'Senior', exp: '5–8 yrs' },
                          { id: 'lead', label: 'Staff / Lead', exp: '8+ yrs' },
                        ].map(lvl => {
                          const isSelected = aiSeniority === lvl.id;
                          return (
                            <button
                              key={lvl.id}
                              type="button"
                              onClick={() => setAiSeniority(lvl.id as any)}
                              className={`px-3 py-2 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-[#111215] text-[#D4F82C] border-[#111215] dark:bg-[#D4F82C] dark:text-[#111215] dark:border-[#D4F82C] font-bold shadow-2xs'
                                  : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-[#111215]/30 dark:hover:border-white/30'
                              }`}
                            >
                              <span className="text-xs">{lvl.label}</span>
                              <span className={`text-[10px] font-mono ${isSelected ? 'opacity-80' : 'text-[#73766C] dark:text-neutral-400'}`}>
                                {lvl.exp}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Batch Quantity */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5]">
                          Batch Quantity
                        </label>
                        <span className="text-[10px] font-mono font-bold text-[#8FB305] dark:text-[#D4F82C]">
                          {aiCount} {type === 'aptitude' ? 'Questions' : 'Problems'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(type === 'aptitude' ? [3, 5, 10, 15] : [1, 2, 3, 5]).map(cnt => {
                          const isSelected = aiCount === cnt;
                          return (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => setAiCount(cnt)}
                              className={`h-[42px] rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border flex items-center justify-center ${
                                isSelected
                                  ? 'bg-[#111215] text-[#D4F82C] border-[#111215] dark:bg-[#D4F82C] dark:text-[#111215] dark:border-[#D4F82C] shadow-2xs'
                                  : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-[#111215]/30 dark:hover:border-white/30'
                              }`}
                            >
                              {cnt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 4. Target Language (Coding mode only) */}
                  {type === 'coding' && (
                    <div className="space-y-2 pt-1 border-t border-[#E4E7DC] dark:border-white/10">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5]">
                          Target Language Focus
                        </label>
                        <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-medium">
                          Problems & test cases will be tailored to this language
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        {['Any', 'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Go', 'SQL'].map(lang => {
                          const isSelected = aiCodingLang === lang;
                          return (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => setAiCodingLang(lang)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-[#111215] text-[#D4F82C] border-[#111215] dark:bg-[#D4F82C] dark:text-[#111215] dark:border-[#D4F82C] font-bold shadow-2xs'
                                  : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300 hover:border-[#111215]/30 dark:hover:border-white/30'
                              }`}
                            >
                              {lang === 'Any' ? 'Any Language' : lang}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 5. Special Focus Notes & Strict Rules (Clean Theme, Zero Emojis) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 space-y-3">
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={handlePdfUpload}
                      className="hidden"
                    />

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5] flex items-center gap-2">
                        <Sliders size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                        <span>Special Focus Notes & Mandatory Constraints</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {!pdfFile && (
                          <button
                            type="button"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={parsingPdf}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#111215] dark:text-[#F8F9F5] bg-[#F1F3EB] dark:bg-white/5 hover:bg-[#E4E7DC] dark:hover:bg-white/10 border border-[#E4E7DC] dark:border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Paperclip size={12} className="text-[#8FB305] dark:text-[#D4F82C]" />
                            <span>{parsingPdf ? 'Extracting text...' : 'Attach PDF / Syllabus'}</span>
                          </button>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-[#F1F3EB] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[9px] font-mono font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                          Strict Directive
                        </span>
                      </div>
                    </div>

                    {pdfFile && (
                      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#8FB305]/10 dark:bg-[#D4F82C]/10 border border-[#8FB305]/30 dark:border-[#D4F82C]/30 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#8FB305]/20 dark:bg-[#D4F82C]/20 flex items-center justify-center shrink-0">
                            <FileText size={15} className="text-[#657E00] dark:text-[#D4F82C]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-[#111215] dark:text-[#F8F9F5] truncate max-w-[220px] sm:max-w-xs">
                                {pdfName}
                              </p>
                              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-black/40 text-[9px] font-mono font-bold text-[#657E00] dark:text-[#D4F82C] border border-[#8FB305]/20 dark:border-[#D4F82C]/20 shrink-0">
                                ~{Math.round(pdfText.length / 5)} words
                              </span>
                            </div>
                            <p className="text-[10px] text-[#73766C] dark:text-neutral-400 truncate">
                              AI will strictly formulate questions from this syllabus / reference material
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={parsingPdf}
                            className="text-[11px] font-semibold text-[#657E00] dark:text-[#D4F82C] hover:underline px-1.5 py-1 cursor-pointer disabled:opacity-50"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={handleRemovePdf}
                            className="p-1 rounded-lg text-[#73766C] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Remove document"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    )}

                    <textarea
                      rows={2}
                      value={aiCustomNotes}
                      onChange={e => setAiCustomNotes(e.target.value)}
                      placeholder={
                        pdfFile
                          ? 'Optional additional instructions (e.g. Focus specifically on Section 3 of the attached syllabus. Include at least 2 tricky edge case questions)...'
                          : type === 'aptitude'
                          ? 'e.g. Focus exclusively on React 19 Server Components and actions. Do not ask about legacy classes. Include at least 2 questions testing tricky re-rendering behavior.'
                          : 'e.g. Problems must require O(N) time and O(1) auxiliary space. Test cases must strictly cover negative numbers and array bounds.'
                      }
                      className={textareaClass}
                    />

                    <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-[#73766C] dark:text-neutral-400">
                      <div className="flex items-start sm:items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#F1F3EB] dark:bg-white/10 font-mono font-bold text-[9px] uppercase tracking-wider text-[#111215] dark:text-[#D4F82C] shrink-0">
                          Notice
                        </span>
                        <span>
                          Specify exact sub-topics or rules. If a PDF/doc is attached, questions are drawn directly from it.
                        </span>
                      </div>
                      {!pdfFile && (
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          disabled={parsingPdf}
                          className="inline-flex items-center gap-1 font-semibold text-[#8FB305] dark:text-[#D4F82C] hover:underline cursor-pointer disabled:opacity-50"
                        >
                          <FileUp size={12} />
                          <span>{parsingPdf ? 'Extracting...' : 'Upload PDF/DOCX (Max 20MB)'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SECTION 4: Add Manual Question */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-[10px] font-mono font-black">
                    03
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[#111215] dark:text-[#F8F9F5]">
                      {type === 'aptitude' ? 'Add Custom Question' : 'Add Custom Coding Problem'}
                    </h2>
                    <p className="text-xs text-[#73766C] dark:text-neutral-400">
                      {type === 'aptitude' ? 'Compose question with 4 multiple choice options' : 'Write challenge description and test cases'}
                    </p>
                  </div>
                </div>
                <Plus size={18} className="text-[#8FB305] dark:text-[#D4F82C]" />
              </div>

              {type === 'aptitude' ? (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>
                      <span>Question Text</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Which React hook is used to perform side effects in functional components?"
                      value={manualQ.question}
                      onChange={event => setManualQ({ ...manualQ, question: event.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-[#111215] dark:text-white mb-1.5 block">
                        Difficulty
                      </label>
                      <select
                        value={manualQ.difficulty}
                        onChange={e => setManualQ({ ...manualQ, difficulty: e.target.value })}
                        className={selectClass}
                      >
                        <option value="easy">Easy (Foundations)</option>
                        <option value="medium">Medium (Intermediate)</option>
                        <option value="hard">Hard (Advanced)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#111215] dark:text-white mb-1.5 block">
                        Question Style
                      </label>
                      <select
                        value={manualQ.questionType}
                        onChange={e => setManualQ({ ...manualQ, questionType: e.target.value })}
                        className={selectClass}
                      >
                        <option value="theoretical">Theoretical Concepts</option>
                        <option value="practical">Code Output / Tracing</option>
                        <option value="scenario">Architecture Scenarios</option>
                        <option value="aptitude">Analytical / Quantitative</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {manualQ.options.map((option, index) => (
                      <div key={index}>
                        <label className={labelClass}>
                          <span>Option {index + 1} {manualQ.correct === index && <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">(Correct Answer)</span>}</span>
                          <button
                            type="button"
                            onClick={() => setManualQ({ ...manualQ, correct: index })}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                              manualQ.correct === index
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-neutral-400 hover:bg-gray-200'
                            }`}
                          >
                            Mark Correct
                          </button>
                        </label>
                        <input
                          type="text"
                          placeholder={index === 0 ? 'useEffect' : `Option ${index + 1}`}
                          value={option}
                          onChange={event => {
                            const nextOptions = [...manualQ.options];
                            nextOptions[index] = event.target.value;
                            setManualQ({ ...manualQ, options: nextOptions });
                          }}
                          className={inputClass}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className={labelClass}>
                      <span>Answer Explanation</span>
                      <span className="text-[10px] text-[#73766C] font-normal">Optional</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. useEffect runs asynchronously after render and commit phases."
                      value={manualQ.explanation}
                      onChange={event => setManualQ({ ...manualQ, explanation: event.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-[#73766C] dark:text-neutral-400">
                      Currently marked correct: <strong className="text-[#111215] dark:text-white">Option {manualQ.correct + 1}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={addManualQuestion}
                      className={secondaryButtonClass}
                    >
                      <Plus size={15} />
                      <span>Add to Assessment Bank</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>
                      <span>Problem Title</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Merge Overlapping Intervals"
                      value={manualCodeQ.title}
                      onChange={event => setManualCodeQ({ ...manualCodeQ, title: event.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-[#111215] dark:text-white mb-1.5 block">
                        Problem Difficulty
                      </label>
                      <select
                        value={manualCodeQ.difficulty}
                        onChange={e => setManualCodeQ({ ...manualCodeQ, difficulty: e.target.value })}
                        className={selectClass}
                      >
                        <option value="easy">Easy (Basic Algorithms)</option>
                        <option value="medium">Medium (Intermediate)</option>
                        <option value="hard">Hard (Advanced)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#111215] dark:text-white mb-1.5 block">
                        Problem Style / Category
                      </label>
                      <select
                        value={manualCodeQ.questionType}
                        onChange={e => setManualCodeQ({ ...manualCodeQ, questionType: e.target.value })}
                        className={selectClass}
                      >
                        <option value="dsa">Core DSA & Algorithms</option>
                        <option value="practical">Business Logic & Data Processing</option>
                        <option value="bugfix">Bug-Fixing & Edge Cases</option>
                        <option value="system_design">Low-Level System Design (OOP)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      <span>Problem Description & Constraints</span>
                    </label>
                    <textarea
                      placeholder="Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals..."
                      value={manualCodeQ.description}
                      onChange={event => setManualCodeQ({ ...manualCodeQ, description: event.target.value })}
                      className={textareaClass}
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      <span>Sample Test Cases & Expected Output</span>
                    </label>
                    <textarea
                      placeholder={"Input: [[1,3],[2,6],[8,10]]\nOutput: [[1,6],[8,10]]"}
                      value={manualCodeQ.testCases}
                      onChange={event => setManualCodeQ({ ...manualCodeQ, testCases: event.target.value })}
                      className={textareaClass}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      <span>Algorithmic Hints / Edge Cases</span>
                      <span className="text-[10px] text-[#73766C] font-normal">Optional</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sort intervals by start time first before merging."
                      value={manualCodeQ.hints}
                      onChange={event => setManualCodeQ({ ...manualCodeQ, hints: event.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={addManualQuestion}
                      className={secondaryButtonClass}
                    >
                      <Plus size={15} />
                      <span>Add Coding Problem</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* SECTION 5: Review Question Bank */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7DC] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-[10px] font-mono font-black">
                    04
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[#111215] dark:text-[#F8F9F5]">
                      Question Bank ({questions.length})
                    </h2>
                    <p className="text-xs text-[#73766C] dark:text-neutral-400">Review all configured questions before publishing</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#F1F3EB] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs font-mono font-bold text-[#111215] dark:text-white">
                  {questions.length} Items
                </span>
              </div>

              {questions.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/[0.02] p-8 text-center">
                  <div className="size-12 rounded-2xl bg-white dark:bg-white/10 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#73766C] dark:text-neutral-400 mb-3 shadow-2xs">
                    {type === 'coding' ? <Code size={22} /> : <FileText size={22} />}
                  </div>
                  <h3 className="text-sm font-bold text-[#111215] dark:text-white">No questions added yet</h3>
                  <p className="text-xs text-[#73766C] dark:text-neutral-400 max-w-sm mt-1">
                    Use the AI generator above or write questions manually. You need at least 1 question to publish.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <article
                      key={index}
                      className="p-5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] space-y-3.5 transition-all hover:border-[#111215]/30 dark:hover:border-white/20"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className="size-6 rounded-lg bg-white dark:bg-white/10 border border-[#E4E7DC] dark:border-white/10 text-xs font-mono font-black flex items-center justify-center text-[#73766C] dark:text-neutral-400 shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            {/* Badges for Difficulty & Question Style */}
                            <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                              {question.difficulty && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border ${
                                  question.difficulty === 'easy'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : question.difficulty === 'hard'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                }`}>
                                  {question.difficulty}
                                </span>
                              )}
                              {question.questionType && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-white dark:bg-white/5 text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC] dark:border-white/10">
                                  {question.questionType.replace('_', ' ')}
                                </span>
                              )}
                            </div>

                            <h3 className="text-sm font-bold text-[#111215] dark:text-white leading-snug">
                              {type === 'aptitude' ? question.question : question.title}
                            </h3>
                            {type === 'coding' && (
                              <p className="text-xs text-[#575A51] dark:text-neutral-400 mt-1.5 leading-relaxed whitespace-pre-wrap">
                                {question.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setQuestions((current) => current.filter((_, qIdx) => qIdx !== index))}
                          className="size-8 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-all cursor-pointer shrink-0"
                          title="Remove question"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {type === 'aptitude' && question.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-9">
                          {question.options.map((option: string, optIndex: number) => {
                            const isCorrect = optIndex === question.correctIndex;
                            return (
                              <div
                                key={optIndex}
                                className={`px-3 py-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                                  isCorrect
                                    ? 'bg-[#EAF7E8] dark:bg-emerald-950/30 border-[#BCE4B8] dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 font-bold'
                                    : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-300'
                                }`}
                              >
                                <span className={`size-4 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5 ${
                                  isCorrect ? 'bg-emerald-600 text-white font-bold' : 'bg-gray-100 dark:bg-white/10 text-gray-500'
                                }`}>
                                  {isCorrect ? '✓' : String.fromCharCode(65 + optIndex)}
                                </span>
                                <span className="leading-relaxed break-words flex-1">{option}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explanation Callout for Aptitude */}
                      {type === 'aptitude' && question.explanation && (
                        <div className="ml-9 p-3 rounded-xl bg-[#F4F9EB] dark:bg-emerald-950/20 border border-[#D2E7B3] dark:border-emerald-800/30 text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-2">
                          <Lightbulb size={14} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                          <div className="leading-relaxed">
                            <span className="font-bold">Explanation: </span>
                            {question.explanation}
                          </div>
                        </div>
                      )}

                      {type === 'coding' && question.testCases && (
                        <div className="pl-9 pt-1 space-y-2">
                          <div className="p-3 rounded-xl bg-white dark:bg-black/40 border border-[#E4E7DC] dark:border-white/10 text-xs font-mono text-[#575A51] dark:text-neutral-400 whitespace-pre-wrap">
                            {question.testCases}
                          </div>
                        </div>
                      )}

                      {/* Hints Callout for Coding */}
                      {type === 'coding' && question.hints && (
                        <div className="ml-9 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
                          <Lightbulb size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <div className="leading-relaxed">
                            <span className="font-bold">Hints / Edge Cases: </span>
                            {question.hints}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Bottom Form Actions */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 shadow-xs">
              <button
                type="button"
                onClick={() => navigate('/recruiter/tests')}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || generating || questions.length === 0 || (!isEditing && (rateLimitLoading || activeLimitReached))}
                className={primaryButtonClass}
              >
                <Save size={16} />
                <span>{saving ? 'Saving...' : isEditing ? 'Save Changes' : activeLimitReached ? 'Limit Reached' : 'Publish Assessment'}</span>
              </button>
            </div>

          </form>

        </div>
      </div>
    </div>
  );
};

export default CreateTest;
