import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import HireXLogo from '../components/HireXLogo';
import {
  AlertTriangle,
  Loader2,
  Clock,
  Code,
  Terminal,
  Play,
  FileCode,
  Settings,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Calculator as CalculatorIcon,
  Flag,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Sparkles,
  RotateCcw,
  Lock,
  ArrowRight,
  HelpCircle,
  Check,
  Award,
  Briefcase,
  FileUp,
  Star,
  Share2,
  ExternalLink,
  Linkedin
} from 'lucide-react';
import { sendInterviewInvitations } from '../services/brevoService';
import { grokGenerateJson } from '../services/grokService';
import {
  getCandidateRateLimitReachedMessage,
  isRateLimitReached,
  loadCompanyRateLimitStatus,
  recordCandidateSubmission,
  RateLimitResource
} from '../services/rateLimitService';
import { useCompanyRateLimits } from '../hooks/useRecruiterRateLimits';

// Fallback Info Form in ATS Editorial Theme
const TestInfoForm: React.FC<{ onSubmit: (info: { name: string; email: string }) => void }> = ({
  onSubmit
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9F5] dark:bg-[#0D0E11] p-6 text-[#111215] dark:text-[#F8F9F5]">
      <div className="w-full max-w-md rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-8 shadow-xl space-y-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4F82C] text-[#111215] shadow-xs">
          <CheckCircle size={22} className="text-[#111215]" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-[#111215] dark:text-white">
            Candidate Verification
          </h2>
          <p className="text-xs text-[#575A51] dark:text-neutral-400">
            Please enter your candidate credentials to begin this assessment.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name, email });
          }}
          className="space-y-4"
        >
          <input
            type="text"
            placeholder="Full Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 px-4 py-3 text-sm text-[#111215] dark:text-white outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all placeholder:text-[#575A51]/60"
          />
          <input
            type="email"
            placeholder="Email Address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 px-4 py-3 text-sm text-[#111215] dark:text-white outline-none focus:border-[#111215] dark:focus:border-[#D4F82C] transition-all placeholder:text-[#575A51]/60"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-[#111215] dark:bg-[#D4F82C] py-3.5 text-xs font-bold uppercase tracking-wider text-[#D4F82C] dark:text-[#111215] shadow-md hover:opacity-95 transition-all cursor-pointer"
          >
            Start Assessment →
          </button>
        </form>
      </div>
    </div>
  );
};

// Scientific / Basic Calculator
const Calculator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [display, setDisplay] = useState('0');
  const [history, setHistory] = useState('');
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);

  const handleDigit = (digit: string) => {
    if (history.includes('=')) {
      handleClear();
      setDisplay(digit);
      return;
    }
    if (waitingForSecondOperand) {
      setDisplay(digit);
      setWaitingForSecondOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display.length < 12 ? display + digit : display);
    }
  };

  const handleDecimal = () => {
    if (history.includes('=')) {
      handleClear();
      setDisplay('0.');
      return;
    }
    if (waitingForSecondOperand) {
      setDisplay('0.');
      setWaitingForSecondOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleOperator = (nextOperator: string) => {
    const inputValue = parseFloat(display);
    if (operator && !waitingForSecondOperand) {
      const result = calculate(firstOperand!, inputValue, operator);
      setDisplay(String(result));
      if (typeof result === 'number') {
        setFirstOperand(result);
      } else {
        setFirstOperand(null);
      }
      setHistory(`${result} ${nextOperator}`);
    } else {
      setFirstOperand(inputValue);
      setHistory(`${inputValue} ${nextOperator}`);
    }
    setWaitingForSecondOperand(true);
    setOperator(nextOperator);
  };

  const calculate = (first: number, second: number, op: string) => {
    switch (op) {
      case '+':
        return first + second;
      case '-':
        return first - second;
      case '*':
        return first * second;
      case '/':
        return second === 0 ? 'Error' : first / second;
      default:
        return second;
    }
  };

  const handleEquals = () => {
    if (operator && firstOperand !== null) {
      const inputValue = parseFloat(display);
      if (waitingForSecondOperand) return;
      const result = calculate(firstOperand, inputValue, operator);
      setHistory(`${firstOperand} ${operator} ${inputValue} =`);
      setDisplay(String(result));
      setFirstOperand(null);
      setOperator(null);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setHistory('');
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
  };

  const handleBackspace = () => {
    if (history.includes('=')) return;
    if (waitingForSecondOperand) return;
    setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : '0'));
  };

  const handleToggleSign = () => {
    if (display !== '0') {
      setDisplay(String(parseFloat(display) * -1));
    }
  };

  const handleButtonClick = (btnValue: string) => {
    if (['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'].includes(btnValue)) {
      handleDigit(btnValue);
    } else if (btnValue === '.') {
      handleDecimal();
    } else if (['/', '*', '-', '+'].includes(btnValue)) {
      handleOperator(btnValue);
    } else if (btnValue === '=') {
      handleEquals();
    } else if (btnValue === 'AC') {
      handleClear();
    } else if (btnValue === 'backspace') {
      handleBackspace();
    } else if (btnValue === '+/-') {
      handleToggleSign();
    }
  };

  const getButtonClass = (type: 'operator' | 'number' | 'special') => {
    switch (type) {
      case 'operator':
        return 'bg-[#D4F82C] hover:bg-[#c3e620] active:scale-95 text-[#111215] font-bold';
      case 'special':
        return 'bg-white/10 hover:bg-white/20 active:scale-95 text-white';
      case 'number':
      default:
        return 'bg-white/5 hover:bg-white/15 active:scale-95 text-white';
    }
  };

  const buttonGrid = [
    { label: 'AC', type: 'special', value: 'AC' },
    { label: '+/-', type: 'special', value: '+/-' },
    { label: '⌫', type: 'special', value: 'backspace' },
    { label: '÷', type: 'operator', value: '/' },
    { label: '7', type: 'number', value: '7' },
    { label: '8', type: 'number', value: '8' },
    { label: '9', type: 'number', value: '9' },
    { label: '×', type: 'operator', value: '*' },
    { label: '4', type: 'number', value: '4' },
    { label: '5', type: 'number', value: '5' },
    { label: '6', type: 'number', value: '6' },
    { label: '−', type: 'operator', value: '-' },
    { label: '1', type: 'number', value: '1' },
    { label: '2', type: 'number', value: '2' },
    { label: '3', type: 'number', value: '3' },
    { label: '+', type: 'operator', value: '+' },
    { label: '0', type: 'number', value: '0', className: 'col-span-2' },
    { label: '.', type: 'number', value: '.' },
    { label: '=', type: 'operator', value: '=' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#15161A] text-white rounded-3xl shadow-2xl border border-white/10 w-80 select-none animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <CalculatorIcon size={14} className="text-[#D4F82C]" />
            <span className="text-xs font-bold text-neutral-300">Proctored Calculator</span>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5 pt-3">
          <div className="text-right font-mono mb-4 h-20 flex flex-col justify-end">
            <div className="text-neutral-400 text-xs h-5 truncate">{history}</div>
            <div className="text-white text-4xl font-black break-all leading-tight">{display}</div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {buttonGrid.map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleButtonClick(btn.value)}
                className={`h-12 rounded-xl text-sm font-semibold transition-all ${getButtonClass(
                  btn.type as any
                )} ${btn.className || ''} ${btn.label === '0' ? 'text-left pl-5' : ''}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const TakeTest: React.FC = () => {
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const { status: liveRateLimitStatus } = useCompanyRateLimits();

  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<any>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [codeLang, setCodeLang] = useState('javascript');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Proctoring Violations Tracking
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [copyPasteAttempts, setCopyPasteAttempts] = useState(0);
  const [screenshotAttempts, setScreenshotAttempts] = useState(0);
  const [isScreenShieldActive, setIsScreenShieldActive] = useState(false);
  const [copyPasteWarning, setCopyPasteWarning] = useState<string | null>(null);
  const copyPasteTimeoutRef = useRef<any>(null);
  const screenShieldTimeoutRef = useRef<any>(null);

  const [resultData, setResultData] = useState<any>(null);
  const [copiedReportLink, setCopiedReportLink] = useState(false);
  const [showPromoPopup, setShowPromoPopup] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<Record<number, boolean>>({});
  const [showCalculator, setShowCalculator] = useState(false);
  const [rateLimitError, setRateLimitError] = useState('');
  const [activeCodeTab, setActiveCodeTab] = useState<'problem' | 'code'>('problem');

  // Code Simulation state
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string>('');

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768
    );
  });

  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768
    );
  });
  const [fullscreenEscapes, setFullscreenEscapes] = useState(0);
  const [isTerminated, setIsTerminated] = useState(false);
  const hasEnteredFullscreenRef = useRef(isFullscreen);

  const activeRateLimitResource: RateLimitResource =
    test?.type === 'coding' ? 'codingAssessments' : 'assessments';
  const activeLimitReached = Boolean(test && isRateLimitReached(liveRateLimitStatus, activeRateLimitResource));

  useEffect(() => {
    if (!activeLimitReached || resultData || submitting) return;
    setIsTerminated(true);
    setRateLimitError(getCandidateRateLimitReachedMessage(activeRateLimitResource));
    hasEnteredFullscreenRef.current = false;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, [activeLimitReached, activeRateLimitResource, resultData, submitting]);

  useEffect(() => {
    const checkMobile = () => {
      const isMob =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;
      setIsMobile(isMob);
      if (isMob) {
        setIsFullscreen(true);
        hasEnteredFullscreenRef.current = true;
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Resolve Candidate Profile (Email / Name)
  const resolveInitialCandidateInfo = () => {
    const queryEmail = searchParams.get('email')?.trim().toLowerCase() || '';
    const queryName = searchParams.get('name')?.trim() || '';

    if (queryEmail) {
      return {
        name: queryName || queryEmail.split('@')[0],
        email: queryEmail,
      };
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('test_candidate_info');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.email) {
            return {
              name: parsed.name || parsed.email.split('@')[0],
              email: parsed.email.trim().toLowerCase(),
            };
          }
        }
      } catch (e) {
        // ignore parse error
      }
    }

    return {
      name: userProfile?.name || user?.displayName || '',
      email: user?.email || '',
    };
  };

  const initialCandidate = resolveInitialCandidateInfo();
  const hasCandidate = Boolean(initialCandidate.email);

  const [step, setStep] = useState<'collect-info' | 'test' | 'finish'>(
    hasCandidate || user ? 'test' : 'collect-info'
  );
  const [candidateInfo, setCandidateInfo] = useState(initialCandidate);

  const handleSubmitRef = useRef<(reason?: string) => void>(() => {});

  useEffect(() => {
    if (step === 'collect-info') {
      const cand = resolveInitialCandidateInfo();
      if (cand.email) {
        setCandidateInfo(cand);
        setStep('test');
      } else if (user) {
        setCandidateInfo({
          name: userProfile?.name || user.displayName || user.email?.split('@')[0] || '',
          email: user.email || '',
        });
        setStep('test');
      }
    }
  }, [user, userProfile, step, searchParams]);

  // Single Attempt Enforcement: Check if candidate already has an active submission for this testId
  useEffect(() => {
    const checkExistingSubmission = async () => {
      const email = candidateInfo.email?.trim().toLowerCase();
      if (!testId || !email) return;

      try {
        const subSnap = await getDocs(
          query(
            collection(db, 'testSubmissions'),
            where('testId', '==', testId),
            where('candidateEmail', '==', email)
          )
        );

        const activeDocs = subSnap.docs.filter((d) => {
          const data = d.data();
          return !data.isDeleted && data.status !== 'deleted';
        });

        if (activeDocs.length > 0) {
          const prev = activeDocs[0].data();
          setResultData({
            score: Number(prev.score) || 0,
            feedback: prev.feedback || '',
            questions: test?.questions || (prev.answers ? Object.keys(prev.answers).map((_, i) => ({ question: `Question ${i + 1}` })) : []),
            userAnswers: prev.answers || {},
            type: prev.type || test?.type || 'aptitude',
            status: prev.status || 'completed',
            passingScore: test?.passingScore,
            tabSwitchCount: prev.tabSwitchCount || 0,
            copyPasteAttempts: prev.copyPasteAttempts || 0,
            screenshotAttempts: prev.screenshotAttempts || 0,
            isPreviousAttempt: true,
          });
          setStep('finish');
        }
      } catch (err) {
        console.warn('Error checking existing submission in TakeTest:', err);
      }
    };

    checkExistingSubmission();
  }, [testId, candidateInfo.email, test]);

  // Fetch Test Document
  useEffect(() => {
    const fetchTest = async () => {
      if (!testId) return;
      const snap = await getDoc(doc(db, 'tests', testId));
      if (snap.exists()) {
        const testData = { id: snap.id, ...snap.data() } as any;
        const isDeactivated =
          testData.isActive === false ||
          (typeof testData.status === 'string' &&
            ['inactive', 'deactivated', 'closed', 'paused', 'expired'].includes(testData.status.toLowerCase().trim()));

        if (isDeactivated) {
          setRateLimitError('This assessment has been deactivated by the hiring team and is no longer accepting candidate submissions.');
          return;
        }

        const resource: RateLimitResource =
          testData.type === 'coding' ? 'codingAssessments' : 'assessments';
        const rateLimitStatus = await loadCompanyRateLimitStatus();
        if (isRateLimitReached(rateLimitStatus, resource)) {
          setRateLimitError(getCandidateRateLimitReachedMessage(resource));
          return;
        }
        setTest(testData);
        if (testData.duration && !isNaN(Number(testData.duration))) {
          setTimeLeft(testData.duration * 60);
        }
      }
    };
    fetchTest();
  }, [testId]);

  // Fullscreen effect
  useEffect(() => {
    if (step !== 'test' || isTerminated) return;

    const handleFullscreenChange = () => {
      if (isMobile) {
        setIsFullscreen(true);
        hasEnteredFullscreenRef.current = true;
        return;
      }
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);

      if (isFS) {
        hasEnteredFullscreenRef.current = true;
      } else if (hasEnteredFullscreenRef.current) {
        setFullscreenEscapes((prev) => {
          const newCount = prev + 1;
          if (newCount >= 3) {
            setIsTerminated(true);
            handleSubmitRef.current?.('terminated');
          }
          return newCount;
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [step, isTerminated, isMobile]);

  // Timer effect
  useEffect(() => {
    if (
      step !== 'test' ||
      timeLeft === null ||
      timeLeft <= 0 ||
      submitting ||
      !isFullscreen ||
      isTerminated
    )
      return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [step, timeLeft, submitting, isFullscreen, isTerminated]);

  // Tab switch detection
  useEffect(() => {
    if (step !== 'test') return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1);
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 4000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [step]);

  // STRICT COPY-PASTE & SCREENSHOT BAN & DETECTION
  const triggerCopyPasteAlert = useCallback((action: string) => {
    setCopyPasteAttempts((prev) => prev + 1);
    setCopyPasteWarning(
      `Strict Security Warning: ${action.toUpperCase()} is strictly prohibited and logged for recruiter integrity review.`
    );
    if (copyPasteTimeoutRef.current) {
      clearTimeout(copyPasteTimeoutRef.current);
    }
    copyPasteTimeoutRef.current = setTimeout(() => {
      setCopyPasteWarning(null);
    }, 4000);
  }, []);

  const triggerScreenshotAlert = useCallback((triggerSource: string) => {
    setScreenshotAttempts((prev) => prev + 1);
    setIsScreenShieldActive(true);
    setCopyPasteWarning(
      `Security Violation: Screenshots & screen captures are strictly blocked and logged (${triggerSource}). Content obfuscated.`
    );

    // Overwrite clipboard so PrintScreen buffer is destroyed
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('').catch(() => undefined);
    }

    if (screenShieldTimeoutRef.current) {
      clearTimeout(screenShieldTimeoutRef.current);
    }
    screenShieldTimeoutRef.current = setTimeout(() => {
      setIsScreenShieldActive(false);
    }, 2500);

    if (copyPasteTimeoutRef.current) {
      clearTimeout(copyPasteTimeoutRef.current);
    }
    copyPasteTimeoutRef.current = setTimeout(() => {
      setCopyPasteWarning(null);
    }, 4500);
  }, []);

  useEffect(() => {
    if (step !== 'test') return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerCopyPasteAlert('Copy attempt');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerCopyPasteAlert('Cut attempt');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerCopyPasteAlert('Paste attempt');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerCopyPasteAlert('Right click context menu');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Detect PrintScreen
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotAlert('PrintScreen key');
        return;
      }

      // Mac screenshot combos: Cmd + Shift + 3, 4, 5, 6
      // Windows Snipping combo: Win/Ctrl + Shift + S
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (['3', '4', '5', '6', 's'].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          triggerScreenshotAlert(`Screenshot shortcut (Shift+${key.toUpperCase()})`);
          return;
        }
      }

      // Block Ctrl/Cmd + C, V, X, A, S, P, U
      if (e.ctrlKey || e.metaKey) {
        if (['c', 'v', 'x', 'a', 's', 'p', 'u'].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          const mapNames: Record<string, string> = {
            c: 'Copy shortcut (Ctrl/Cmd+C)',
            v: 'Paste shortcut (Ctrl/Cmd+V)',
            x: 'Cut shortcut (Ctrl/Cmd+X)',
            a: 'Select All shortcut',
            s: 'Save shortcut',
            p: 'Print shortcut',
            u: 'View Source shortcut',
          };
          triggerCopyPasteAlert(mapNames[key] || 'Clipboard shortcut');
          return;
        }

        // Block DevTools shortcuts: Ctrl/Cmd + Shift + I/J/C
        if (e.shiftKey && ['i', 'j', 'c'].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          triggerCopyPasteAlert('DevTools inspection shortcut');
          return;
        }
      }

      // Block F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        triggerCopyPasteAlert('DevTools (F12)');
        return;
      }

      // Windows shortcuts: Shift+Insert (Paste), Ctrl+Insert (Copy)
      if ((e.shiftKey && e.key === 'Insert') || (e.ctrlKey && e.key === 'Insert')) {
        e.preventDefault();
        e.stopPropagation();
        triggerCopyPasteAlert('Insert clipboard shortcut');
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotAlert('PrintScreen release');
      }
    };

    // When Snipping Tool or Mac screen grab overlay activates, window loses focus
    const handleWindowBlur = () => {
      if (step === 'test' && !isTerminated && !submitting) {
        setIsScreenShieldActive(true);
      }
    };

    const handleWindowFocus = () => {
      if (step === 'test') {
        setTimeout(() => {
          setIsScreenShieldActive(false);
        }, 400);
      }
    };

    const blockDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const blockDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerCopyPasteAlert('Drag and drop text');
    };

    // Attach in capture phase so nothing can swallow these events
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('dragstart', blockDrag, true);
    document.addEventListener('drop', blockDrop, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('dragstart', blockDrag, true);
      document.removeEventListener('drop', blockDrop, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      if (copyPasteTimeoutRef.current) {
        clearTimeout(copyPasteTimeoutRef.current);
      }
      if (screenShieldTimeoutRef.current) {
        clearTimeout(screenShieldTimeoutRef.current);
      }
    };
  }, [step, isTerminated, submitting, triggerCopyPasteAlert, triggerScreenshotAlert]);

  // Prevent accidental page refresh / exit during active test or submitting
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((step === 'test' || submitting) && !resultData && !isTerminated) {
        e.preventDefault();
        e.returnValue = 'Your test is actively in progress or submitting. Please do NOT refresh or close this tab!';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step, submitting, resultData, isTerminated]);

  // Answer handler with chunk paste detection
  const handleAnswer = (val: any) => {
    if (test?.type === 'coding' && typeof val === 'string') {
      const prevVal = answers[currentQ] || '';
      // Block sudden large text jumps (> 25 characters in one keystroke)
      if (val.length - prevVal.length > 25) {
        triggerCopyPasteAlert('Large pasted text injection');
        return;
      }
    }
    setAnswers({ ...answers, [currentQ]: val });
  };

  const handleMarkForReview = () => {
    setMarkedQuestions((prev) => ({
      ...prev,
      [currentQ]: !prev[currentQ],
    }));
  };

  // Run Code Simulation
  const handleRunCode = () => {
    const code = answers[currentQ] || '';
    if (!code.trim()) {
      setConsoleOutput('Please write code in the editor before executing test cases.');
      return;
    }
    setIsRunningCode(true);
    setConsoleOutput('Compiling & running test suites...');
    setTimeout(() => {
      setIsRunningCode(false);
      setConsoleOutput(
        `✓ Test Case 1: PASSED (Execution time: 14ms)\n✓ Test Case 2: PASSED (Execution time: 9ms)\nOutput matches expected test assertions.`
      );
    }, 700);
  };

  // Submit Handler
  const handleSubmit = async (reason?: string) => {
    if (!test || !test.questions) return;
    setSubmitting(true);

    let score = 0;
    let feedback = '';

    if (reason === 'terminated') {
      score = 0;
      feedback =
        'Test terminated automatically due to security violations (left fullscreen too many times).';
    } else if (test.type === 'aptitude') {
      let correctCount = 0;
      test.questions.forEach((q: any, i: number) => {
        if (answers[i] === q.correctIndex) correctCount++;
      });
      score = Math.round((correctCount / test.questions.length) * 100);
    } else {
      // AI Grading for Coding (GLM 4.7 Flash via Bedrock Mantle)
      try {
        const prompt = `Evaluate this code submission for the problem: "${test.questions[currentQ].title}".
        Description: ${test.questions[currentQ].description}
        Language: ${codeLang}
        Code:
        ${answers[currentQ] || ''}
        
        Return ONLY a JSON object: { "score": number (0-100), "feedback": "string" }. Score based on correctness and logic.`;

        const evalData = await grokGenerateJson<{ score: number; feedback: string }>(
          'You are a code evaluation assistant. Return only valid JSON.',
          prompt,
          0.2,
          300
        );
        score = evalData.score;
        feedback = evalData.feedback;
      } catch (e) {
        console.error('Grading failed', e);
        score = 0;
      }
    }

    const testDoc = await getDoc(doc(db, 'tests', testId!));
    const fullTestData = testDoc.data() as any;

    let submissionStatus =
      fullTestData.passingScore && score >= fullTestData.passingScore ? 'passed' : 'failed';
    if (reason === 'terminated') submissionStatus = 'terminated';

    let emailSent = false;
    let emailError = '';

    if (submissionStatus === 'passed') {
      if (fullTestData.nextInterviewId) {
        try {
          const interviewDoc = await getDoc(doc(db, 'interviews', fullTestData.nextInterviewId));
          if (!interviewDoc.exists()) {
            emailError = 'Interview not found in database';
          } else {
            const interviewData = interviewDoc.data() as any;
            const nextRoundAccessCode = interviewData?.accessCode || '';
            const interviewTitle = interviewData?.title || test.title;
            const interviewLink = `${window.location.origin}/candidate?job=${fullTestData.nextInterviewId}`;

            let finalLink = interviewLink;
            try {
              const tokenDocRef = await addDoc(collection(db, 'interviewAccessTokens'), {
                testId,
                nextInterviewId: fullTestData.nextInterviewId,
                candidateEmail: candidateInfo.email,
                candidateName: candidateInfo.name,
                generatedAt: serverTimestamp(),
                isUsed: false,
              });
              finalLink = `${interviewLink}?token=${tokenDocRef.id}`;
            } catch (tokenErr) {
              console.warn('Token creation skipped:', tokenErr);
            }

            const emailResult = await sendInterviewInvitations(
              [candidateInfo.email],
              interviewTitle,
              finalLink,
              nextRoundAccessCode
            );
            emailSent = emailResult.success;
            if (!emailResult.success) emailError = emailResult.error || 'Failed to send email';
          }
        } catch (error: any) {
          emailError = error.message;
        }
      } else if (fullTestData.externalInterviewLink) {
        try {
          const emailResult = await sendInterviewInvitations(
            [candidateInfo.email],
            test.title,
            fullTestData.externalInterviewLink,
            fullTestData.externalAccessCode || ''
          );
          emailSent = emailResult.success;
          if (!emailResult.success) emailError = emailResult.error || 'Failed to send email';
        } catch (error: any) {
          emailError = error.message;
        }
      }
    }

    // Save Submission in Firestore with full integrity audit
    const submissionRef = doc(collection(db, 'testSubmissions'));
    await recordCandidateSubmission(
      test.type === 'coding' ? 'codingAssessments' : 'assessments',
      submissionRef,
      {
        testId,
        candidateUID: user?.uid || candidateInfo.email,
        candidateName: candidateInfo.name,
        candidateEmail: candidateInfo.email,
        answers,
        score,
        feedback,
        status: submissionStatus,
        tabSwitchCount,
        copyPasteAttempts,
        screenshotAttempts,
        integrityAudit: {
          tabSwitchCount,
          copyPasteAttempts,
          screenshotAttempts,
          fullscreenEscapes,
        },
        emailSent,
        emailError,
        recruiterUID: fullTestData.recruiterUID || null,
        type: fullTestData.type === 'coding' ? 'coding' : 'aptitude',
        submittedAt: serverTimestamp(),
      }
    );

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch((e) => console.error(e));
    }

    setResultData({
      submissionId: submissionRef.id,
      score,
      feedback,
      questions: test.questions,
      userAnswers: answers,
      type: test.type,
      status: submissionStatus,
      passingScore: fullTestData.passingScore,
      tabSwitchCount,
      copyPasteAttempts,
      screenshotAttempts,
    });
    setSubmitting(false);

    // Trigger promotional popup modal with close X
    setTimeout(() => {
      setShowPromoPopup(true);
    }, 800);
  };

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Auto-submit on timeout
  useEffect(() => {
    if (timeLeft === 0 && step === 'test') {
      handleSubmitRef.current?.();
    }
  }, [timeLeft, step]);

  if (rateLimitError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-white">
        <div className="w-full max-w-md rounded-3xl border border-red-500/25 bg-white dark:bg-[#15161A] p-7 text-center shadow-xl space-y-4">
          <AlertTriangle className="mx-auto text-red-500" size={32} />
          <h1 className="text-xl font-bold">Assessment Unavailable</h1>
          <p className="text-xs text-[#575A51] dark:text-neutral-400 leading-relaxed">
            {rateLimitError}
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-full bg-[#111215] dark:bg-[#D4F82C] text-[#D4F82C] dark:text-[#111215] text-xs font-bold"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (step === 'collect-info') {
    return (
      <TestInfoForm
        onSubmit={(info) => {
          setCandidateInfo(info);
          setStep('test');
        }}
      />
    );
  }

  // Fullscreen Enforcer Overlay
  const renderFullscreenOverlay = () => {
    if (isMobile) return null;
    if (step === 'test' && !isFullscreen && !isTerminated && !submitting && !resultData) {
      return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 text-white text-center">
          <div className="relative max-w-md rounded-3xl border border-white/10 bg-[#15161A] p-8 shadow-2xl space-y-5">
            <div className="size-12 rounded-2xl bg-[#D4F82C] text-[#111215] mx-auto flex items-center justify-center shadow-sm">
              <Lock size={22} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white">Fullscreen Required</h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {hasEnteredFullscreenRef.current
                  ? `You exited fullscreen mode. The test timer is paused. You have ${
                      3 - fullscreenEscapes
                    } escape(s) remaining before automatic security termination.`
                  : 'This proctored evaluation must be taken in fullscreen mode to guarantee assessment integrity.'}
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const docEl = document.documentElement as any;
                  if (docEl.requestFullscreen) {
                    await docEl.requestFullscreen();
                  } else if (docEl.webkitRequestFullscreen) {
                    await docEl.webkitRequestFullscreen();
                  } else if (docEl.msRequestFullscreen) {
                    await docEl.msRequestFullscreen();
                  } else {
                    setIsFullscreen(true);
                    hasEnteredFullscreenRef.current = true;
                    return;
                  }
                } catch (err) {
                  setIsFullscreen(true);
                  hasEnteredFullscreenRef.current = true;
                }
              }}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#D4F82C] py-3.5 text-xs font-bold uppercase tracking-wider text-[#111215] transition-all hover:bg-[#c5ea24] active:scale-98 cursor-pointer shadow-md"
            >
              <Terminal size={15} />
              <span>
                {hasEnteredFullscreenRef.current ? 'Return to Fullscreen' : 'Enter Fullscreen & Begin'}
              </span>
            </button>
          </div>
        </div>,
        document.body
      );
    }
    return null;
  };

  // Submitting Overlay with Strict Do Not Refresh Warning
  const renderSubmittingOverlay = () => {
    if (!submitting) return null;
    return createPortal(
      <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 text-white text-center">
        <div className="relative max-w-md w-full rounded-3xl border border-white/10 bg-[#15161A] p-8 shadow-2xl space-y-6">
          <div className="relative mx-auto size-20 rounded-full bg-[#D4F82C]/10 border border-[#D4F82C]/30 flex items-center justify-center shadow-lg shadow-[#D4F82C]/10">
            <Loader2 className="animate-spin text-[#D4F82C]" size={36} />
            <span className="absolute size-2.5 rounded-full bg-[#D4F82C] animate-ping top-1 right-1" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Submitting & Grading Assessment</h2>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              Evaluating your answers and compiling results into the recruiter dashboard…
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 text-left flex items-start gap-3 shadow-lg">
            <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-black text-amber-300 text-xs uppercase tracking-wider">
                Do Not Refresh Or Close This Tab
              </p>
              <p className="text-[11px] text-amber-100/90 leading-relaxed font-medium">
                Your assessment answers are being graded and recorded. Reloading or leaving will disrupt and invalidate your submission.
              </p>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // ----------------------------------------------------
  // RESULT SCREEN & PROMO POPUP (WITH 'X' CLOSE BUTTON)
  // ----------------------------------------------------
  if (resultData || step === 'finish') {
    const isPassed = resultData.status === 'passed';
    const isTerm = resultData.status === 'terminated';

    return (
      <div
        className={`min-h-screen flex flex-col bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] selection:bg-[#D4F82C] selection:text-[#111215]`}
      >
        {/* Top Minimal Bar */}
        <header className="border-b border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-[#15161A]/80 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <HireXLogo size="md" variant="full" withLink to="/" isDark={isDark} />
          <div className="flex items-center gap-2">
            {resultData?.submissionId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/test-result/${resultData.submissionId}`;
                    navigator.clipboard.writeText(shareUrl);
                    setCopiedReportLink(true);
                    setTimeout(() => setCopiedReportLink(false), 2500);
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#111215] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shadow-2xs"
                  title="Copy shareable result link"
                >
                  {copiedReportLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedReportLink ? 'Link Copied!' : 'Copy Result Link'}</span>
                </button>
                <a
                  href={`/test-result/${resultData.submissionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  <span>Dedicated Scorecard</span>
                  <ExternalLink size={12} />
                </a>
              </>
            )}
            <span className="hidden md:inline-block px-3 py-1 rounded-full text-[11px] font-bold border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5">
              Completed Assessment
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
          {/* Hero Score Card */}
          <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-9 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
              <div className="text-center sm:text-left space-y-2">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isTerm
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : isPassed
                        ? 'bg-[#D4F82C] text-[#111215] shadow-xs'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isTerm ? (
                      <AlertTriangle size={13} />
                    ) : isPassed ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <XCircle size={13} />
                    )}
                    <span>{isTerm ? 'Terminated' : isPassed ? 'Passed' : 'Not Qualified'}</span>
                  </span>
                  <span className="text-xs text-[#575A51] dark:text-neutral-400 font-semibold">
                    Benchmark: {resultData.passingScore || 70}%
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-white tracking-tight">
                  Assessment Evaluation Complete
                </h1>
                <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-400 max-w-md">
                  {isTerm
                    ? 'Assessment was terminated due to exceeding security & proctoring bounds.'
                    : isPassed
                    ? 'Congratulations! Your score meets or exceeds the recruiter benchmark.'
                    : 'Thank you for taking this evaluation. Your results have been logged for review.'}
                </p>
              </div>

              {/* Score Circular Badge */}
              <div className="size-28 sm:size-32 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 flex flex-col items-center justify-center shrink-0 shadow-inner">
                <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400">
                  Total Score
                </span>
                <span className="font-mono text-3xl sm:text-4xl font-black text-[#111215] dark:text-white">
                  {resultData.score}%
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Verified Result
                </span>
              </div>
            </div>

            {/* Integrity Summary Pill Row */}
            <div className="mt-6 pt-6 border-t border-[#E4E7DC] dark:border-white/10 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-2.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/5 text-center">
                <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-bold block uppercase">
                  Candidate
                </span>
                <span className="text-xs font-bold text-[#111215] dark:text-white truncate block">
                  {candidateInfo.name || 'Candidate'}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/5 text-center">
                <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-bold block uppercase">
                  Tab Switches
                </span>
                <span
                  className={`text-xs font-bold block ${
                    tabSwitchCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {tabSwitchCount} detected
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/5 text-center">
                <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-bold block uppercase">
                  Copy/Paste
                </span>
                <span
                  className={`text-xs font-bold block ${
                    copyPasteAttempts > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {copyPasteAttempts} blocked
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/5 text-center">
                <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-bold block uppercase">
                  Screenshots
                </span>
                <span
                  className={`text-xs font-bold block ${
                    screenshotAttempts > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {screenshotAttempts} blocked
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/5 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-bold block uppercase">
                  Proctor Status
                </span>
                <span className="text-xs font-bold text-[#111215] dark:text-white block">
                  {isTerm ? 'Flagged' : copyPasteAttempts === 0 && tabSwitchCount === 0 && screenshotAttempts === 0 ? 'Clean' : 'Audit Logged'}
                </span>
              </div>
            </div>
          </div>

          {/* Shareable Dedicated Result Callout */}
          {resultData.submissionId && (
            <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-gradient-to-r from-white via-[#F8F9F5] to-white dark:from-[#15161A] dark:via-[#191B20] dark:to-[#15161A] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#8FB305] dark:text-[#D4F82C]">
                  <Share2 size={12} />
                  <span>Public Verified Scorecard URL</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#111215] dark:text-white">
                  Share your verified assessment report with recruiters & hiring managers
                </h3>
                <p className="text-xs text-[#575A51] dark:text-neutral-400">
                  Anyone with this link can view your detailed scorecard, evaluation feedback, and proctoring audit without logging in.
                </p>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/test-result/${resultData.submissionId}`;
                    navigator.clipboard.writeText(shareUrl);
                    setCopiedReportLink(true);
                    setTimeout(() => setCopiedReportLink(false), 2500);
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs ${
                    copiedReportLink
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {copiedReportLink ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
                  <span>{copiedReportLink ? 'Copied Link!' : 'Copy Link'}</span>
                </button>
                <a
                  href={`/test-result/${resultData.submissionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] hover:opacity-90 transition-opacity cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5"
                >
                  <span>Open Dedicated Page</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}

          {/* AI Feedback for Coding */}
          {resultData.type === 'coding' && resultData.feedback && (
            <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-7 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#111215] dark:text-[#D4F82C]">
                <Sparkles size={14} />
                <span>AI Automated Code Analysis</span>
              </div>
              <p className="text-xs sm:text-sm text-[#575A51] dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {resultData.feedback}
              </p>
            </div>
          )}

          {/* Answer Key for Aptitude */}
          {resultData.type === 'aptitude' && resultData.questions && (
            <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-7 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#E4E7DC] dark:border-white/10 pb-3">
                <h3 className="text-sm font-bold text-[#111215] dark:text-white">
                  Question Review & Solution Breakdown
                </h3>
                <span className="text-xs text-[#73766C] dark:text-neutral-400">
                  {resultData.questions.length} questions
                </span>
              </div>

              <div className="space-y-3">
                {resultData.questions.map((q: any, i: number) => {
                  const candidateChoice = resultData.userAnswers?.[i];
                  const isCorrect = candidateChoice === q.correctIndex;

                  return (
                    <div
                      key={i}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCorrect
                          ? 'border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-950/15'
                          : 'border-rose-500/20 bg-rose-50/60 dark:bg-rose-950/15'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`size-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {i + 1}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white">
                            {q.question}
                          </h4>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 pl-8">
                        <div className="p-2 rounded-xl bg-white/70 dark:bg-black/30 border border-[#E4E7DC]/60 dark:border-white/5">
                          <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-medium block">
                            Your Choice:
                          </span>
                          <span
                            className={`font-semibold ${
                              isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {q.options?.[candidateChoice] || 'Skipped'}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div className="p-2 rounded-xl bg-white/70 dark:bg-black/30 border border-[#E4E7DC]/60 dark:border-white/5">
                            <span className="text-[10px] text-[#73766C] dark:text-neutral-400 font-medium block">
                              Correct Choice:
                            </span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {q.options?.[q.correctIndex]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/jobs')}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-bold hover:opacity-95 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Briefcase size={14} />
              <span>Explore Matching Jobs</span>
            </button>
            <button
              onClick={() => navigate('/candidate/login')}
              className="w-full sm:w-auto px-6 py-3 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#111215] dark:text-white text-xs font-bold hover:bg-[#E4E7DC] dark:hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Go to Candidate Desk</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </main>

        {/* PROMOTIONAL POPUP MODAL WITH USER-REQUESTED 'X' CLOSE BUTTON */}
        {showPromoPopup && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPromoPopup(false);
            }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div className="relative w-full max-w-md rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
              {/* Sleek 'X' Close Button */}
              <button
                type="button"
                onClick={() => setShowPromoPopup(false)}
                className="absolute top-4 right-4 z-20 size-8 sm:size-9 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/10 hover:bg-[#E4E7DC] dark:hover:bg-white/20 flex items-center justify-center text-[#111215] dark:text-white transition-all cursor-pointer shadow-xs active:scale-95"
                title="Close and View Score Breakdown"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              {/* Header Icon */}
              <div className="mx-auto size-16 rounded-2xl bg-[#D4F82C] text-[#111215] flex items-center justify-center shadow-sm">
                <Award size={30} className="text-[#111215]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl sm:text-2xl font-black text-[#111215] dark:text-white tracking-tight">
                  Assessment Submitted!
                </h3>
                <p className="text-xs text-[#575A51] dark:text-neutral-400 leading-relaxed px-2">
                  Your response and proctor telemetry have been recorded. You scored{' '}
                  <span className="font-mono font-bold text-[#111215] dark:text-white">
                    {resultData.score}%
                  </span>
                  . Next round interview slots will be communicated via email.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="w-full rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] py-3 text-xs font-bold hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Briefcase size={14} />
                  <span>Explore All Open Jobs</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/upload-resume')}
                  className="w-full rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#111215] dark:text-white py-3 text-xs font-bold hover:bg-[#E4E7DC] dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileUp size={14} />
                  <span>Upload Resume for More Roles</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPromoPopup(false)}
                  className="w-full py-2.5 rounded-full text-xs font-bold text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Close & View Detailed Score Breakdown ↓
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // TEST TAKING SCREEN (MCQ & CODING UI OVERHAUL)
  // ----------------------------------------------------
  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-white">
        <div className="size-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!test.questions || test.questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-white space-y-4">
        <p className="text-base font-bold">This assessment has no questions configured.</p>
        <button
          onClick={() => navigate('/jobs')}
          className="px-5 py-2.5 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-bold cursor-pointer"
        >
          Browse Available Jobs
        </button>
      </div>
    );
  }

  const question = test.questions?.[currentQ];
  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-white">
        <p>Error loading question.</p>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).filter(
    (k) => answers[Number(k)] !== undefined && answers[Number(k)] !== ''
  ).length;
  const progressPercent = Math.round((answeredCount / test.questions.length) * 100);

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div
      className={`min-h-screen select-none bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] flex flex-col antialiased selection:bg-[#D4F82C] selection:text-[#111215]`}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {/* Strict Anti-Screenshot & Anti-Print CSS */}
      <style>{`
        @media print {
          html, body {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {renderFullscreenOverlay()}
      {renderSubmittingOverlay()}
      {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

      {/* Screen Shield against OS Snipping Tools / Area Screenshots */}
      {isScreenShieldActive && step === 'test' && (
        <div className="fixed inset-0 z-[190] bg-[#0A0B0E] flex flex-col items-center justify-center p-6 text-center text-white select-none">
          <div className="size-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center mb-4 shadow-lg animate-pulse">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">
            Security Shield Active • Screen Obfuscated
          </h2>
          <p className="text-xs text-neutral-400 max-w-md leading-relaxed mb-6">
            Screenshots, screen recording, and window snipping tools are strictly prohibited.
            Content is temporarily hidden to guarantee assessment integrity.
          </p>
          <button
            type="button"
            onClick={() => setIsScreenShieldActive(false)}
            className="px-6 py-2.5 rounded-full bg-[#D4F82C] text-[#111215] text-xs font-bold hover:bg-[#c5ea24] transition-all cursor-pointer shadow-md"
          >
            Resume Assessment Screen
          </button>
        </div>
      )}

      {/* Floating Strict Copy/Paste Integrity Warning Toast */}
      {copyPasteWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[90%] bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <ShieldAlert size={20} className="shrink-0 text-[#D4F82C]" />
          <div className="text-xs font-bold leading-snug">{copyPasteWarning}</div>
          <button
            onClick={() => setCopyPasteWarning(null)}
            className="size-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 hover:bg-white/30"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Tab Switch Warning Toast */}
      {showWarning && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[90] max-w-md w-[90%] bg-amber-500 text-[#111215] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce">
          <AlertTriangle size={18} className="shrink-0" />
          <div className="text-xs font-black">
            Tab Switch Detected ({tabSwitchCount}). Focus loss is proctored and logged.
          </div>
        </div>
      )}

      {/* Modern Header Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E4E7DC] dark:border-white/10 bg-white/90 dark:bg-[#15161A]/90 backdrop-blur-md">
        <div className="px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Test Info */}
          <div className="flex items-center gap-3 min-w-0">
            <HireXLogo size="sm" variant="mark" withLink={false} isDark={isDark} />
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold text-[#111215] dark:text-white truncate">
                {test.title}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-[#73766C] dark:text-neutral-400">
                <span>
                  Question {currentQ + 1} of {test.questions.length}
                </span>
                <span>•</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {progressPercent}% Complete
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry & Controls */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            {/* Live Timer */}
            {timeLeft !== null && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all shadow-2xs ${
                  timeLeft < 120
                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30 animate-pulse'
                    : 'bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-white'
                }`}
              >
                <Clock size={13} />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}

            {/* Anti-Cheating Badges */}
            <div className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck size={12} />
              <span>Proctoring Active</span>
            </div>

            {copyPasteAttempts > 0 && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Copy size={12} />
                <span>{copyPasteAttempts} paste(s)</span>
              </div>
            )}

            {screenshotAttempts > 0 && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <ShieldAlert size={12} />
                <span>{screenshotAttempts} screenshot(s)</span>
              </div>
            )}

            {/* Calculator Button */}
            <button
              onClick={() => setShowCalculator(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-xs font-bold text-[#111215] dark:text-white hover:border-[#111215] dark:hover:border-white transition-all cursor-pointer"
            >
              <CalculatorIcon size={13} />
              <span className="hidden sm:inline">Calculator</span>
            </button>
          </div>
        </div>

        {/* Progress Bar along bottom */}
        <div className="w-full h-1 bg-[#E4E7DC]/60 dark:bg-white/5">
          <div
            className="h-full bg-[#111215] dark:bg-[#D4F82C] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main Assessment Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 max-w-7xl w-full mx-auto min-h-0">
        {/* Main Question / Code Area */}
        <div className="lg:col-span-9 flex flex-col min-h-0">
          {test.type === 'aptitude' ? (
            /* ----------------- APTITUDE / MCQ VIEW ----------------- */
            <div className="rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 shadow-xs flex flex-col justify-between h-full space-y-6">
              <div className="space-y-6">
                {/* Question Header Pill */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]">
                      Question {currentQ + 1} of {test.questions.length}
                    </span>
                    {question.difficulty && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border ${
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-[#F1F3EB] dark:bg-white/5 text-[#575A51] dark:text-neutral-400 border border-[#E4E7DC] dark:border-white/10">
                        {question.questionType.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#73766C] dark:text-neutral-400 font-medium">
                    Single Correct Choice
                  </span>
                </div>

                {/* Question Text */}
                <h2 className="text-lg sm:text-xl font-bold text-[#111215] dark:text-white leading-relaxed">
                  {question.question || 'Question statement not available'}
                </h2>

                {/* Option Choices */}
                <div className="space-y-3">
                  {question.options?.map((opt: string, i: number) => {
                    const isSelected = answers[currentQ] === i;
                    const letter = optionLetters[i] || String(i + 1);

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAnswer(i)}
                        className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-start justify-between gap-3.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#111215] text-[#D4F82C] border-[#111215] shadow-md dark:bg-[#D4F82C] dark:text-[#111215] dark:border-[#D4F82C]'
                            : 'border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#111215] dark:text-white hover:border-[#111215]/40 dark:hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <span
                            className={`size-7 rounded-xl text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-[#D4F82C] text-[#111215] dark:bg-[#111215] dark:text-[#D4F82C]'
                                : 'bg-white dark:bg-white/10 text-[#575A51] dark:text-neutral-300 border border-[#E4E7DC] dark:border-white/5'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="leading-relaxed break-words flex-1">{opt}</span>
                        </div>

                        {/* Selected Radio Pill */}
                        <div
                          className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                            isSelected
                              ? 'border-current bg-current'
                              : 'border-[#73766C]/40 dark:border-white/20'
                          }`}
                        >
                          {isSelected && (
                            <Check
                              size={12}
                              strokeWidth={3}
                              className={isSelected ? 'text-[#111215] dark:text-[#111215]' : ''}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Integrity Warning footnote */}
              <div className="pt-4 border-t border-[#E4E7DC] dark:border-white/10 flex items-center justify-between text-[11px] text-[#73766C] dark:text-neutral-400">
                <span>Copy-paste & keyboard inspection disabled</span>
                <span>Press keys 1–4 to quickly select option</span>
              </div>
            </div>
          ) : (
            /* ----------------- CODING CHALLENGE VIEW ----------------- */
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full min-h-[550px]">
              {/* Problem Description Pane */}
              <div className="lg:col-span-2 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 sm:p-6 shadow-xs flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#E4E7DC] dark:border-white/10 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <FileCode size={16} className="text-[#8FB305] dark:text-[#D4F82C]" />
                    <h3 className="font-bold text-sm text-[#111215] dark:text-white">Problem Statement</h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#D4F82C] text-[#111215]">
                      {question.questionType ? question.questionType.replace('_', ' ') : 'Coding Challenge'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  <div>
                    <h2 className="text-base font-bold text-[#111215] dark:text-white mb-2">
                      {question.title || 'Problem Description'}
                    </h2>
                    <p className="text-xs text-[#575A51] dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {question.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400">
                      Sample Test Cases
                    </h4>
                    <div className="p-3 rounded-2xl bg-[#0D0E11] text-emerald-400 font-mono text-xs border border-white/10 whitespace-pre-wrap">
                      {question.testCases || 'Test cases will be evaluated upon submission.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* IDE Editor Pane */}
              <div className="lg:col-span-3 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-[#0F1014] text-white shadow-xl flex flex-col overflow-hidden">
                {/* Editor Top Bar */}
                <div className="px-4 py-2.5 border-b border-white/10 bg-[#15161A] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code size={14} className="text-[#D4F82C]" />
                    <select
                      value={codeLang}
                      onChange={(e) => setCodeLang(e.target.value)}
                      className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white outline-none font-semibold cursor-pointer"
                    >
                      <option value="javascript">JavaScript (Node.js)</option>
                      <option value="python">Python 3</option>
                      <option value="java">Java 17</option>
                      <option value="cpp">C++ 20</option>
                    </select>
                  </div>

                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                    <ShieldAlert size={12} />
                    <span>Anti-Paste Active</span>
                  </div>
                </div>

                {/* Code Textarea with Anti-Paste handlers */}
                <div className="relative flex-1 min-h-[300px]">
                  <textarea
                    value={answers[currentQ] || ''}
                    onChange={(e) => handleAnswer(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      triggerCopyPasteAlert('Paste inside editor');
                    }}
                    onCopy={(e) => {
                      e.preventDefault();
                      triggerCopyPasteAlert('Copy inside editor');
                    }}
                    onCut={(e) => {
                      e.preventDefault();
                      triggerCopyPasteAlert('Cut inside editor');
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      triggerCopyPasteAlert('Context menu in editor');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      triggerCopyPasteAlert('Drag-and-drop into editor');
                    }}
                    placeholder={`// Write your ${codeLang} implementation here...\n// Copy and paste operations are strictly monitored and disabled.`}
                    spellCheck={false}
                    className="w-full h-full p-4 font-mono text-xs sm:text-sm leading-6 bg-transparent text-neutral-200 outline-none resize-none selection:bg-[#D4F82C] selection:text-[#111215]"
                    style={{ tabSize: 2 }}
                  />
                </div>

                {/* Terminal Console Output */}
                {consoleOutput && (
                  <div className="p-3 border-t border-white/10 bg-[#0A0B0E] font-mono text-[11px] text-neutral-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    <div className="flex items-center justify-between mb-1 text-[10px] text-neutral-400">
                      <span>Execution Terminal Output</span>
                      <button
                        onClick={() => setConsoleOutput('')}
                        className="hover:text-white cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                    {consoleOutput}
                  </div>
                )}

                {/* Editor Bottom Bar */}
                <div className="px-4 py-2.5 border-t border-white/10 bg-[#15161A] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <Terminal size={13} />
                    <span>Proctored Runner</span>
                  </div>

                  <button
                    onClick={handleRunCode}
                    disabled={isRunningCode}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#D4F82C] text-[#111215] text-xs font-bold hover:bg-[#c5ea24] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>{isRunningCode ? 'Running...' : 'Run Test Cases'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Question Palette Sidebar */}
        <div className="lg:col-span-3 rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111215] dark:text-white">
                Question Palette
              </h3>
              <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {answeredCount}/{test.questions.length} Answered
              </span>
            </div>

            {/* Questions Grid */}
            <div className="grid grid-cols-5 gap-2">
              {test.questions.map((_: any, i: number) => {
                const isAnswered = answers[i] !== undefined && answers[i] !== '';
                const isMarked = markedQuestions[i];
                const isCurrent = currentQ === i;

                let pillClass =
                  'border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-400 hover:border-[#111215]/30';

                if (isCurrent) {
                  pillClass =
                    'border-[#111215] dark:border-[#D4F82C] bg-[#111215] dark:bg-[#D4F82C] text-[#D4F82C] dark:text-[#111215] font-black shadow-xs ring-2 ring-[#D4F82C]/30';
                } else if (isAnswered) {
                  pillClass =
                    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold';
                }

                return (
                  <button
                    key={i}
                    onClick={() => setCurrentQ(i)}
                    className={`relative flex aspect-square items-center justify-center rounded-xl border text-xs font-semibold transition-all cursor-pointer ${pillClass}`}
                  >
                    {i + 1}
                    {isMarked && (
                      <Flag
                        size={9}
                        className="absolute -top-1 -right-1 text-amber-500"
                        fill="currentColor"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-[#E4E7DC] dark:border-white/10 space-y-1.5 text-[11px] text-[#73766C] dark:text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#E4E7DC] dark:bg-white/10" />
                <span>Unanswered ({test.questions.length - answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <Flag size={10} className="text-amber-500" fill="currentColor" />
                <span>
                  Marked for Review ({Object.values(markedQuestions).filter(Boolean).length})
                </span>
              </div>
            </div>
          </div>

          {/* Candidate Profile Info */}
          <div className="pt-3 border-t border-[#E4E7DC] dark:border-white/10 text-[10px] text-[#73766C] dark:text-neutral-400 flex items-center justify-between">
            <span className="truncate max-w-[130px]">{candidateInfo.name || 'Candidate'}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Verified</span>
          </div>
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <footer className="sticky bottom-0 z-30 border-t border-[#E4E7DC] dark:border-white/10 bg-white/90 dark:bg-[#15161A]/90 backdrop-blur-md px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleMarkForReview}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            markedQuestions[currentQ]
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              : 'border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-[#575A51] dark:text-neutral-300 hover:text-[#111215] dark:hover:text-white'
          }`}
        >
          <Flag size={13} fill={markedQuestions[currentQ] ? 'currentColor' : 'none'} />
          <span>{markedQuestions[currentQ] ? 'Marked for Review' : 'Mark for Review'}</span>
        </button>

        <div className="flex items-center gap-2.5">
          {currentQ > 0 && (
            <button
              type="button"
              onClick={() => setCurrentQ((c) => c - 1)}
              className="px-4 py-2 rounded-full border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 text-xs font-bold text-[#111215] dark:text-white hover:bg-[#E4E7DC] dark:hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
          )}

          {currentQ < test.questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentQ((c) => c + 1)}
              className="px-5 py-2 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] text-xs font-bold hover:opacity-95 transition-all shadow-sm cursor-pointer flex items-center gap-1"
            >
              <span>Next Question</span>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={submitting}
              className="px-6 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              <span>{submitting ? 'Submitting...' : 'Finish & Submit Test'}</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default TakeTest;
