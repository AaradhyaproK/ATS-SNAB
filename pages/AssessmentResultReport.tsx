import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Code,
  Copy,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  HelpCircle,
  Layers,
  Linkedin,
  Mail,
  MessageCircle,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  ThumbsUp,
  User,
  X,
  XCircle,
} from 'lucide-react';
import HireXLogo from '../components/HireXLogo';
import DayNightToggle from '../components/DayNightToggle';
import { useTheme } from '../context/ThemeContext';
import { useMessageBox } from '../components/MessageBox';

interface TestQuestion {
  question?: string;
  title?: string;
  text?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  description?: string;
  starterCode?: string;
  testCases?: any;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | string;
  [key: string]: any;
}

interface AssessmentSubmission {
  id: string;
  testId?: string;
  candidateName?: string;
  candidateEmail?: string;
  candidateUID?: string;
  score?: number | null;
  passingScore?: number;
  status?: string;
  feedback?: string;
  answers?: any[];
  tabSwitchCount?: number;
  copyPasteAttempts?: number;
  screenshotAttempts?: number;
  integrityAudit?: {
    tabSwitchCount?: number;
    copyPasteAttempts?: number;
    screenshotAttempts?: number;
    fullscreenEscapes?: number;
  };
  emailSent?: boolean;
  emailError?: string;
  recruiterUID?: string;
  type?: 'aptitude' | 'coding';
  submittedAt?: any;
  testTitle?: string;
  testQuestions?: TestQuestion[];
  questions?: TestQuestion[];
  isDeleted?: boolean;
  meta?: any;
  timeSpentSeconds?: number;
  duration?: number;
  [key: string]: any;
}

interface TestData {
  id: string;
  title?: string;
  type?: 'aptitude' | 'coding';
  duration?: number;
  passingScore?: number;
  questions?: TestQuestion[];
  description?: string;
  [key: string]: any;
}

// ── Luxury Circular Radial Score Gauge ──
const RadialScoreGauge: React.FC<{
  score: number;
  benchmark: number;
  isPassed: boolean;
  isTerminated: boolean;
}> = ({ score, benchmark, isPassed, isTerminated }) => {
  const pct = Math.min(100, Math.max(0, score));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color = isTerminated
    ? {
        text: 'text-rose-600 dark:text-rose-400',
        stroke: 'text-rose-500 dark:text-rose-400',
        glow: 'drop-shadow-[0_0_12px_rgba(244,63,94,0.35)]',
        bgPill: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      }
    : isPassed
    ? {
        text: 'text-emerald-600 dark:text-emerald-400',
        stroke: 'text-emerald-500 dark:text-emerald-400',
        glow: 'drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]',
        bgPill: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      }
    : {
        text: 'text-amber-600 dark:text-amber-400',
        stroke: 'text-amber-500 dark:text-amber-400',
        glow: 'drop-shadow-[0_0_12px_rgba(245,158,11,0.35)]',
        bgPill: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      };

  return (
    <div className="flex flex-col items-center text-center p-6 rounded-3xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 shadow-xs relative overflow-hidden transition-all">
      {/* Background radial gradient accent */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center my-1">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
          <circle
            className="text-[#E4E7DC]/80 dark:text-white/[0.08]"
            strokeWidth="9"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="64"
            cy="64"
          />
          <circle
            className={`${color.stroke} ${color.glow} transition-all duration-1000 ease-out`}
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="64"
            cy="64"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${color.text}`}>
            {score}%
          </span>
          <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-bold uppercase tracking-wider font-mono mt-0.5">
            BENCHMARK {benchmark}%
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2 w-full">
        <div className="flex items-center justify-center">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${color.bgPill}`}>
            {isTerminated ? (
              <>
                <AlertTriangle size={12} />
                <span>Terminated</span>
              </>
            ) : isPassed ? (
              <>
                <CheckCircle2 size={12} />
                <span>Benchmark Achieved</span>
              </>
            ) : (
              <>
                <AlertTriangle size={12} />
                <span>Needs Improvement</span>
              </>
            )}
          </span>
        </div>
        <p className="text-xs text-[#575A51] dark:text-neutral-400 font-medium leading-relaxed">
          {score >= benchmark
            ? `Candidate scored +${score - benchmark}% above the passing requirement.`
            : `Candidate scored ${benchmark - score}% below the passing requirement.`}
        </p>
      </div>
    </div>
  );
};

export const AssessmentResultReport: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { showSuccess, showError } = useMessageBox();

  const [submission, setSubmission] = useState<AssessmentSubmission | null>(null);
  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fallback to query parameter if route param is missing
  const activeSubmissionId =
    submissionId || new URLSearchParams(window.location.search).get('id') || '';

  useEffect(() => {
    let isMounted = true;

    const fetchAssessmentReport = async () => {
      if (!activeSubmissionId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg('');

      try {
        const subRef = doc(db, 'testSubmissions', activeSubmissionId);
        const subSnap = await getDoc(subRef);

        if (!subSnap.exists()) {
          if (isMounted) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        const subData = { id: subSnap.id, ...subSnap.data() } as AssessmentSubmission;

        if (subData.isDeleted || subData.status === 'deleted') {
          if (isMounted) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        let testData: TestData | null = null;
        if (subData.testId) {
          try {
            const testRef = doc(db, 'tests', subData.testId);
            const testSnap = await getDoc(testRef);
            if (testSnap.exists()) {
              testData = { id: testSnap.id, ...testSnap.data() } as TestData;
            }
          } catch (tErr) {
            console.warn('Could not fetch parent test document:', tErr);
          }
        }

        if (isMounted) {
          setSubmission(subData);
          setTest(testData);
          setNotFound(false);

          // Dynamic page title
          const titleName =
            subData.candidateName || subData.candidateEmail?.split('@')[0] || 'Candidate';
          const testName =
            subData.testTitle || testData?.title || 'Assessment Scorecard';
          document.title = `${titleName} - ${testName} Result | InterviewXpert`;
        }
      } catch (err: any) {
        console.error('Error fetching assessment report:', err);
        if (isMounted) {
          setErrorMsg(err?.message || 'Failed to load assessment report.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAssessmentReport();

    return () => {
      isMounted = false;
    };
  }, [activeSubmissionId]);

  // Derived Values
  const testTitle =
    submission?.testTitle || test?.title || 'Skill Assessment';
  const testType: 'aptitude' | 'coding' =
    submission?.type || test?.type || 'aptitude';
  const passingScore = Number(
    submission?.passingScore ?? test?.passingScore ?? 70
  );
  const score = Number(submission?.score ?? 0);
  const isTerminated = submission?.status === 'terminated';
  const isPassed = !isTerminated && (submission?.status === 'passed' || score >= passingScore);

  const candidateDisplayName =
    submission?.candidateName?.trim() ||
    submission?.candidateEmail?.split('@')[0] ||
    'Candidate';
  const candidateEmail = submission?.candidateEmail || '';

  const tabSwitches = Number(
    submission?.tabSwitchCount ??
      submission?.meta?.tabSwitchCount ??
      submission?.integrityAudit?.tabSwitchCount ??
      0
  );
  const copyPasteAttempts = Number(
    submission?.copyPasteAttempts ??
      submission?.integrityAudit?.copyPasteAttempts ??
      0
  );
  const screenshotAttempts = Number(
    submission?.screenshotAttempts ??
      submission?.integrityAudit?.screenshotAttempts ??
      0
  );
  const hasIntegrityFlags =
    isTerminated || tabSwitches > 0 || copyPasteAttempts > 0 || screenshotAttempts > 0;

  // Unified Questions list
  const questions: TestQuestion[] = useMemo(() => {
    if (test?.questions && Array.isArray(test.questions) && test.questions.length > 0) {
      return test.questions;
    }
    if (submission?.testQuestions && Array.isArray(submission.testQuestions) && submission.testQuestions.length > 0) {
      return submission.testQuestions;
    }
    if (submission?.questions && Array.isArray(submission.questions) && submission.questions.length > 0) {
      return submission.questions;
    }
    return [];
  }, [test?.questions, submission?.testQuestions, submission?.questions]);

  // Question Answer Analytics (Aptitude)
  const questionAnalytics = useMemo(() => {
    if (testType !== 'aptitude' || !questions.length) {
      return { total: 0, correct: 0, incorrect: 0, skipped: 0 };
    }
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    questions.forEach((q, idx) => {
      const userAns = submission?.answers?.[idx];
      if (userAns === undefined || userAns === null) {
        skipped++;
      } else if (q.correctIndex !== undefined && Number(userAns) === Number(q.correctIndex)) {
        correct++;
      } else {
        incorrect++;
      }
    });

    return { total: questions.length, correct, incorrect, skipped };
  }, [testType, questions, submission?.answers]);

  // Filtered Questions for Aptitude
  const filteredQuestions = useMemo(() => {
    if (testType !== 'aptitude') return questions;

    return questions.filter((q, idx) => {
      const userAns = submission?.answers?.[idx];
      const isCorrect =
        q.correctIndex !== undefined &&
        userAns !== undefined &&
        Number(userAns) === Number(q.correctIndex);

      if (filterMode === 'correct' && !isCorrect) return false;
      if (filterMode === 'incorrect' && isCorrect) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const prompt = (q.question || q.title || q.text || '').toLowerCase();
        const opts = (q.options || []).join(' ').toLowerCase();
        const exp = (q.explanation || '').toLowerCase();
        return prompt.includes(query) || opts.includes(query) || exp.includes(query);
      }

      return true;
    });
  }, [questions, testType, filterMode, searchQuery, submission?.answers]);

  // Date Formatter
  const formattedDate = useMemo(() => {
    if (!submission?.submittedAt) return 'Recently';
    const subAt = submission.submittedAt;
    let dateObj: Date;

    if (typeof subAt.toDate === 'function') {
      dateObj = subAt.toDate();
    } else if (typeof subAt.toMillis === 'function') {
      dateObj = new Date(subAt.toMillis());
    } else if (typeof subAt === 'string') {
      dateObj = new Date(subAt);
    } else if (typeof subAt.seconds === 'number') {
      dateObj = new Date(subAt.seconds * 1000);
    } else {
      dateObj = new Date();
    }

    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [submission?.submittedAt]);

  // Share Actions
  const shareUrl = window.location.href;

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      showSuccess('Shareable assessment report link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showError('Unable to copy link to clipboard.');
    }
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${candidateDisplayName} - ${testTitle} Assessment Scorecard`,
          text: `Verified ${testType === 'coding' ? 'Coding' : 'Aptitude'} Assessment Result for ${candidateDisplayName} on InterviewXpert ATS. Score: ${score}% (${isPassed ? 'Passed' : 'Needs Improvement'}).`,
          url: shareUrl,
        });
      } catch (err) {
        handleCopyShareLink();
      }
    } else {
      handleCopyShareLink();
    }
  };

  const handleShareLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedInUrl, '_blank', 'noopener,noreferrer,width=600,height=600');
  };

  const handleShareWhatsApp = () => {
    const text = `Verified ${testType === 'coding' ? 'Coding' : 'Aptitude'} Assessment Result for ${candidateDisplayName} on InterviewXpert ATS.\nTest: ${testTitle}\nScore: ${score}% (Benchmark: ${passingScore}%)\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = async (codeStr: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(codeStr);
      setCopiedCodeIdx(idx);
      setTimeout(() => setCopiedCodeIdx(null), 2000);
    } catch {
      showError('Unable to copy code snippet.');
    }
  };

  const scrollToQuestion = (qNum: number) => {
    const el = document.getElementById(`question-card-${qNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#111215]', 'dark:ring-[#D4F82C]');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#111215]', 'dark:ring-[#D4F82C]');
      }, 1800);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] flex flex-col font-sans selection:bg-[#D4F82C] selection:text-[#111215]">
        <header className="border-b border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-[#15161A]/80 backdrop-blur-md px-4 sm:px-8 py-4">
          <div className="max-w-[1720px] mx-auto flex items-center justify-between">
            <HireXLogo size="md" variant="full" withLink to="/" isDark={isDark} />
            <div className="h-8 w-28 rounded-full bg-black/5 dark:bg-white/5 animate-pulse" />
          </div>
        </header>

        <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="h-64 rounded-3xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 p-8 animate-pulse space-y-4">
            <div className="h-6 w-40 bg-black/5 dark:bg-white/5 rounded-full" />
            <div className="h-10 w-3/4 bg-black/5 dark:bg-white/5 rounded-2xl" />
            <div className="h-4 w-1/2 bg-black/5 dark:bg-white/5 rounded-full" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 animate-pulse"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Not Found State
  if (notFound || !submission) {
    return (
      <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] flex flex-col font-sans">
        <header className="border-b border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-[#15161A]/80 backdrop-blur-md px-4 sm:px-8 py-4">
          <div className="max-w-[1720px] mx-auto flex items-center justify-between">
            <HireXLogo size="md" variant="full" withLink to="/" isDark={isDark} />
            <DayNightToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center p-8 sm:p-10 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xl space-y-5">
            <div className="size-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <FileCheck size={32} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111215] dark:text-white">
              Assessment Scorecard Not Found
            </h1>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 leading-relaxed">
              The requested evaluation submission ID may have expired, been retaken, or deleted by the recruiter.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Link
                to="/candidate"
                className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold bg-[#111215] dark:bg-[#D4F82C] text-white dark:text-[#111215] hover:opacity-90 transition-opacity cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5"
              >
                <span>Candidate Desk</span>
                <ArrowRight size={13} />
              </Link>
              <Link
                to="/"
                className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#111215] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors inline-flex items-center justify-center"
              >
                Home Page
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] flex flex-col font-sans selection:bg-[#D4F82C] selection:text-[#111215] antialiased">
      {/* ── High-Quality Print Stylesheet ── */}
      <style>{`
        @media print {
          @page {
            margin: 12mm 15mm;
            size: A4 portrait;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 10pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          section, .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .shadow-xs, .shadow-sm, .shadow-md, .shadow-xl, .shadow-2xl {
            box-shadow: none !important;
          }
          .bg-\\[\\#F8F9F5\\], .bg-white, .dark\\:bg-\\[\\#0D0E11\\], .dark\\:bg-\\[\\#15161A\\] {
            background-color: #ffffff !important;
          }
        }
      `}</style>

      {/* ── Top Navigation / Full Width Glass Bar (Hidden in Print) ── */}
      <header className="print:hidden sticky top-0 z-40 border-b border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5]/90 dark:bg-[#0D0E11]/90 backdrop-blur-xl px-4 sm:px-6 lg:px-8 xl:px-10 py-3 transition-colors">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1.5 sm:p-2 rounded-xl text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-[#E4E7DC] dark:hover:border-white/10 transition-all cursor-pointer shadow-2xs shrink-0"
              title="Go back"
            >
              <ArrowLeft size={16} />
            </button>

            <HireXLogo size="md" variant="full" withLink to="/" isDark={isDark} />

            <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[10px] font-mono font-bold uppercase text-[#575A51] dark:text-neutral-300">
              <ShieldCheck size={12} className="text-[#8FB305] dark:text-[#D4F82C]" />
              <span>Verified Assessment Scorecard</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Shareable Link */}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                copiedLink
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white hover:bg-[#F1F3EB] dark:hover:bg-white/10'
              }`}
              title="Copy public link"
            >
              {copiedLink ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
              <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
            </button>

            {/* Share Native */}
            <button
              type="button"
              onClick={handleShareNative}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              title="Share report"
            >
              <Share2 size={13} />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Print / Save PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center size-8 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white transition-colors cursor-pointer"
              title="Print or Save as PDF"
            >
              <Printer size={14} />
            </button>

            <DayNightToggle />
          </div>
        </div>
      </header>

      {/* ── Main Full-Width Report Content ── */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        
        {/* ── Full-Page Hero Banner ── */}
        <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 lg:p-10 shadow-xs relative overflow-hidden transition-all">
          {/* Subtle Decorative Ambient Glow */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#D4F82C]/15 via-[#8FB305]/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />

          <div className="relative space-y-6">
            {/* Top Badge Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Type Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full ${
                    testType === 'coding'
                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]'
                  }`}
                >
                  {testType === 'coding' ? <Code size={13} /> : <FileCheck size={13} />}
                  <span>{testType === 'coding' ? 'Coding Challenge' : 'Aptitude Assessment'}</span>
                </span>

                {/* Benchmark Outcome */}
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full border ${
                    isTerminated
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                      : isPassed
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  }`}
                >
                  {isTerminated ? (
                    <>
                      <AlertTriangle size={12} />
                      <span>Terminated (Integrity Violation)</span>
                    </>
                  ) : isPassed ? (
                    <>
                      <CheckCircle2 size={12} />
                      <span>✓ Passed Benchmark</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={12} />
                      <span>Needs Improvement</span>
                    </>
                  )}
                </span>
              </div>

              {/* Verified Certificate ID */}
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#73766C] dark:text-neutral-400 bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 px-3 py-1 rounded-full">
                <ShieldCheck size={13} className="text-[#8FB305] dark:text-[#D4F82C]" />
                <span>ID: #{submission.id.slice(0, 10).toUpperCase()}</span>
              </div>
            </div>

            {/* Test Title & Candidate Identification */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-1">
              <div className="space-y-3 min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[#111215] dark:text-white tracking-tight leading-tight">
                  {testTitle}
                </h1>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-[#575A51] dark:text-neutral-400">
                  <div className="inline-flex items-center gap-2 font-bold text-[#111215] dark:text-white px-3 py-1 rounded-full bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                    <User size={14} className="text-[#73766C]" />
                    <span>Evaluated for {candidateDisplayName}</span>
                  </div>

                  {candidateEmail && (
                    <div className="inline-flex items-center gap-1.5">
                      <Mail size={14} className="text-[#73766C]" />
                      <span className="font-mono">{candidateEmail}</span>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#73766C]" />
                    <span>{formattedDate}</span>
                  </div>

                  {test?.duration && (
                    <div className="inline-flex items-center gap-1.5">
                      <Clock size={14} className="text-[#73766C]" />
                      <span>Allocated: {test.duration}m</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Hero Score Pill on mobile / Top summary on wide screens */}
              <div className="flex items-center gap-4 bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 p-4 sm:p-5 rounded-2xl shrink-0 self-start md:self-auto">
                <div className="text-left md:text-right">
                  <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 block tracking-wider font-mono">
                    Evaluation Result
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span
                      className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                        isTerminated
                          ? 'text-rose-600 dark:text-rose-400'
                          : isPassed
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {score}%
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#73766C] dark:text-neutral-400 block mt-0.5">
                    Benchmark: {passingScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* ── 4 Full-Width Bento KPI Metric Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-[#E4E7DC] dark:border-white/10">
              {/* Pass Threshold */}
              <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex flex-col justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block">
                  Pass Threshold
                </span>
                <p className="text-xl sm:text-2xl font-black text-[#111215] dark:text-white mt-1 font-mono">
                  {passingScore}%
                </p>
                <span
                  className={`text-xs font-bold block mt-1 ${
                    score >= passingScore ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {score >= passingScore ? `+${score - passingScore}% above goal` : `${passingScore - score}% below goal`}
                </span>
              </div>

              {/* Proctoring & Integrity */}
              <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex flex-col justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block">
                  Proctoring Audit
                </span>
                <p className="text-base sm:text-lg font-bold text-[#111215] dark:text-white mt-1 flex items-center gap-1.5">
                  {!hasIntegrityFlags ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-black">
                      <ShieldCheck size={16} />
                      <span>100% Clean</span>
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-bold">
                      <ShieldAlert size={16} />
                      <span>{tabSwitches} Warning(s)</span>
                    </span>
                  )}
                </p>
                <span className="text-xs text-[#73766C] dark:text-neutral-400 block mt-1">
                  {tabSwitches === 0 ? 'Zero focus loss recorded' : `${tabSwitches} window blur(s)`}
                </span>
              </div>

              {/* Questions/Problems Count */}
              <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex flex-col justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block">
                  {testType === 'coding' ? 'Challenges' : 'Questions Evaluated'}
                </span>
                <p className="text-xl sm:text-2xl font-black text-[#111215] dark:text-white mt-1 font-mono">
                  {questions.length || (testType === 'coding' ? 1 : '—')}
                </p>
                <span className="text-xs text-[#73766C] dark:text-neutral-400 block mt-1">
                  {testType === 'aptitude' && questionAnalytics.total > 0
                    ? `${questionAnalytics.correct} of ${questionAnalytics.total} correct (${Math.round((questionAnalytics.correct / questionAnalytics.total) * 100)}%)`
                    : 'Comprehensive evaluation'}
                </span>
              </div>

              {/* Verification Authority */}
              <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex flex-col justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 block">
                  Evaluation System
                </span>
                <p className="text-base sm:text-lg font-bold text-[#111215] dark:text-white mt-1 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
                  <span>InterviewXpert</span>
                </p>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block mt-1">
                  Tamper-Evident Record
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2-Column Responsive Dashboard Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          
          {/* ═════════ LEFT / MAIN CONTENT STREAM (8 COLS ON DESKTOP) ═════════ */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-6">

            {/* Evaluator / AI Analysis Feedback Card */}
            {submission.feedback && (
              <section className="rounded-3xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-6 sm:p-7 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                  <Sparkles size={16} />
                  <span>Automated Evaluator & Performance Analysis</span>
                </div>
                <p className="text-xs sm:text-sm text-blue-950 dark:text-blue-100 leading-relaxed whitespace-pre-wrap">
                  {submission.feedback}
                </p>
              </section>
            )}

            {/* ── Aptitude Assessment: Question Breakdown ── */}
            {testType === 'aptitude' && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg sm:text-xl font-black text-[#111215] dark:text-white tracking-tight">
                        Question & Solution Breakdown
                      </h2>
                      <p className="text-xs text-[#575A51] dark:text-neutral-400 mt-0.5">
                        Inspection of candidate answers, correct choices, and reasoning.
                      </p>
                    </div>

                    {/* Filter Tabs */}
                    {questions.length > 0 && (
                      <div className="flex items-center gap-1 p-1 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-xs font-bold self-start sm:self-auto flex-wrap">
                        <button
                          type="button"
                          onClick={() => setFilterMode('all')}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                            filterMode === 'all'
                              ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] shadow-xs'
                              : 'text-[#73766C] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white'
                          }`}
                        >
                          All ({questions.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterMode('correct')}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                            filterMode === 'correct'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-[#73766C] dark:text-neutral-400 hover:text-emerald-600'
                          }`}
                        >
                          Correct ({questionAnalytics.correct})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterMode('incorrect')}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                            filterMode === 'incorrect'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-[#73766C] dark:text-neutral-400 hover:text-rose-600'
                          }`}
                        >
                          Incorrect ({questionAnalytics.incorrect})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Question Search Bar */}
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#73766C]" size={15} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search questions by keyword or topic..."
                      className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#101114] text-xs text-[#111215] dark:text-white placeholder:text-[#73766C] outline-none transition-all focus:border-[#111215] dark:focus:border-[#D4F82C]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#73766C] hover:text-[#111215] dark:hover:text-white"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Questions List */}
                {filteredQuestions.length === 0 ? (
                  <div className="p-10 rounded-3xl border border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-center text-xs text-[#73766C] dark:text-neutral-400 space-y-1">
                    <p className="font-bold text-[#111215] dark:text-white">No questions match the current filter or search</p>
                    <p>Try resetting the search box or switching back to the "All" tab.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredQuestions.map((q, filteredIdx) => {
                      const origIdx = questions.indexOf(q);
                      const qNum = origIdx >= 0 ? origIdx + 1 : filteredIdx + 1;
                      const candidateChoice = submission.answers?.[origIdx];
                      const hasAnswered = candidateChoice !== undefined && candidateChoice !== null;
                      const isCorrectAnswer =
                        q.correctIndex !== undefined &&
                        hasAnswered &&
                        Number(candidateChoice) === Number(q.correctIndex);

                      const questionPrompt = q.question || q.title || q.text || `Question ${qNum}`;

                      return (
                        <div
                          key={origIdx}
                          id={`question-card-${qNum}`}
                          className="p-5 sm:p-6 lg:p-7 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs space-y-4 transition-all"
                        >
                          {/* Question Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <span
                                className={`size-8 rounded-xl text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                                  isCorrectAnswer
                                    ? 'bg-emerald-600 text-white'
                                    : hasAnswered
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-gray-400 text-white'
                                }`}
                              >
                                Q{qNum}
                              </span>
                              <div className="space-y-1 min-w-0">
                                <h3 className="text-sm sm:text-base font-bold text-[#111215] dark:text-white leading-snug">
                                  {questionPrompt}
                                </h3>
                                {q.difficulty && (
                                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400">
                                    Difficulty: {q.difficulty}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status Chip */}
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                isCorrectAnswer
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : hasAnswered
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                  : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-neutral-300'
                              }`}
                            >
                              {isCorrectAnswer ? '✓ Correct' : hasAnswered ? '✗ Incorrect' : 'Unattempted'}
                            </span>
                          </div>

                          {/* Options Breakdown */}
                          {Array.isArray(q.options) && q.options.length > 0 && (
                            <div className="space-y-2.5 pl-0 sm:pl-11">
                              {q.options.map((option: string, optIdx: number) => {
                                const isCorrectOption = q.correctIndex === optIdx;
                                const isCandidateSelected = candidateChoice === optIdx;

                                let optionClasses =
                                  'border-[#E4E7DC] dark:border-white/10 bg-[#FAFAF8] dark:bg-white/[0.02] text-[#575A51] dark:text-neutral-300';
                                if (isCorrectOption) {
                                  optionClasses =
                                    'border-emerald-400 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-semibold';
                                } else if (isCandidateSelected && !isCorrectOption) {
                                  optionClasses =
                                    'border-rose-400 dark:border-rose-700 bg-rose-50/70 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200 font-semibold';
                                }

                                return (
                                  <div
                                    key={optIdx}
                                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-start justify-between gap-3 transition-colors ${optionClasses}`}
                                  >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                      <span
                                        className={`size-6 rounded-lg flex items-center justify-center text-[11px] font-mono font-bold shrink-0 mt-0.5 ${
                                          isCorrectOption
                                            ? 'bg-emerald-600 text-white'
                                            : isCandidateSelected
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-black/5 dark:bg-white/10 text-[#73766C] dark:text-neutral-400'
                                        }`}
                                      >
                                        {String.fromCharCode(65 + optIdx)}
                                      </span>
                                      <span className="leading-relaxed break-words">{option}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold">
                                      {isCorrectOption && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-950 dark:text-emerald-100 flex items-center gap-1">
                                          <Check size={11} strokeWidth={3} />
                                          <span>Correct Answer</span>
                                        </span>
                                      )}
                                      {isCandidateSelected && !isCorrectOption && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-rose-200 dark:bg-rose-800 text-rose-950 dark:text-rose-100 flex items-center gap-1">
                                          <X size={11} strokeWidth={3} />
                                          <span>Candidate Choice</span>
                                        </span>
                                      )}
                                      {isCandidateSelected && isCorrectOption && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] flex items-center gap-1 font-bold">
                                          <span>✓ Selected</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Explanation Note */}
                          {q.explanation && (
                            <div className="sm:ml-11 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                              <span className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                <HelpCircle size={13} />
                                <span>Explanation & Solution Rationale</span>
                              </span>
                              <p className="leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ── Coding Challenge: Code Solution Breakdown ── */}
            {testType === 'coding' && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs">
                  <h2 className="text-lg sm:text-xl font-black text-[#111215] dark:text-white tracking-tight">
                    Submitted Code Solutions
                  </h2>
                  <p className="text-xs text-[#575A51] dark:text-neutral-400 mt-0.5">
                    Inspection of candidate source code submissions and challenge test cases.
                  </p>
                </div>

                {questions.length === 0 && (!submission.answers || submission.answers.length === 0) ? (
                  <div className="p-8 rounded-3xl border border-dashed border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-center text-xs text-[#73766C] dark:text-neutral-400">
                    Code submission files are processed and retained in recruiter security storage.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {(questions.length > 0 ? questions : [{ title: testTitle }]).map((q, cIdx) => {
                      const candidateCode =
                        submission.answers?.[cIdx] ||
                        (typeof submission.answers === 'string' ? submission.answers : '');
                      const problemTitle = q.title || q.question || `Coding Problem ${cIdx + 1}`;
                      const problemDesc = q.description || q.problemStatement || '';

                      return (
                        <div
                          key={cIdx}
                          id={`question-card-${cIdx + 1}`}
                          className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shadow-xs overflow-hidden"
                        >
                          {/* Problem Header */}
                          <div className="p-5 sm:p-6 border-b border-[#E4E7DC] dark:border-white/10 bg-[#FAFAF8] dark:bg-white/[0.02] space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="size-6 rounded-lg bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-mono font-bold flex items-center justify-center">
                                  #{cIdx + 1}
                                </span>
                                <h3 className="text-sm sm:text-base font-bold text-[#111215] dark:text-white">
                                  {problemTitle}
                                </h3>
                              </div>

                              {q.difficulty && (
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    q.difficulty === 'Easy'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : q.difficulty === 'Medium'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                  }`}
                                >
                                  {q.difficulty}
                                </span>
                              )}
                            </div>

                            {problemDesc && (
                              <p className="text-xs text-[#575A51] dark:text-neutral-300 leading-relaxed pt-1">
                                {problemDesc}
                              </p>
                            )}
                          </div>

                          {/* Code Viewer Container */}
                          <div className="p-4 sm:p-6 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#73766C] dark:text-neutral-400 flex items-center gap-1.5">
                                <Terminal size={13} />
                                <span>Submitted Implementation</span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleCopyCode(candidateCode || '', cIdx)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white cursor-pointer px-2.5 py-1 rounded-lg border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 transition-colors"
                              >
                                {copiedCodeIdx === cIdx ? <Check size={12} /> : <Copy size={12} />}
                                <span>{copiedCodeIdx === cIdx ? 'Copied!' : 'Copy Code'}</span>
                              </button>
                            </div>

                            <div className="rounded-2xl bg-[#0D0E11] border border-black/40 overflow-hidden shadow-inner">
                              <div className="px-4 py-2 border-b border-white/10 bg-white/5 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                                <span>solution.{testType === 'coding' ? 'ts' : 'txt'}</span>
                                <span>{candidateCode ? `${candidateCode.split('\n').length} lines` : 'Empty'}</span>
                              </div>
                              <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed select-all">
                                <code>{candidateCode || '// No code submitted for this challenge problem'}</code>
                              </pre>
                            </div>

                            {/* Test Cases if available */}
                            {q.testCases && (
                              <div className="p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-xs space-y-1">
                                <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 block tracking-wider">
                                  Verified Test Suite Specification
                                </span>
                                <pre className="font-mono text-[11px] text-[#111215] dark:text-neutral-200 overflow-x-auto whitespace-pre-wrap">
                                  {typeof q.testCases === 'string' ? q.testCases : JSON.stringify(q.testCases, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ═════════ RIGHT / STICKY SIDEBAR (4 COLS ON DESKTOP) ═════════ */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-6 lg:sticky lg:top-20">

            {/* 1. Luxury Circular Radial Score Gauge */}
            <RadialScoreGauge
              score={score}
              benchmark={passingScore}
              isPassed={isPassed}
              isTerminated={isTerminated}
            />

            {/* 2. Interactive Question Jump Matrix / Navigator */}
            {questions.length > 0 && (
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#15161A] border border-[#E4E7DC] dark:border-white/10 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#111215] dark:text-white flex items-center gap-1.5">
                    <Layers size={14} className="text-[#8FB305] dark:text-[#D4F82C]" />
                    <span>Question Navigator ({questions.length})</span>
                  </span>
                  <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-mono">
                    Click to inspect
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const qNum = idx + 1;
                    const userAns = submission?.answers?.[idx];
                    const hasAnswered = userAns !== undefined && userAns !== null;
                    const isCorrect =
                      q.correctIndex !== undefined &&
                      hasAnswered &&
                      Number(userAns) === Number(q.correctIndex);

                    let chipStyle =
                      'bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-300 border-[#E4E7DC] dark:border-white/10';
                    if (isCorrect) {
                      chipStyle = 'bg-emerald-500 text-white border-emerald-600 shadow-2xs font-black';
                    } else if (hasAnswered) {
                      chipStyle = 'bg-rose-500 text-white border-rose-600 shadow-2xs font-black';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => scrollToQuestion(qNum)}
                        className={`h-9 rounded-xl border text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center ${chipStyle}`}
                        title={`Question ${qNum}: ${isCorrect ? 'Correct' : hasAnswered ? 'Incorrect' : 'Unattempted'}`}
                      >
                        Q{qNum}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-1 text-[10px] text-[#73766C] dark:text-neutral-400 font-medium border-t border-[#E4E7DC]/60 dark:border-white/5">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>Correct</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-rose-500" />
                    <span>Incorrect</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-gray-400" />
                    <span>Unattempted</span>
                  </span>
                </div>
              </div>
            )}

            {/* 3. Anti-Cheating & Integrity Security Dossier */}
            <section className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E4E7DC] dark:border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111215] dark:text-white">
                    Anti-Cheat Proctoring Audit
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    !hasIntegrityFlags
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {!hasIntegrityFlags ? '100% Clean' : 'Audit Warnings'}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#73766C] dark:text-neutral-400 block">
                      Tab / Focus Switches
                    </span>
                    <span className="text-xs text-[#73766C] dark:text-neutral-400">
                      Browser tab blur monitor
                    </span>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl ${
                      tabSwitches > 0
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {tabSwitches === 0 ? '0 (Clean)' : `${tabSwitches} Flaggable`}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#73766C] dark:text-neutral-400 block">
                      Clipboard Protection
                    </span>
                    <span className="text-xs text-[#73766C] dark:text-neutral-400">
                      Copy-paste intercepts
                    </span>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl ${
                      copyPasteAttempts > 0
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {copyPasteAttempts === 0 ? '0 (Protected)' : `${copyPasteAttempts} Blocked`}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#73766C] dark:text-neutral-400 block">
                      Screen Capture Guard
                    </span>
                    <span className="text-xs text-[#73766C] dark:text-neutral-400">
                      PrintScreen intercept traps
                    </span>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl ${
                      screenshotAttempts > 0
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {screenshotAttempts === 0 ? '0 (Clean)' : `${screenshotAttempts} Blocked`}
                  </span>
                </div>
              </div>

              <div className="pt-1 text-[10px] text-[#73766C] dark:text-neutral-400 text-center font-medium">
                Cryptographically signed by InterviewXpert Proctoring Engine
              </div>
            </section>

            {/* 4. Share & Export Hub */}
            <section className="print:hidden rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8FB305] dark:text-[#D4F82C]">
                  SHARE SCORECARD
                </span>
                <h3 className="text-sm sm:text-base font-black text-[#111215] dark:text-white">
                  Send verified result link
                </h3>
                <p className="text-xs text-[#575A51] dark:text-neutral-400">
                  Accessible to clients, hiring managers, and recruiters without signing in.
                </p>
              </div>

              {/* Copy Input Bar */}
              <div className="flex items-center gap-2 p-1.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-2.5 py-1 text-xs font-mono text-[#575A51] dark:text-neutral-300 bg-transparent outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] hover:opacity-90'
                  }`}
                >
                  {copiedLink ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Social Channels Strip */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <MessageCircle size={13} />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareLinkedIn}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#111215] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Linkedin size={13} className="text-[#0A66C2]" />
                  <span>LinkedIn</span>
                </button>
              </div>
            </section>

          </div>
        </div>

        {/* ── Footer Branding & Quick Links ── */}
        <footer className="pt-6 pb-12 border-t border-[#E4E7DC] dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#73766C] dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <HireXLogo size="sm" variant="full" withLink to="/" isDark={isDark} />
            <span>• Verified Talent Assessment Cloud</span>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/upload-resume" className="hover:text-[#111215] dark:hover:text-white transition-colors">
              Candidate Onboard
            </Link>
            <Link to="/candidate" className="hover:text-[#111215] dark:hover:text-white transition-colors">
              Candidate Desk
            </Link>
            <Link to="/guide" className="hover:text-[#111215] dark:hover:text-white transition-colors">
              Platform Guide
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default AssessmentResultReport;
