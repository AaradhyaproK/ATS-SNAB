import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, serverTimestamp, updateDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadToCloudinary, generateInterviewQuestions, requestTranscription, fetchTranscriptText, generateFeedback, sanitizeQuestionLength } from '../services/api';
import fixWebmDuration from 'fix-webm-duration';
import { resolveJobOrInterviewDocument } from '../services/jobResolutionService';
import { speak, unlockTTSAudio, setMuteTTS, getMuteTTS } from '../lib/tts';
import { Interview, InterviewState } from '../types';
import { createPortal } from 'react-dom';
import { LanguageSelector } from './LanguageSelector';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import DayNightToggle from '../components/DayNightToggle';
import * as pdfjsLib from 'pdfjs-dist';
import { getCandidateRateLimitReachedMessage, isRateLimitReached, loadCompanyRateLimitStatus, recordCandidateSubmission } from '../services/rateLimitService';
import { analyzeResumeText, readResumeText, saveResumeDumpCandidate, ParsedResumeProfile } from '../services/resumeService';
import { useCompanyRateLimits } from '../hooks/useRecruiterRateLimits';
import { useLiveKitInterview } from '../hooks/useLiveKitInterview';
import { saveCandidateConsent } from '../services/candidateConsent';
import { LocationCityInput } from '../components/LocationCityInput';
import { EducationInput } from '../components/EducationInput';
import { isEducationMatching } from '../utils/educationMatcher';
import { isLocationMatching } from '../data/maharashtraCities';
import { ListenJDButton } from '../components/ListenJDButton';
import { FormattedJobDescription } from '../utils/jobDescriptionFormatter';
import {
  Sparkles,
  CheckCircle2,
  User,
  Mail,
  Phone,
  ArrowRight,
  ShieldCheck,
  FileText,
  UploadCloud,
  RefreshCw,
  Briefcase,
  GraduationCap,
  MapPin,
  Check,
  Video,
  AlertCircle,
  X,
  ExternalLink,
  Eye,
  ChevronRight,
  Zap,
  Building2,
  Clock,
  IndianRupee,
  Gauge,
  Shield,
  Volume2,
  VolumeX,
  Key,
  Mic,
  Camera,
  Bot,
  Star,
  Globe,
  BrainCircuit
} from 'lucide-react';


// Setup PDF.js worker to enable PDF parsing
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// --- Types ---
type WizardStep = 'validating' | 'welcome' | 'enter-code' | 'collect-info' | 'show-jd' | 'instructions' | 'setup' | 'interview' | 'processing' | 'finish';
type CandidateInfo = { 
  name: string; 
  email: string; 
  phone: string; 
  gender: string;
  dob: string;
  age: string;
  maritalStatus: string;
  currentCity: string;
  nativePlace: string;
  qualificationBasic: string;
  qualificationPG: string;
  totalExperienceYears: string;
  totalExperienceMonths: string;
  currentCompanyName: string;
  designation: string;
  currentSalary: string;
  noticePeriodDays: string;
  reasonForJobChange: string;
  resumeUpdated: string;
  highlightedSkillsForJob: string;
  isFresher: boolean;
  language: string;
  criteriaMismatches?: string[];
};

// --- Sarvam AI Transcription Helper ---
const transcribeWithSarvam = async (audioBlob: Blob, languageCode: string): Promise<string> => {
  // IMPORTANT: Storing API keys on the client-side is a major security risk.
  // This should be moved to a secure backend environment in a production application.
  // The key is now read from environment variables.
  const SARVAM_API_KEY = import.meta.env.VITE_SARVAM_API_KEY;

  const langMap: { [key: string]: string } = {
      en: 'en-IN',
      hi: 'hi-IN',
      mr: 'mr-IN'
  };
  const apiLangCode = langMap[languageCode] || 'en-IN';

  const formData = new FormData();
  // NOTE: The Sarvam API might expect a specific audio format like WAV.
  // MediaRecorder in most browsers produces WebM or Ogg. This might require server-side conversion if the API doesn't support it.
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('language_code', apiLangCode);
  formData.append('model', 'saaras:v3');

  try {
      const response = await fetch('https://api.sarvam.ai/speech-to-text', {
          method: 'POST',
          headers: { 'api-subscription-key': SARVAM_API_KEY },
          body: formData
      });
      const data = await response.json();
      if (response.ok) return data.transcript || "No speech detected.";
      throw new Error(data.message || "API Error during transcription");
  } catch (err) { 
      console.error("Transcription fetch error:", err);
      return `Error: ${(err as Error).message}`;
  }
}

const parsePdfToText = async (fileOrBlob: File | Blob): Promise<string> => {
  const MAX_PDF_PAGES = 3;
  const MAX_PDF_TEXT_CHARS = 6000;

  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    let fullText = '';
    const pagesToParse = Math.min(pdf.numPages, MAX_PDF_PAGES);

    for (let i = 1; i <= pagesToParse; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + ' ';

      if (fullText.length >= MAX_PDF_TEXT_CHARS) {
        break;
      }
    }

    return fullText.trim().slice(0, MAX_PDF_TEXT_CHARS);
  } catch (error) {
    console.error("PDF parsing error:", error);
    // Return empty string on failure, the base64 will be used as a fallback
    return '';
  }
};

const QUESTION_TIME_MS = 2 * 60 * 1000; // 2 minutes
const QUESTION_PREP_COUNTDOWN_SEC = 8; // 8-second countdown before recording starts
const TRANSCRIPT_POLL_ATTEMPTS = 20;
const TRANSCRIPT_POLL_DELAY_MS = 3000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const extractResumeText = async (fileOrBlob: File | Blob): Promise<string> => {
  if (fileOrBlob.type === 'application/pdf') {
    return parsePdfToText(fileOrBlob);
  }

  if (fileOrBlob.type.startsWith('text/')) {
    return (await fileOrBlob.text()).slice(0, 6000);
  }

  return '';
};

const getBlobAsBase64 = (blob: Blob): Promise<string> => (
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  })
);

const getFileAsBase64 = (file: File): Promise<{ base64: string; url: string }> => (
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const url = reader.result as string;
      resolve({ base64: url.split(',')[1], url });
    };
    reader.onerror = error => reject(error);
  })
);

const getFullscreenElement = (): Element | null => {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };

  return doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || null;
};

// --- Component: Tic-Tac-Toe (Glassmorphic & Dark Mode) ---
const TicTacToe: React.FC = () => {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  const checkWinner = (squares: (string | null)[]) => {
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return null;
  };

  const handleClick = (i: number) => {
    if (winner || board[i] || !isXNext) return;
    const newBoard = [...board];
    newBoard[i] = 'X';
    setBoard(newBoard);
    setIsXNext(false);
    const w = checkWinner(newBoard);
    if (w) setWinner(w);
  };

  useEffect(() => {
    if (!isXNext && !winner) {
      const timer = setTimeout(() => {
        const available = board.map((v, i) => v === null ? i : null).filter(v => v !== null);
        if (available.length > 0) {
          const random = available[Math.floor(Math.random() * available.length)];
          const newBoard = [...board];
          newBoard[random as number] = 'O';
          setBoard(newBoard);
          setIsXNext(true);
          const w = checkWinner(newBoard);
          if (w) setWinner(w);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isXNext, winner, board]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/90 backdrop-blur-md rounded-xl transition-all duration-300">
      <h3 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-4">
        {winner ? (winner === 'X' ? 'You Won!' : 'AI Won!') : (isXNext ? 'Your Turn (X)' : 'AI Thinking...')}
      </h3>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3 sm:mb-6">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={!!cell || !!winner || !isXNext}
            className={`w-14 h-14 sm:w-20 sm:h-20 text-xl sm:text-3xl font-bold flex items-center justify-center rounded-lg sm:rounded-xl shadow-inner transition-all 
              ${cell === 'X' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                cell === 'O' ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' :
                  'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
          >
            {cell}
          </button>
        ))}
      </div>
      {winner ? (
        <button onClick={() => { setBoard(Array(9).fill(null)); setIsXNext(true); setWinner(null); }} className="bg-primary hover:bg-primary-dark text-white px-4 sm:px-6 py-2 rounded-lg font-bold shadow-lg transition-colors text-sm sm:text-base">
          Play Again
        </button>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 animate-pulse font-medium text-xs sm:text-base">Uploading... Play while you wait!</p>
      )}
    </div>
  );
};

// --- Helper: Safely stringify education records (prevents Objects are not valid as React child error) ---
const formatCandidateEducationString = (edu: any): string => {
  if (!edu) return '';
  if (typeof edu === 'string') return edu.trim();
  if (Array.isArray(edu) && edu.length > 0) {
    return edu
      .map((e: any) => {
        if (!e) return '';
        if (typeof e === 'string') return e.trim();
        return e.degree || e.title || e.qualification || [e.degree, e.institution].filter(Boolean).join(' - ') || '';
      })
      .filter(Boolean)
      .join(', ');
  }
  if (typeof edu === 'object') {
    return edu.degree || edu.title || edu.qualification || [edu.degree, edu.institution].filter(Boolean).join(' - ') || '';
  }
  return String(edu).trim();
};

const extractCandidateEdu = (cand: any): string => {
  if (!cand) return '';
  if (typeof cand.qualificationBasic === 'string' && cand.qualificationBasic.trim()) return cand.qualificationBasic.trim();
  if (typeof cand.qualification === 'string' && cand.qualification.trim()) return cand.qualification.trim();
  if (typeof cand.highestEducation === 'string' && cand.highestEducation.trim()) return cand.highestEducation.trim();
  if (cand.education) return formatCandidateEducationString(cand.education);
  return '';
};

// --- Component: Candidate Info Form (Landing Page Bento Theme) ---
const CandidateInfoForm: React.FC<{
  jobTitle?: string;
  interviewId: string;
  interviewData?: Interview | null;
  onBackToWelcome: () => void;
  onSubmit: (info: CandidateInfo, file: File | null, existingResumeUrl?: string, cloudinaryUrl?: string) => void;
  errorMsg: string | null;
  user: any;
  userProfile: any;
}> = ({ jobTitle, interviewId, interviewData, onBackToWelcome, onSubmit, errorMsg: initialError, user, userProfile }) => {
  const [searchParams] = useSearchParams();
  const urlEmail = searchParams.get('email') || '';
  const urlName = searchParams.get('name') || '';
  const urlPhone = searchParams.get('phone') || '';

  const [name, setName] = useState(urlName || userProfile?.fullname || userProfile?.name || '');
  const [email, setEmail] = useState(urlEmail || user?.email || '');
  const [phone, setPhone] = useState(urlPhone || userProfile?.phone || '');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadedResumeUrl, setUploadedResumeUrl] = useState<string | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [language, setLanguage] = useState('en');

  // Pre-interview profile state
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('2000-01-01');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [nativePlace, setNativePlace] = useState('');
  const [qualificationBasic, setQualificationBasic] = useState('');
  const [qualificationPG, setQualificationPG] = useState('');
  const [totalExperienceYears, setTotalExperienceYears] = useState('');
  const [totalExperienceMonths, setTotalExperienceMonths] = useState('');
  const [currentCompanyName, setCurrentCompanyName] = useState('');
  const [designation, setDesignation] = useState('');
  const [currentSalary, setCurrentSalary] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('');
  const [reasonForJobChange, setReasonForJobChange] = useState('');
  const [highlightedSkillsForJob, setHighlightedSkillsForJob] = useState('');
  const [isFresher, setIsFresher] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const existingResumeUrl = userProfile?.resumeURL || userProfile?.resumeUrl;
  const [foundDumpCandidate, setFoundDumpCandidate] = useState<any | null>(null);
  const [isSearchingResumeDump, setIsSearchingResumeDump] = useState(false);
  const [isParsingResumeFirst, setIsParsingResumeFirst] = useState(false);
  const [autofillNotice, setAutofillNotice] = useState<string | null>(null);

  // Resume upload handler for candidates not in database
  const handleResumeFileChange = async (file: File) => {
    if (!file) return;
    setResumeFile(file);
    setIsParsingResumeFirst(true);
    setErrorMsg(null);
    setAutofillNotice(null);

    try {
      const resumeText = await readResumeText(file, file.name);
      if (resumeText) {
        const profile = await analyzeResumeText(resumeText, file.name, {
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
        });

        if (profile.name && !name) setName(profile.name);
        if (profile.email && !email) setEmail(profile.email.toLowerCase().trim());
        if (profile.phone && !phone) setPhone(profile.phone);
        if (profile.totalExperienceYears !== undefined && !totalExperienceYears) {
          setTotalExperienceYears(String(profile.totalExperienceYears));
          if (profile.totalExperienceYears === 0) setIsFresher(true);
        }
        if (profile.currentTitle && !designation) setDesignation(profile.currentTitle);
        if (profile.location && !currentCity) setCurrentCity(profile.location);
        if (profile.education && profile.education.length > 0 && !qualificationBasic) {
          setQualificationBasic(profile.education[0].degree || '');
        }
        if (profile.skills && profile.skills.length > 0 && !highlightedSkillsForJob) {
          setHighlightedSkillsForJob(profile.skills.join(', '));
        }

        setAutofillNotice(`✨ Resume parsed! Profile details auto-filled for ${profile.name || file.name}`);
      }
    } catch (err: any) {
      console.warn("Resume parsing warning:", err);
    } finally {
      setIsParsingResumeFirst(false);
    }
  };

  // Real-time Search: Email or Phone lookup across Resume Dump & Candidate Database
  useEffect(() => {
    const trimmedEmail = (email || '').trim().toLowerCase();
    const rawDigits = (phone || '').replace(/\D/g, '');
    const cleanDigits = rawDigits.slice(-10);
    const hasValidEmail = Boolean(trimmedEmail && trimmedEmail.includes('@') && trimmedEmail.includes('.'));
    const hasValidPhone = cleanDigits.length === 10;

    if (!hasValidEmail && !hasValidPhone) {
      if (!urlEmail && !urlPhone) {
        setFoundDumpCandidate(null);
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingResumeDump(true);
      try {
        let record: any = null;

        // 1. Search by email
        if (hasValidEmail) {
          const emailVariants = Array.from(new Set([
            trimmedEmail,
            email.trim()
          ])).filter(Boolean);

          let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', 'in', emailVariants), limit(1))).catch(() => null);
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.email', 'in', emailVariants), limit(1))).catch(() => null);
          }
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, 'resumeDump'), where('email', 'in', emailVariants), limit(1))).catch(() => null);
          }
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, 'resumeDump'), where('profile.email', 'in', emailVariants), limit(1))).catch(() => null);
          }
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, 'candidates'), where('email', 'in', emailVariants), limit(1))).catch(() => null);
          }
          if (snap && !snap.empty) {
            const raw = snap.docs[0].data();
            record = { ...(raw.profile || {}), ...raw };
          }
        }

        // 2. Search by phone if not found by email
        if (!record && hasValidPhone) {
          const phoneVariants = Array.from(new Set([
            cleanDigits,
            `+91 ${cleanDigits}`,
            `+91${cleanDigits}`,
            `91${cleanDigits}`,
            `0${cleanDigits}`,
            phone.trim()
          ])).filter(Boolean);

          let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('phone', 'in', phoneVariants), limit(1))).catch(() => null);
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.phone', 'in', phoneVariants), limit(1))).catch(() => null);
          }
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, 'resumeDump'), where('phone', 'in', phoneVariants), limit(1))).catch(() => null);
          }
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, 'resumeDump'), where('profile.phone', 'in', phoneVariants), limit(1))).catch(() => null);
          }
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, 'candidates'), where('phone', 'in', phoneVariants), limit(1))).catch(() => null);
          }
          if (snap && !snap.empty) {
            const raw = snap.docs[0].data();
            record = { ...(raw.profile || {}), ...raw };
          }
        }

        // 3. Search in interviewData.candidateData
        if (!record && interviewData && (interviewData as any).candidateData) {
          const list = (interviewData as any).candidateData;
          if (Array.isArray(list)) {
            const matched = list.find((c: any) => {
              if (hasValidEmail && c.email && c.email.toLowerCase() === trimmedEmail) return true;
              if (hasValidPhone && c.phone) {
                const cDigits = String(c.phone).replace(/\D/g, '').slice(-10);
                if (cDigits && cDigits === cleanDigits) return true;
              }
              return false;
            });
            if (matched) record = matched;
          }
        }

        if (record) {
          setFoundDumpCandidate(record);

          // Auto-fill all candidate fields from database
          if (record.name) setName(record.name);
          if (record.email && !email) setEmail(record.email);
          if (record.phone && !phone) setPhone(record.phone);
          if (record.gender) {
            const rawG = record.gender.toString().trim().toLowerCase();
            if (rawG.includes('female') || rawG === 'f') setGender('Female');
            else if (rawG.includes('male') || rawG === 'm') setGender('Male');
            else if (rawG.includes('other')) setGender('Other');
          }
          if (record.location || record.city || record.currentCity) {
            setCurrentCity(record.location || record.city || record.currentCity);
          }
          if (record.nativePlace) setNativePlace(record.nativePlace);
          if (record.dob) setDob(record.dob);
          if (record.maritalStatus) setMaritalStatus(record.maritalStatus);

          const expVal = record.totalExperienceYears ?? record.experienceYears ?? record.experience;
          if (expVal !== undefined && expVal !== null && expVal !== '') {
            const numExp = parseFloat(expVal.toString());
            if (!isNaN(numExp)) {
              if (numExp === 0) setIsFresher(true);
              setTotalExperienceYears(numExp.toString());
            }
          }
          if (record.currentCompanyName || record.currentCompany) {
            setCurrentCompanyName(record.currentCompanyName || record.currentCompany);
          }
          if (record.designation || record.currentTitle) {
            setDesignation(record.designation || record.currentTitle);
          }
          const eduStr = extractCandidateEdu(record);
          if (eduStr) setQualificationBasic(eduStr);
          if (record.resumeUrl || record.resumeURL) {
            setUploadedResumeUrl(record.resumeUrl || record.resumeURL);
          }

          setAutofillNotice(`⚡ Profile verified & auto-loaded from Resume Dump!`);
        } else {
          setFoundDumpCandidate(null);
        }
      } catch (err) {
        console.error("Resume dump candidate lookup error:", err);
        setFoundDumpCandidate(null);
      } finally {
        setIsSearchingResumeDump(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [email, phone, interviewData]);

  useEffect(() => {
    setErrorMsg(initialError);
  }, [initialError]);

  const getProfileMismatches = (): string[] => {
    if (!interviewData) return [];
    const mismatches: string[] = [];

    const rawReqG = (interviewData.genderRequirement || (interviewData as any).gender || '').toString().trim().toLowerCase();
    const isReqFemale = rawReqG.includes('female');
    const isReqMale = !isReqFemale && (rawReqG.includes('male') || rawReqG === 'm' || rawReqG.includes('man'));
    const isReqAny = !rawReqG || ['any', 'both', 'all', 'open', 'no preference', 'nopreference', 'none'].some(k => rawReqG.includes(k));

    if (!isReqAny && (isReqFemale || isReqMale)) {
      const rawCandG = (gender || '').trim().toLowerCase();
      const isCandFilled = rawCandG && !['unspecified', 'unknown', 'not specified', 'select', 'any', 'other', 'none', ''].includes(rawCandG);

      if (isCandFilled) {
        const isCandFemale = rawCandG.includes('female') || rawCandG === 'f' || rawCandG.includes('woman');
        const isCandMale = !isCandFemale && (rawCandG.includes('male') || rawCandG === 'm' || rawCandG.includes('man'));

        if (isReqFemale && !isCandFemale) {
          mismatches.push(`Gender Mismatch: Role prefers Female candidates (Your selection: ${gender})`);
        } else if (isReqMale && !isCandMale) {
          mismatches.push(`Gender Mismatch: Role prefers Male candidates (Your selection: ${gender})`);
        }
      }
    }

    const reqLoc = ((interviewData as any).location || (interviewData as any).jobLocation || (interviewData as any).city || '').toString().trim();
    if (reqLoc && currentCity.trim()) {
      if (!isLocationMatching(reqLoc, currentCity.trim())) {
        mismatches.push(`Location Mismatch: Preferred job location is ${reqLoc} (Your city: ${currentCity})`);
      }
    }

    const reqExpText = ((interviewData as any).experienceRequired || (interviewData as any).minExperience || (interviewData as any).experience || '').toString();
    const reqExpMinMatch = reqExpText.match(/(\d+)/);
    const hasEnteredExp = isFresher || totalExperienceYears.trim() !== '';
    if (reqExpMinMatch && hasEnteredExp) {
      const minYears = parseFloat(reqExpMinMatch[1]);
      const candExp = isFresher ? 0 : (parseFloat(totalExperienceYears) || 0);
      if (candExp < minYears) {
        mismatches.push(`Experience Mismatch: Role requires minimum ${minYears} year(s) experience (You specified: ${candExp} year(s))`);
      }
    }

    const reqEdu = ((interviewData as any).education || (interviewData as any).qualification || '').toString().trim();
    if (reqEdu && qualificationBasic.trim()) {
      if (!isEducationMatching(qualificationBasic, reqEdu)) {
        mismatches.push(`Education Mismatch: Preferred qualification is ${reqEdu} (Your qualification: ${qualificationBasic})`);
      }
    }

    return mismatches;
  };

  const handleDirectStart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const activeEmail = (email || foundDumpCandidate?.email || '').trim().toLowerCase();
    const activePhone = (phone || foundDumpCandidate?.phone || '').trim();
    const activeName = (name || foundDumpCandidate?.name || (activeEmail ? activeEmail.split('@')[0] : 'Candidate')).trim();

    if (!activeEmail && !activePhone) {
      setErrorMsg("Please enter your registered Email Address or Mobile Number.");
      return;
    }

    if (!foundDumpCandidate) {
      if (!activeName) {
        setErrorMsg("Please enter your Full Name to continue.");
        return;
      }
      if (!resumeFile && !uploadedResumeUrl && !existingResumeUrl) {
        setErrorMsg("Please upload your resume to continue.");
        return;
      }
    }

    setErrorMsg(null);

    const candResumeUrl = uploadedResumeUrl || foundDumpCandidate?.resumeUrl || foundDumpCandidate?.resumeURL || existingResumeUrl;
    const detectedMismatches = getProfileMismatches();

    let calculatedAge = '25';
    if (dob) {
      const today = new Date();
      const birthDate = new Date(dob);
      let ageNum = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        ageNum--;
      }
      calculatedAge = ageNum.toString();
    }

    const finalCandInfo: CandidateInfo = {
      name: activeName,
      email: activeEmail,
      phone: activePhone,
      gender: gender || foundDumpCandidate?.gender || 'Unspecified',
      dob: dob || foundDumpCandidate?.dob || '2000-01-01',
      age: calculatedAge,
      maritalStatus: maritalStatus || foundDumpCandidate?.maritalStatus || 'Single',
      currentCity: currentCity || foundDumpCandidate?.location || foundDumpCandidate?.city || foundDumpCandidate?.currentCity || '',
      nativePlace: nativePlace || foundDumpCandidate?.nativePlace || currentCity || '',
      qualificationBasic: qualificationBasic || extractCandidateEdu(foundDumpCandidate) || '',
      qualificationPG: qualificationPG || '',
      totalExperienceYears: totalExperienceYears || (foundDumpCandidate?.totalExperienceYears !== undefined ? String(foundDumpCandidate.totalExperienceYears) : (foundDumpCandidate?.experience !== undefined ? String(foundDumpCandidate.experience) : (isFresher ? '0' : ''))),
      totalExperienceMonths: totalExperienceMonths || '0',
      currentCompanyName: currentCompanyName || foundDumpCandidate?.currentCompanyName || foundDumpCandidate?.currentCompany || '',
      designation: designation || foundDumpCandidate?.designation || foundDumpCandidate?.currentTitle || '',
      currentSalary: currentSalary || foundDumpCandidate?.currentSalary || '',
      noticePeriodDays: noticePeriodDays || foundDumpCandidate?.noticePeriodDays || '0',
      reasonForJobChange: reasonForJobChange || 'Career Growth',
      resumeUpdated: 'yes',
      highlightedSkillsForJob: highlightedSkillsForJob || (foundDumpCandidate?.skills ? (Array.isArray(foundDumpCandidate.skills) ? foundDumpCandidate.skills.join(', ') : foundDumpCandidate.skills) : ''),
      isFresher: isFresher || (totalExperienceYears === '0'),
      language,
      criteriaMismatches: detectedMismatches
    };

    onSubmit(finalCandInfo, resumeFile, candResumeUrl, candResumeUrl);
  };

  const candidateDisplayName = name || foundDumpCandidate?.name || (email ? email.split('@')[0] : 'Candidate');
  const candidateDisplayExp = (foundDumpCandidate?.totalExperienceYears !== undefined || foundDumpCandidate?.experience !== undefined || totalExperienceYears)
    ? `${foundDumpCandidate?.totalExperienceYears ?? foundDumpCandidate?.experience ?? totalExperienceYears} Years`
    : (isFresher ? 'Fresher (0 Years)' : 'Not Specified');
  const candidateRoleInfo = designation || foundDumpCandidate?.designation || foundDumpCandidate?.currentTitle || '';
  const candidateCompanyInfo = currentCompanyName || foundDumpCandidate?.currentCompanyName || foundDumpCandidate?.currentCompany || '';
  const candidateEdu = qualificationBasic || extractCandidateEdu(foundDumpCandidate) || '';
  const hasResumeLoaded = Boolean(resumeFile || uploadedResumeUrl || existingResumeUrl || foundDumpCandidate?.resumeUrl || foundDumpCandidate?.resumeURL);

  return (
    <div className="candidate-form-shell w-full max-w-xl mx-auto rounded-3xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] p-6 sm:p-8 md:p-10 shadow-2xl relative transition-all duration-300 font-sans">
      {/* Duplicate Attempt Modal */}
      {showDuplicatePopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[11000] p-4">
          <div className="bg-white dark:bg-[#15161A] rounded-3xl p-6 md:p-8 max-w-sm w-full border border-[#E4E7DC] dark:border-white/10 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4 mx-auto border border-red-500/20">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-xl font-black text-[#111215] dark:text-[#F8F9F5] mb-2">Attempt Blocked</h3>
            <p className="text-xs text-[#575A51] dark:text-neutral-400 leading-relaxed mb-6">
              You have already completed this video interview. Only one attempt is permitted.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowDuplicatePopup(false);
                onBackToWelcome();
              }}
              className="w-full py-3.5 bg-[#111215] dark:bg-white text-white dark:text-black font-bold rounded-full shadow-lg active:scale-98 transition-all cursor-pointer"
            >
              Back to Overview
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6 space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#D4F82C] text-[#111215] border border-[#8FB305]/30 tracking-wide uppercase shadow-sm">
          <Video size={13} className="text-[#111215]" />
          <span>{jobTitle || 'AI Video Pre-Screening'}</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-[#F8F9F5] tracking-tight">
          Candidate Verification
        </h2>
        <p className="text-xs sm:text-sm font-medium text-[#575A51] dark:text-neutral-400 max-w-md mx-auto">
          Enter your registered email address or mobile number to load your profile and begin your interview.
        </p>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary Verification Inputs: Email & Mobile */}
      <form onSubmit={handleDirectStart} className="space-y-4">
        <div className="p-4 sm:p-5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24]/60 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold tracking-wider text-[#73766C] dark:text-neutral-400">
              Verify Candidate Credentials
            </span>
            {isSearchingResumeDump && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#8FB305] dark:text-[#D4F82C] font-bold animate-pulse">
                <Sparkles size={12} className="animate-spin" />
                <span>Checking Talent Cloud...</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#575A51] dark:text-neutral-400 mb-1 flex items-center gap-1">
                <Mail size={12} />
                <span>Registered Email</span>
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#8FB305] transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#575A51] dark:text-neutral-400 mb-1 flex items-center gap-1">
                <Phone size={12} />
                <span>Mobile Number</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] text-[#111215] dark:text-[#F8F9F5] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#8FB305] transition-all"
              />
            </div>
          </div>

          <p className="text-[10px] text-[#73766C] dark:text-neutral-400 leading-tight">
            ⚡ If you received an invite link, your email or mobile is matched with our database to auto-load your profile.
          </p>
        </div>

        {/* 1. IF PRESENT IN RESUME DUMP: LOAD PROFILE FROM THERE */}
        {foundDumpCandidate ? (
          <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] dark:bg-emerald-500/[0.08] space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <ShieldCheck size={13} />
                <span>Profile Loaded from Resume Dump</span>
              </span>
              <div className="flex items-center gap-2">
                {(uploadedResumeUrl || foundDumpCandidate.resumeUrl || foundDumpCandidate.resumeURL) && (
                  <button
                    type="button"
                    onClick={() => setPreviewModalUrl(uploadedResumeUrl || foundDumpCandidate.resumeUrl || foundDumpCandidate.resumeURL)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Eye size={12} />
                    <span>View Stored Resume</span>
                  </button>
                )}
                <label
                  htmlFor="resume-update-optional"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#575A51] dark:text-neutral-400 hover:text-[#111215] dark:hover:text-[#F8F9F5] cursor-pointer"
                >
                  <RefreshCw size={11} />
                  <span>{resumeFile ? `Updated: ${resumeFile.name}` : 'Update Resume'}</span>
                </label>
                <input
                  id="resume-update-optional"
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleResumeFileChange(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] flex items-center justify-center font-black text-lg shadow-md shrink-0">
                {candidateDisplayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-[#111215] dark:text-[#F8F9F5] truncate">
                  {candidateDisplayName}
                </h3>
                <p className="text-xs text-[#575A51] dark:text-neutral-400 truncate">
                  {email || foundDumpCandidate.email || 'Email on file'} {phone || foundDumpCandidate.phone ? `• ${phone || foundDumpCandidate.phone}` : ''}
                </p>
              </div>
            </div>

            {/* Bento Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-emerald-500/20">
                <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 block mb-0.5">Experience</span>
                <span className="font-bold text-[#111215] dark:text-[#F8F9F5] truncate block">
                  {candidateDisplayExp}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-emerald-500/20">
                <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 block mb-0.5">Role / Company</span>
                <span className="font-bold text-[#111215] dark:text-[#F8F9F5] truncate block">
                  {candidateRoleInfo ? `${candidateRoleInfo}${candidateCompanyInfo ? ` @ ${candidateCompanyInfo}` : ''}` : 'Ready for Evaluation'}
                </span>
              </div>

              {candidateEdu && (
                <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-emerald-500/20">
                  <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 block mb-0.5">Highest Qualification</span>
                  <span className="font-bold text-[#111215] dark:text-[#F8F9F5] truncate block">
                    {typeof candidateEdu === 'string' ? candidateEdu : formatCandidateEducationString(candidateEdu)}
                  </span>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-emerald-500/20">
                <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 block mb-0.5">Resume Status</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1">
                  <Check size={12} />
                  <span>{resumeFile ? 'New Resume Attached' : 'Loaded from Resume Dump'}</span>
                </span>
              </div>
            </div>

            {/* DIRECT START AI INTERVIEW BUTTON */}
            <button
              type="button"
              onClick={handleDirectStart}
              className="w-full py-4 px-6 rounded-full font-black text-sm sm:text-base bg-[#D4F82C] text-[#111215] hover:bg-[#c7eb22] shadow-xl shadow-[#D4F82C]/25 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer mt-2"
            >
              <Video size={18} />
              <span>Direct Start AI Video Interview</span>
              <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          /* 2. ELSE: NOT IN RESUME DUMP -> GIVE OPTION TO ADD RESUME */
          <div className="space-y-3.5 animate-in fade-in duration-300">
            {(email.trim() || phone.trim()) && !isSearchingResumeDump && (
              <div className="p-3.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-bold">Not Found in Resume Dump</p>
                  <p className="text-[11px] opacity-85 mt-0.5">
                    We could not find an existing profile with this email or mobile. Please add your resume below to continue.
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 sm:p-5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] space-y-3.5 shadow-sm">
              <div>
                <label className="text-[11px] font-bold text-[#575A51] dark:text-neutral-400 mb-1 flex items-center gap-1">
                  <User size={12} />
                  <span>Full Name <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-[#1D1F24] text-[#111215] dark:text-[#F8F9F5] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#8FB305] transition-all"
                />
              </div>

              {/* Option to Add Resume */}
              <div>
                <label className="text-[11px] font-bold text-[#575A51] dark:text-neutral-400 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <FileText size={12} />
                    <span>Upload Resume <span className="text-red-500">*</span></span>
                  </span>
                  {hasResumeLoaded && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                      <Check size={10} /> Ready for Evaluation
                    </span>
                  )}
                </label>

                <label
                  htmlFor="resume-upload-simple"
                  className={`w-full flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                    resumeFile
                      ? 'border-emerald-500/40 bg-emerald-500/[0.05] text-emerald-700 dark:text-emerald-300'
                      : 'border-[#E4E7DC] dark:border-white/15 bg-[#F8F9F5] dark:bg-[#1D1F24]/50 hover:border-[#8FB305] text-[#575A51] dark:text-neutral-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] flex items-center justify-center shadow-sm">
                    <UploadCloud size={20} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-[#111215] dark:text-[#F8F9F5]">
                      {isParsingResumeFirst
                        ? 'Parsing resume details...'
                        : resumeFile
                        ? `✓ ${resumeFile.name}`
                        : 'Click to Add Resume or Drag & Drop'}
                    </p>
                    <p className="text-[10px] text-[#73766C] dark:text-neutral-400 mt-0.5">
                      PDF, DOCX or TXT (Max 10MB) • Details will auto-extract
                    </p>
                  </div>
                </label>
                <input
                  id="resume-upload-simple"
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleResumeFileChange(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {autofillNotice && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>{autofillNotice}</span>
                </p>
              )}
            </div>

            {/* Standard Start Button */}
            <button
              type="submit"
              className="w-full py-4 px-6 rounded-full font-black text-sm bg-[#111215] hover:bg-[#202227] text-white dark:bg-[#D4F82C] dark:text-[#111215] dark:hover:bg-[#c7eb22] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Video size={16} />
              <span>Proceed to AI Video Interview</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </form>

      {/* Resume Document Preview Popup Modal */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#15161A] w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#E4E7DC] dark:border-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-[#15161A] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215] flex items-center justify-center text-sm font-bold shadow-sm">
                  <FileText size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#111215] dark:text-[#F8F9F5]">Resume Document Preview</h3>
                  <p className="text-[11px] font-medium text-[#575A51] dark:text-neutral-400">{name || email || 'Candidate Resume'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewModalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-full bg-[#F8F9F5] dark:bg-white/5 text-[#111215] dark:text-[#F8F9F5] hover:bg-[#E4E7DC] text-xs font-bold transition-all flex items-center gap-1.5 border border-[#E4E7DC] dark:border-white/10"
                >
                  <ExternalLink size={12} />
                  <span>Open in Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalUrl(null)}
                  className="w-8 h-8 rounded-full border border-[#E4E7DC] dark:border-white/10 text-[#575A51] dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-neutral-100 dark:bg-black/50 relative overflow-hidden">
              <iframe
                src={previewModalUrl.includes('google.com') || previewModalUrl.endsWith('.doc') || previewModalUrl.endsWith('.docx')
                  ? `https://docs.google.com/gview?url=${encodeURIComponent(previewModalUrl)}&embedded=true`
                  : previewModalUrl}
                title="Resume Preview Modal"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// --- Component: Virtual Avatar Instructions ---


const InterviewReadinessOnboarding: React.FC<{
  interview: Interview;
  state: InterviewState;
  onStart: () => void;
}> = ({ interview, state, onStart }) => {
  type NetworkState = {
    online: boolean;
    downlink: number | null;
    effectiveType: string | null;
    rtt: number | null;
    latency: number | null;
    quality: 'checking' | 'strong' | 'fair' | 'weak' | 'danger' | 'offline';
    message: string;
  };

  const micPrompt = 'My microphone is clear and I am ready to begin this AI interview.';
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const speechTimeoutRef = useRef<number | null>(null);
  const micStageArmedRef = useRef(false);
  const [activeStage, setActiveStage] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const [networkState, setNetworkState] = useState<NetworkState>({
    online: navigator.onLine,
    downlink: null,
    effectiveType: null,
    rtt: null,
    latency: null,
    quality: navigator.onLine ? 'checking' : 'offline',
    message: navigator.onLine ? 'Checking your connection...' : 'You are offline.',
  });

  const stages = [
    {
      title: 'Check your camera',
      speech: [
        'First, let us check your camera.',
        'Keep your face inside the frame, sit straight, and look at the camera.',
      ],
    },
    {
      title: 'Check your microphone',
      speech: [
        'Now let us check your microphone.',
        'Please read the line on screen so I can confirm your microphone is working.',
      ],
    },
    {
      title: 'Check your internet',
      speech: [
        'Now I am checking your internet connection.',
        'If the connection is weak you can still continue.',
      ],
    },
    {
      title: 'Before you start',
      speech: [
        `Your AI interview for ${interview.title} is ready.`,
        'Answer clearly, stay in fullscreen, and speak one answer at a time.',
      ],
    },
  ] as const;

  const summaryPoints = [
    `Role: ${interview.title}`,
    `${state.questions.length} question${state.questions.length === 1 ? '' : 's'} will be asked.`,
    'Each answer gets 2 minutes.',
    'Stay focused and speak clearly.',
  ];

  const stopPreview = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (speechTimeoutRef.current !== null) {
      window.clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }

    speak.stop();

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    analyserRef.current = null;

    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(track => track.stop());
      previewStreamRef.current = null;
    }
  };

  const measureNetwork = async () => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const effectiveType = typeof connection?.effectiveType === 'string' ? connection.effectiveType : null;
    const rtt = typeof connection?.rtt === 'number' ? connection.rtt : null;

    if (!navigator.onLine) {
      setNetworkState({
        online: false,
        downlink: null,
        effectiveType,
        rtt,
        latency: null,
        quality: 'offline',
        message: 'You are offline. Please check your internet connection.',
      });
      return;
    }

    setNetworkState(prev => ({
      ...prev,
      online: true,
      effectiveType,
      rtt,
      quality: 'checking',
      message: 'Testing your internet speed...',
    }));

    try {
      const start = performance.now();
      // Using a slightly larger image (approx ~20KB) to test speed more accurately.
      // 20KB = 160Kb. To get 2Mbps (2000Kbps), it should download in less than 80ms.
      const response = await fetch(`https://res.cloudinary.com/demo/image/upload/w_400/sample.jpg?cacheBust=${Date.now()}`);
      if (!response.ok) throw new Error(`Network test returned HTTP ${response.status}`);
      
      const blob = await response.blob();
      const end = performance.now();
      const durationSec = (end - start) / 1000;
      
      const fileSizeBits = blob.size * 8;
      let calculatedMbps = (fileSizeBits / durationSec) / 1000000;
      
      // Fallback to navigator.connection if download was instant (cache hit etc)
      if (durationSec < 0.05 && connection?.downlink) {
          calculatedMbps = connection.downlink;
      }

      let quality: NetworkState['quality'] = 'strong';
      let message = 'Connection is strong and ready.';

      if (calculatedMbps < 2) {
        quality = 'weak';
        message = 'Connection is weak (below 2Mbps), but you can still proceed.';
      } else if (calculatedMbps < 5) {
        quality = 'fair';
        message = 'Connection is fair (above 2Mbps). You can proceed.';
      }

      setNetworkState({
        online: true,
        downlink: parseFloat(calculatedMbps.toFixed(2)),
        effectiveType,
        rtt,
        latency: Math.round(end - start),
        quality,
        message,
      });
    } catch (error) {
      console.error("Network speed test failed:", error);
      // If the fetch fails entirely, assume offline or very bad connection
      setNetworkState({
        online: false,
        downlink: null,
        effectiveType,
        rtt,
        latency: null,
        quality: 'weak',
        message: 'Could not measure speed accurately, but you can still proceed.',
      });
    }
  };

  const playStageAudio = () => {
    if (speechTimeoutRef.current !== null) {
      window.clearTimeout(speechTimeoutRef.current);
    }

    unlockTTSAudio();
    speak.stop();
    setIsSpeaking(true);

    const langMap: Record<string, string> = { en: 'en', hi: 'hi-IN', mr: 'mr-IN' };
    const ttsLang = langMap[state.language] || 'en';
    const stageText = stages[activeStage].speech.join(' ');

    speechTimeoutRef.current = window.setTimeout(() => {
      speak(stageText, {
        lang: ttsLang,
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }, 800);
  };

  useEffect(() => {
    let isCancelled = false;

    const setupPreview = async () => {
      setPermissionError(null);
      setCameraReady(false);
      setMicReady(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setPermissionError('This browser does not support camera/microphone access. Please use Chrome/Safari or check your phone settings.');
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 960 },
            height: { ideal: 540 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err1) {
        console.warn('Ideal media setup failed, trying basic video+audio:', err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err2) {
          console.warn('Video+Audio setup failed, trying audio-only fallback:', err2);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (err3) {
            console.error('All media setup fallbacks failed:', err3);
            if (!isCancelled) {
              setPermissionError('Microphone and camera access is required. Please check your browser/phone permissions and retry.');
            }
            return;
          }
        }
      }

      if (!stream || isCancelled) {
        if (stream) stream.getTracks().forEach(track => track.stop());
        return;
      }

      previewStreamRef.current = stream;
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      setCameraReady(hasVideo);
      setMicReady(hasAudio);

      if (previewVideoRef.current && hasVideo) {
        previewVideoRef.current.srcObject = stream;
        await previewVideoRef.current.play().catch(() => undefined);
      }

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor && hasAudio) {
        try {
          const audioContext = new AudioContextCtor();
          if (audioContext.state === 'suspended') {
            await audioContext.resume().catch(() => undefined);
          }

          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);

          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          const data = new Uint8Array(analyser.frequencyBinCount);

          // Auto-pass mic check after 1.5s if mic track is active and live
          const autoPassTimer = setTimeout(() => {
            if (hasAudio && stream!.getAudioTracks().some(t => t.readyState === 'live' && t.enabled)) {
              setVoiceDetected(true);
            }
          }, 1500);

          const animateLevel = () => {
            if (!analyserRef.current) return;

            // Resume audioContext if browser suspended it
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
              audioContextRef.current.resume().catch(() => undefined);
            }

            analyserRef.current.getByteTimeDomainData(data);
            let sum = 0;

            for (let i = 0; i < data.length; i++) {
              const normalized = (data[i] - 128) / 128;
              sum += normalized * normalized;
            }

            const rms = Math.sqrt(sum / data.length);
            const level = Math.min(1, rms * 8.0);
            setMicLevel(level);

            if (level > 0.03) {
              setVoiceDetected(true);
              clearTimeout(autoPassTimer);
            }

            frameRef.current = requestAnimationFrame(animateLevel);
          };

          animateLevel();
        } catch (audioErr) {
          console.warn('AudioContext creation error:', audioErr);
          if (hasAudio) setVoiceDetected(true);
        }
      } else if (hasAudio) {
        setVoiceDetected(true);
      }
    };

    setupPreview();
    measureNetwork();

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const handleConnectivityChange = () => {
      measureNetwork();
    };

    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);
    if (connection?.addEventListener) {
      connection.addEventListener('change', handleConnectivityChange);
    }

    return () => {
      isCancelled = true;
      window.removeEventListener('online', handleConnectivityChange);
      window.removeEventListener('offline', handleConnectivityChange);
      if (connection?.removeEventListener) {
        connection.removeEventListener('change', handleConnectivityChange);
      }
      stopPreview();
    };
  }, []);

  useEffect(() => {
    playStageAudio();

    return () => {
      if (speechTimeoutRef.current !== null) {
        window.clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
      speak.stop();
      setIsSpeaking(false);
    };
  }, [activeStage, state.language, interview.title, state.questions.length]);

  useEffect(() => {
    if (activeStage === 1) {
      setVoiceDetected(false);
      micStageArmedRef.current = false;
      const timer = window.setTimeout(() => {
        micStageArmedRef.current = true;
      }, 300);

      return () => {
        window.clearTimeout(timer);
        micStageArmedRef.current = false;
      };
    }

    if (activeStage === 2) {
      measureNetwork();
    }

    micStageArmedRef.current = false;
  }, [activeStage]);

  const canContinue = [
    cameraReady,
    micReady && voiceDetected,
    networkState.online && networkState.quality !== 'checking',
    cameraReady && micReady && networkState.online,
  ][activeStage];

  const waveformBars = Array.from({ length: 14 }, (_, index) => {
    const bias = 0.5 + ((index % 4) * 0.12);
    const height = Math.max(16, Math.min(96, (micLevel * 96 * bias) + 12));
    return `${height}%`;
  });

  const nextStage = () => setActiveStage(prev => Math.min(prev + 1, stages.length - 1));
  const previousStage = () => setActiveStage(prev => Math.max(prev - 1, 0));

  const handleStart = () => {
    stopPreview();
    onStart();
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#16171C] border border-[#E4E7DC] dark:border-white/10 shadow-xl space-y-6 animate-in fade-in duration-500">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E7DC] dark:border-white/10 pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111215] text-[#D4F82C] text-[11px] font-black uppercase tracking-wider shadow-sm">
            <Briefcase size={12} className="text-[#D4F82C]" />
            <span>Role: {interview.title}</span>
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#111215] dark:text-white mt-2 tracking-tight">
            {stages[activeStage].title}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={playStageAudio}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs font-bold text-[#111215] dark:text-white hover:bg-[#E4E7DC]/60 transition-all cursor-pointer shadow-sm"
          >
            <Volume2 size={13} className={isSpeaking ? 'text-[#8FB305] animate-pulse' : 'text-[#73766C]'} />
            <span>{isSpeaking ? 'Reading...' : 'Replay Voice'}</span>
          </button>
          <span className="text-xs font-black text-[#73766C] dark:text-neutral-400 bg-[#F8F9F5] dark:bg-white/5 px-3 py-1 rounded-full border border-[#E4E7DC] dark:border-white/10">
            {activeStage + 1} / {stages.length}
          </span>
        </div>
      </div>

      {/* Progress Pill Track */}
      <div className="flex items-center gap-2">
        {stages.map((stage, index) => (
          <span
            key={stage.title}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === activeStage 
                ? 'w-10 bg-[#111215] dark:bg-[#D4F82C]' 
                : index < activeStage 
                  ? 'w-6 bg-[#111215]/50 dark:bg-[#D4F82C]/50' 
                  : 'w-3 bg-[#E4E7DC] dark:bg-white/15'
            }`}
          ></span>
        ))}
      </div>

      {/* Stage 0: Camera Check */}
      {activeStage === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/10">
          <div className="relative rounded-2xl overflow-hidden bg-[#111215] aspect-video sm:aspect-square flex items-center justify-center border border-white/10 shadow-inner">
            <video ref={previewVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-2 border-dashed border-[#D4F82C]/40 rounded-2xl pointer-events-none m-4"></div>
          </div>

          <div className="flex flex-col justify-between space-y-4">
            <div>
              <p className="text-sm font-black text-[#111215] dark:text-white mb-2">Camera Alignment</p>
              <p className="text-xs text-[#575A51] dark:text-[#A1A49B] mb-4">Center your face inside the viewfinder and ensure proper room lighting.</p>

              <div className="space-y-2">
                {['Face fully visible in frame', 'Sit upright & comfortable', 'Look directly at the webcam'].map((tip) => (
                  <div key={tip} className="flex items-center gap-2 text-xs font-semibold text-[#111215] dark:text-neutral-300">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              cameraReady 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
            }`}>
              {cameraReady ? <Check size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-rose-500" />}
              <span>{cameraReady ? 'Camera hardware is ready and verified.' : permissionError || 'Camera permission required.'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stage 1: Microphone Check */}
      {activeStage === 1 && (
        <div className="space-y-5 p-5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/10">
          <div className="text-center max-w-md mx-auto">
            <p className="text-sm font-black text-[#111215] dark:text-white mb-1">Microphone Voice Level Test</p>
            <p className="text-xs text-[#575A51] dark:text-[#A1A49B]">Read the sentence below aloud to verify clear audio input.</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#16171C] border border-[#E4E7DC] dark:border-white/10 text-center font-bold text-sm text-[#111215] dark:text-white shadow-sm">
            "{micPrompt}"
          </div>

          {/* Audio Meter */}
          <div className="space-y-2 max-w-md mx-auto">
            <div className="w-full bg-[#E4E7DC] dark:bg-white/10 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-150 ${voiceDetected ? 'bg-[#D4F82C]' : 'bg-[#111215]'}`}
                style={{ width: `${Math.max(8, micLevel * 100)}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-[#73766C] dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <Mic size={12} className={voiceDetected ? 'text-emerald-500' : ''} />
                <span>{voiceDetected ? 'Voice detected' : 'Listening for audio...'}</span>
              </span>
              <span>{Math.round(micLevel * 100)}%</span>
            </div>
          </div>

          <div className={`p-3 rounded-xl text-xs font-bold text-center border max-w-md mx-auto ${
            voiceDetected 
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' 
              : 'bg-[#E4E7DC]/50 dark:bg-white/5 text-[#575A51] dark:text-neutral-300 border-[#E4E7DC] dark:border-white/10'
          }`}>
            {voiceDetected ? 'Microphone is functioning perfectly.' : 'Speak into your microphone to proceed.'}
          </div>
        </div>
      )}

      {/* Stage 2: Network Connectivity */}
      {activeStage === 2 && (
        <div className="space-y-5 p-5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/10">
          <div className="text-center max-w-md mx-auto">
            <p className="text-sm font-black text-[#111215] dark:text-white mb-1">Network Stability Check</p>
            <p className="text-xs text-[#575A51] dark:text-[#A1A49B]">Verifying stable latency and bandwidth for video transmission.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#16171C] p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 text-center">
              <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 tracking-wider">Status</span>
              <p className="text-sm font-black text-[#111215] dark:text-white mt-1">
                {networkState.online ? networkState.quality.toUpperCase() : 'OFFLINE'}
              </p>
            </div>
            <div className="bg-white dark:bg-[#16171C] p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 text-center">
              <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 tracking-wider">Speed</span>
              <p className="text-sm font-black text-[#111215] dark:text-white mt-1">
                {networkState.downlink !== null ? `${networkState.downlink} Mbps` : 'N/A'}
              </p>
            </div>
            <div className="bg-white dark:bg-[#16171C] p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 text-center">
              <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 tracking-wider">Latency</span>
              <p className="text-sm font-black text-[#111215] dark:text-white mt-1">
                {networkState.latency !== null ? `${networkState.latency} ms` : 'N/A'}
              </p>
            </div>
            <div className="bg-white dark:bg-[#16171C] p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 text-center">
              <span className="text-[10px] uppercase font-bold text-[#73766C] dark:text-neutral-400 tracking-wider">Type</span>
              <p className="text-sm font-black text-[#111215] dark:text-white mt-1">
                {networkState.effectiveType || 'Broadband'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <span className="text-xs font-semibold text-[#575A51] dark:text-[#A1A49B]">
              {networkState.message}
            </span>
            <button 
              type="button" 
              onClick={measureNetwork}
              className="px-4 py-2 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs font-bold text-[#111215] dark:text-white hover:bg-[#E4E7DC]/60 transition-all cursor-pointer"
            >
              Recheck Speed
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Summary & Ready */}
      {activeStage === 3 && (
        <div className="space-y-4 p-5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/10">
          <p className="text-sm font-black text-[#111215] dark:text-white">All Hardware Checks Verified:</p>
          <div className="space-y-2.5">
            {summaryPoints.map((point) => (
              <div key={point} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#16171C] border border-[#E4E7DC] dark:border-white/10 text-xs font-bold text-[#111215] dark:text-white shadow-xs">
                <CheckCircle2 size={16} className="text-[#8FB305] dark:text-[#D4F82C] shrink-0" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[#E4E7DC] dark:border-white/10">
        <div>
          {activeStage > 0 && (
            <button 
              type="button" 
              onClick={previousStage}
              className="px-5 py-2.5 rounded-full bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs font-bold text-[#111215] dark:text-white hover:bg-[#E4E7DC]/60 transition-all cursor-pointer"
            >
              Back
            </button>
          )}
        </div>

        <div>
          {activeStage < stages.length - 1 ? (
            <button 
              type="button" 
              disabled={!canContinue} 
              onClick={nextStage}
              className="px-7 py-3 rounded-full bg-[#111215] hover:bg-[#202227] text-[#D4F82C] hover:text-white font-black text-xs sm:text-sm shadow-md active:scale-95 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Continue</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button 
              type="button" 
              disabled={!canContinue} 
              onClick={handleStart}
              className="px-8 py-3.5 rounded-full bg-[#111215] hover:bg-[#202227] text-[#D4F82C] hover:text-white font-black text-xs sm:text-sm shadow-lg shadow-black/15 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Start Video Interview</span>
              <Zap size={15} className="fill-[#D4F82C]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Welcome Screen Component with AI Avatar ---
const InterviewWelcomeScreen: React.FC<{
  interview: any;
  onProceed: () => void;
}> = ({ interview, onProceed }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(() => getMuteTTS());

  const toggleMuteVoice = () => {
    const next = !isVoiceMuted;
    setIsVoiceMuted(next);
    setMuteTTS(next);
    if (next) {
      speak.stop();
      setIsSpeaking(false);
    }
  };

  const playWelcomeVoice = () => {
    if (getMuteTTS()) return;
    unlockTTSAudio();
    speak.stop();
    setIsSpeaking(true);
    const welcomeText = `Hello! Welcome to your AI interview for the role of ${interview.title}. I am your AI Recruiter today. Let me explain the hiring process. First, you will enter your details and upload your resume. Second, you will review the job description. Third, we will verify your hardware including camera, microphone, and internet. Finally, we will begin the interview where I will ask you questions one by one. Let's get started!`;
    speak(welcomeText, {
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  useEffect(() => {
    // Auto-trigger voice greeting immediately when landing on Welcome screen
    const timeout = setTimeout(() => {
      playWelcomeVoice();
    }, 400);

    // Also auto-trigger on first mouse movement, touch, or click anywhere on screen
    const autoPlayOnInteraction = () => {
      playWelcomeVoice();
      window.removeEventListener('pointerdown', autoPlayOnInteraction);
      window.removeEventListener('pointermove', autoPlayOnInteraction);
      window.removeEventListener('keydown', autoPlayOnInteraction);
    };

    window.addEventListener('pointerdown', autoPlayOnInteraction, { once: true });
    window.addEventListener('pointermove', autoPlayOnInteraction, { once: true });
    window.addEventListener('keydown', autoPlayOnInteraction, { once: true });

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('pointerdown', autoPlayOnInteraction);
      window.removeEventListener('pointermove', autoPlayOnInteraction);
      window.removeEventListener('keydown', autoPlayOnInteraction);
      speak.stop();
    };
  }, [interview.title]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-8 text-center animate-in fade-in slide-in-from-bottom-6 duration-500 font-sans">
      {/* Hologram AI Recruiter Bento Card */}
      <div className="mb-8 max-w-md mx-auto bg-[#111215] text-white rounded-3xl p-6 sm:p-7 border border-[#23262F] shadow-2xl shadow-black/20 relative overflow-hidden flex flex-col items-center justify-center">
        <style>{`
          @keyframes soundbar {
            0%, 100% { height: 25%; }
            50% { height: 100%; }
          }
        `}</style>
        
        {/* Ambient neon lime aura */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,248,44,0.14)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[#D4F82C]/10 blur-2xl pointer-events-none" />

        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center mb-1">
          {/* Orbiting dashed rings */}
          <div className={`absolute inset-0 rounded-full border border-dashed border-[#D4F82C]/40 ${isSpeaking ? 'animate-spin' : 'animate-[spin_20s_linear_infinite]'} opacity-70`} />
          <div className={`absolute inset-2.5 rounded-full border border-[#D4F82C]/20 bg-[#D4F82C]/5 transition-all duration-700 ${
            isSpeaking ? 'scale-105 opacity-80 shadow-[0_0_25px_rgba(212,248,44,0.3)]' : 'scale-100 opacity-30 shadow-none'
          }`} />

          <svg className="absolute w-full h-full pointer-events-none z-10" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="welcomeLimeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D4F82C" />
                <stop offset="100%" stopColor="#8FB305" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="33" fill="none" stroke="url(#welcomeLimeGrad)" strokeWidth="1.5" strokeDasharray="6,14" className={`origin-center transition-all ${isSpeaking ? 'animate-[spin_4s_linear_infinite]' : 'animate-[spin_12s_linear_infinite]'}`} />
            <circle cx="50" cy="50" r="28" fill="none" stroke="#D4F82C" strokeWidth="1.5" strokeDasharray="35,25" className={`origin-center transition-all ${isSpeaking ? 'animate-[spin_6s_linear_infinite_reverse] opacity-80' : 'animate-[spin_18s_linear_infinite_reverse] opacity-40'}`} />
          </svg>

          <div className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-[#D4F82C]/70 flex items-center justify-center shadow-[0_0_25px_rgba(212,248,44,0.3)] z-20 transition-all duration-300 ${
            isSpeaking ? 'scale-105 border-[#D4F82C] shadow-[0_0_35px_rgba(212,248,44,0.5)]' : ''
          }`}>
            <img 
              src="/recruiter_avatar.png" 
              alt="AI Recruiter" 
              className={`w-full h-full object-cover transition-transform duration-300 ${isSpeaking ? 'scale-105' : 'scale-100'}`} 
            />
          </div>
        </div>

        {/* Small speech frequency wave bars under avatar */}
        <div className="h-4 flex items-end gap-1 mt-2 z-10">
          {isSpeaking ? (
            <>
              <span className="w-1 bg-[#D4F82C] rounded-full animate-[soundbar_0.8s_ease-in-out_infinite]" style={{ height: '40%' }}></span>
              <span className="w-1 bg-[#D4F82C] rounded-full animate-[soundbar_0.6s_ease-in-out_infinite_0.1s]" style={{ height: '90%' }}></span>
              <span className="w-1 bg-[#A4D804] rounded-full animate-[soundbar_0.7s_ease-in-out_infinite_0.3s]" style={{ height: '60%' }}></span>
              <span className="w-1 bg-[#D4F82C] rounded-full animate-[soundbar_0.5s_ease-in-out_infinite_0.2s]" style={{ height: '100%' }}></span>
              <span className="w-1 bg-[#D4F82C] rounded-full animate-[soundbar_0.9s_ease-in-out_infinite_0.4s]" style={{ height: '40%' }}></span>
            </>
          ) : (
            <div className="flex gap-1">
              <span className="w-1 h-1 bg-white/30 rounded-full"></span>
              <span className="w-1 h-1 bg-white/30 rounded-full"></span>
              <span className="w-1 h-1 bg-white/30 rounded-full"></span>
              <span className="w-1 h-1 bg-white/30 rounded-full"></span>
              <span className="w-1 h-1 bg-white/30 rounded-full"></span>
            </div>
          )}
        </div>

        <div className="mt-3 text-center z-10 flex flex-col items-center">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
            isSpeaking ? 'bg-[#D4F82C] text-[#111215] shadow-xs' : 'bg-white/10 text-[#D4F82C] border border-[#D4F82C]/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-[#111215] animate-ping' : 'bg-[#D4F82C]'}`}></span>
            {isSpeaking ? 'AI Recruiter Speaking' : 'AI Recruiter (Standby)'}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-3.5 z-20">
            <button
              type="button"
              onClick={playWelcomeVoice}
              className="px-4 py-2 rounded-full bg-[#D4F82C] hover:bg-[#c7eb22] text-[#111215] text-xs font-black shadow-md shadow-[#D4F82C]/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Listen to Voice Greeting</span>
            </button>
            <button
              type="button"
              onClick={toggleMuteVoice}
              className={`px-3.5 py-2 rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
                isVoiceMuted
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                  : 'bg-white/10 text-white/90 border-white/15 hover:bg-white/15'
              }`}
              title={isVoiceMuted ? "Unmute AI Voice" : "Mute AI Voice"}
            >
              {isVoiceMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-[#D4F82C]" />}
              <span>{isVoiceMuted ? 'Voice Muted' : 'Mute AI Voice'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-only Start Onboarding CTA */}
      <div className="block md:hidden mb-6">
        <button 
          onClick={() => {
            unlockTTSAudio();
            onProceed();
          }}
          className="w-full max-w-xs px-6 py-3.5 bg-[#111215] hover:bg-black text-white dark:bg-[#D4F82C] dark:hover:bg-[#c7eb22] dark:text-[#111215] font-black rounded-full shadow-lg shadow-black/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
        >
          <span>Start Onboarding</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Greeting and description */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#111215] text-[#D4F82C] border border-[#23262F] text-[11px] font-mono font-bold uppercase tracking-wider mb-3 shadow-2xs">
          <Zap className="w-3 h-3 text-[#D4F82C]" />
          <span>AI Video Pre-Screening</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-[40px] font-black text-[#111215] dark:text-white tracking-tight leading-tight">
          Let's Start Your AI Assessment!
        </h2>
        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[#575A51] dark:text-[#8E9287]">Role:</span>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white dark:bg-[#181A20] border border-[#E4E7DC] dark:border-[#2A2D36] text-[#111215] dark:text-white font-black text-xs sm:text-sm shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#D4F82C]"></span>
            {interview.title}
          </span>
        </div>
      </div>

      {/* Process flow cards (Landing Page Bento 4-Col Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 text-left">
        <div className="bg-white dark:bg-[#181A20] p-5 rounded-3xl border border-[#E4E7DC] dark:border-[#2A2D36] shadow-2xs hover:border-[#D4F82C] dark:hover:border-[#D4F82C] hover:shadow-lg hover:-translate-y-0.5 transition-all group relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#111215] text-[#D4F82C] dark:bg-[#23262F] dark:text-[#D4F82C] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <User className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-black text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider">STEP 01</span>
            </div>
            <h4 className="text-sm font-black text-[#111215] dark:text-white mb-1.5">1. Access Details</h4>
            <p className="text-xs text-[#575A51] dark:text-[#8E9287] leading-relaxed font-medium">Enter your information and upload your resume for the AI to analyze.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#181A20] p-5 rounded-3xl border border-[#E4E7DC] dark:border-[#2A2D36] shadow-2xs hover:border-[#D4F82C] dark:hover:border-[#D4F82C] hover:shadow-lg hover:-translate-y-0.5 transition-all group relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#111215] text-[#D4F82C] dark:bg-[#23262F] dark:text-[#D4F82C] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-black text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider">STEP 02</span>
            </div>
            <h4 className="text-sm font-black text-[#111215] dark:text-white mb-1.5">2. JD & Guidelines</h4>
            <p className="text-xs text-[#575A51] dark:text-[#8E9287] leading-relaxed font-medium">Review job responsibilities and standard rules of the assessment.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#181A20] p-5 rounded-3xl border border-[#E4E7DC] dark:border-[#2A2D36] shadow-2xs hover:border-[#D4F82C] dark:hover:border-[#D4F82C] hover:shadow-lg hover:-translate-y-0.5 transition-all group relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#111215] text-[#D4F82C] dark:bg-[#23262F] dark:text-[#D4F82C] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <Video className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-black text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider">STEP 03</span>
            </div>
            <h4 className="text-sm font-black text-[#111215] dark:text-white mb-1.5">3. System Check</h4>
            <p className="text-xs text-[#575A51] dark:text-[#8E9287] leading-relaxed font-medium">Verify your internet speed, microphone, and camera setup.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#181A20] p-5 rounded-3xl border border-[#E4E7DC] dark:border-[#2A2D36] shadow-2xs hover:border-[#D4F82C] dark:hover:border-[#D4F82C] hover:shadow-lg hover:-translate-y-0.5 transition-all group relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#111215] text-[#D4F82C] dark:bg-[#23262F] dark:text-[#D4F82C] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-black text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider">STEP 04</span>
            </div>
            <h4 className="text-sm font-black text-[#111215] dark:text-white mb-1.5">4. Interview Session</h4>
            <p className="text-xs text-[#575A51] dark:text-[#8E9287] leading-relaxed font-medium">Face our interactive AI, answer questions, and submit your responses.</p>
          </div>
        </div>
      </div>

      {/* Enhanced Job Details & Highlights Box (Landing Page Bento Card) */}
      <div className="bg-white dark:bg-[#181A20] rounded-3xl border border-[#E4E7DC] dark:border-[#2A2D36] p-6 sm:p-7 mb-8 text-left shadow-sm relative overflow-hidden">
        {/* Subtle decorative lime accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4F82C] to-transparent opacity-80" />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-5 border-b border-[#E4E7DC] dark:border-[#2A2D36]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center text-sm shadow-2xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-[#111215] dark:text-white uppercase tracking-wider">
                Job Overview & Highlights
              </h4>
              <p className="text-xs text-[#73766C] dark:text-[#8E9287] font-medium">
                Key role specifications and assessment details
              </p>
            </div>
          </div>

          <span className="px-3.5 py-1 rounded-full bg-[#D4F82C] text-[#111215] text-xs font-black flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#111215] animate-pulse"></span>
            Actively Hiring
          </span>
        </div>

        {/* Key Job Specifications Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          {/* Salary / CTC */}
          <div className="bg-[#F8F9F5] dark:bg-[#111215]/60 p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-[#2A2D36]/80 flex flex-col justify-between">
            <div className="text-[10px] font-mono font-bold text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider flex items-center gap-1">
              <IndianRupee className="w-3 h-3 text-[#111215] dark:text-[#D4F82C]" /> CTC
            </div>
            <div className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1.5 truncate">
              {(interview as any).salary 
                ? (typeof (interview as any).salary === 'number' ? `₹${((interview as any).salary / 100000).toFixed(1)} LPA` : (interview as any).salary)
                : ((interview as any).salaryRange || (interview as any).ctc || '₹3.5 - 6.0 LPA')}
            </div>
          </div>

          {/* Location */}
          <div className="bg-[#F8F9F5] dark:bg-[#111215]/60 p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-[#2A2D36]/80 flex flex-col justify-between">
            <div className="text-[10px] font-mono font-bold text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#111215] dark:text-[#D4F82C]" /> Location
            </div>
            <div className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1.5 truncate">
              {(interview as any).location || (interview as any).jobLocation || (interview as any).city || 'Pune / On-Site'}
            </div>
          </div>

          {/* Experience */}
          <div className="bg-[#F8F9F5] dark:bg-[#111215]/60 p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-[#2A2D36]/80 flex flex-col justify-between">
            <div className="text-[10px] font-mono font-bold text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider flex items-center gap-1">
              <GraduationCap className="w-3 h-3 text-[#111215] dark:text-[#D4F82C]" /> Experience
            </div>
            <div className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1.5 truncate">
              {(interview as any).experienceRequired || (interview as any).experienceLevel || (interview as any).minExperience || (interview as any).experience || '0 - 2 Years'}
            </div>
          </div>

          {/* Job Type */}
          <div className="bg-[#F8F9F5] dark:bg-[#111215]/60 p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-[#2A2D36]/80 flex flex-col justify-between">
            <div className="text-[10px] font-mono font-bold text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#111215] dark:text-[#D4F82C]" /> Job Type
            </div>
            <div className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1.5 truncate">
              {(interview as any).employmentType || (interview as any).jobType || 'Full-Time'}
            </div>
          </div>

          {/* Assessment Duration */}
          <div className="bg-[#F8F9F5] dark:bg-[#111215]/60 p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-[#2A2D36]/80 flex flex-col justify-between">
            <div className="text-[10px] font-mono font-bold text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3 h-3 text-[#111215] dark:text-[#D4F82C]" /> Duration
            </div>
            <div className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1.5 truncate">
              {interview.duration || 15} Mins
            </div>
          </div>

          {/* Difficulty */}
          <div className="bg-[#F8F9F5] dark:bg-[#111215]/60 p-3.5 rounded-2xl border border-[#E4E7DC] dark:border-[#2A2D36]/80 flex flex-col justify-between">
            <div className="text-[10px] font-mono font-bold text-[#73766C] dark:text-[#8E9287] uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#111215] dark:text-[#D4F82C]" /> Difficulty
            </div>
            <div className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1.5 truncate">
              {interview.difficulty || 'Medium'}
            </div>
          </div>
        </div>

        {/* Role Overview Description Text */}
        {interview.description && (
          <div className="bg-[#F8F9F5] dark:bg-[#111215]/60 p-4 sm:p-5 rounded-2xl border border-[#E4E7DC] dark:border-[#2A2D36]/80">
            <h5 className="text-[11px] font-black text-[#111215] dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-[#8FB305]" /> Role Description Summary
            </h5>
            <FormattedJobDescription description={interview.description} maxLines={4} className="text-xs text-[#575A51] dark:text-[#8E9287] leading-relaxed" />
          </div>
        )}
      </div>

      {/* Primary CTA Button */}
      <button 
        onClick={() => {
          unlockTTSAudio();
          onProceed();
        }}
        className="px-8 sm:px-10 py-4 sm:py-4.5 rounded-full bg-[#111215] hover:bg-black text-white dark:bg-[#D4F82C] dark:hover:bg-[#c7eb22] dark:text-[#111215] font-black text-sm sm:text-base shadow-xl shadow-black/10 dark:shadow-[#D4F82C]/15 active:scale-95 transition-all flex items-center gap-3 mx-auto cursor-pointer group"
      >
        <span>Start Onboarding</span>
        <span className="w-6 h-6 rounded-full bg-[#D4F82C] text-[#111215] dark:bg-[#111215] dark:text-[#D4F82C] flex items-center justify-center font-black text-xs group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </button>
    </div>
  );
};

// --- Access Code Verification Component ---
const AccessCodeVerificationScreen: React.FC<{
  interviewId: string;
  initialToken: string;
  onSuccess: () => void;
}> = ({ interviewId, initialToken, onSuccess }) => {
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Please enter a valid access code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tokenDocRef = doc(db, 'interviewAccessTokens', token.trim());
      const tokenDoc = await getDoc(tokenDocRef);

      if (!tokenDoc.exists()) {
        const interviewDoc = await getDoc(doc(db, 'interviews', interviewId)).catch(() => null);
        const iData = interviewDoc?.data();
        const codeMatches = iData && (
          String(iData.accessCode || '').trim().toLowerCase() === token.trim().toLowerCase() ||
          String(iData.jobNo || '').trim().toLowerCase() === token.trim().toLowerCase()
        );
        if (codeMatches) {
          onSuccess();
          return;
        }
        throw new Error("Invalid or expired access code. Please check the code sent to your email.");
      }

      const tokenData = tokenDoc.data();
      if (tokenData.isUsed) {
        throw new Error("This access code has already been used. Please contact your recruiter.");
      }

      if (tokenData.nextInterviewId !== interviewId) {
        throw new Error("This access code is not valid for this assessment.");
      }

      // Mark token as used
      await updateDoc(tokenDocRef, { isUsed: true, usedAt: serverTimestamp() });
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to verify access code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-6 py-8 bg-white dark:bg-[#181A20] rounded-3xl border border-[#E4E7DC] dark:border-[#2A2D36] shadow-xl text-center animate-in fade-in slide-in-from-bottom-6 duration-500 font-sans">
      <div className="w-14 h-14 rounded-2xl bg-[#111215] text-[#D4F82C] flex items-center justify-center mb-4 mx-auto shadow-sm">
        <Key className="w-6 h-6" />
      </div>

      <h3 className="text-xl font-black text-[#111215] dark:text-white mb-2">Access Code Verification</h3>
      <p className="text-xs text-[#575A51] dark:text-[#8E9287] leading-relaxed mb-6 font-medium">
        This assessment is private. Please enter the unique access code sent to your email to proceed.
      </p>

      {error && (
        <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-2xl text-xs font-semibold leading-relaxed">
          {error}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="text-left">
          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#73766C] dark:text-[#8E9287] mb-1.5">Access Code</label>
          <input 
            type="text" 
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="e.g. token_xyz123"
            className="w-full px-4 py-3 rounded-2xl border border-[#E4E7DC] dark:border-[#2A2D36] bg-[#F8F9F5] dark:bg-[#111215] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4F82C]/50 dark:text-white font-mono"
            disabled={loading}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-3.5 bg-[#111215] hover:bg-black text-white dark:bg-[#D4F82C] dark:hover:bg-[#c7eb22] dark:text-[#111215] font-black rounded-full shadow-lg shadow-black/10 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <i className="fas fa-circle-notch fa-spin text-sm"></i>
              Verifying...
            </>
          ) : (
            <>
              <span>Verify & Proceed</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

// --- Main Wizard Component ---
const CandidateInterviewFlow: React.FC = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { status: liveRateLimitStatus } = useCompanyRateLimits();

  // State
  const [step, setStep] = useState<WizardStep>('validating');
  const [interview, setInterview] = useState<Interview | null>(null);
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo>({ name: '', email: '', phone: '', language: 'en' });
  const [interviewState, setInterviewState] = useState<InterviewState>({
    jobId: '', jobTitle: '', jobDescription: '', candidateResumeURL: null, candidateResumeMimeType: null,
    questions: [], answers: [], videoURLs: [], transcriptIds: [], transcriptTexts: [], currentQuestionIndex: 0,
    language: 'en',
    pendingResponseCount: 0,
  });

  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [tabSwitches, setTabSwitches] = useState(0);
  const [speedStatus, setSpeedStatus] = useState<string | null>(null);
  const [interviewTerminated, setInterviewTerminated] = useState(false);
  const [rateLimitStopMessage, setRateLimitStopMessage] = useState('');
  const interviewLimitReached = isRateLimitReached(liveRateLimitStatus, 'interviews');

  useEffect(() => {
    if (!interviewLimitReached || step === 'finish') return;
    setRateLimitStopMessage(getCandidateRateLimitReachedMessage('interviews'));
  }, [interviewLimitReached, step]);

  // Auto-Persist Current Step to Session Storage on Step Changes
  useEffect(() => {
    if (interviewId && step && step !== 'validating') {
      sessionStorage.setItem(`interview_wizard_step_${interviewId}`, step);
    }
  }, [interviewId, step]);

  // Auto-Persist Candidate Info to Session Storage
  useEffect(() => {
    if (interviewId && candidateInfo && candidateInfo.email) {
      sessionStorage.setItem(`interview_candidate_info_${interviewId}`, JSON.stringify(candidateInfo));
    }
  }, [interviewId, candidateInfo]);

  // Auto-Persist Interview Questions & Current State to Session Storage
  useEffect(() => {
    if (interviewId && interviewState && Array.isArray(interviewState.questions) && interviewState.questions.length > 0) {
      sessionStorage.setItem(`interview_wizard_state_${interviewId}`, JSON.stringify(interviewState));
    }
  }, [interviewId, interviewState]);

  // 1. Validate Access & Fetch Interview Details
  useEffect(() => {
    const validateAndInit = async () => {
      if (!interviewId) {
        setErrorMsg("Interview ID not found in URL.");
        setStep('collect-info'); // Fallback to show error
        return;
      }
      try {
        const resolved = await resolveJobOrInterviewDocument(interviewId);

        if (!resolved || !resolved.data) {
          throw new Error("This interview does not exist or has been closed.");
        }
        
        const interviewData = resolved.data as any;

        const rateLimitStatus = await loadCompanyRateLimitStatus();
        if (isRateLimitReached(rateLimitStatus, 'interviews')) {
          throw new Error(getCandidateRateLimitReachedMessage('interviews'));
        }

        const combinedData = { ...interviewData, isMock: interviewData.isMock || false };

        setInterview(combinedData as Interview);

        // Restore step & state if candidate refreshed the page during setup / interview / collect-info
        const savedStep = sessionStorage.getItem(`interview_wizard_step_${interviewId}`) as WizardStep | null;
        const savedCandidateInfoStr = sessionStorage.getItem(`interview_candidate_info_${interviewId}`);
        const savedInterviewStateStr = sessionStorage.getItem(`interview_wizard_state_${interviewId}`);

        if (savedCandidateInfoStr) {
          try {
            const parsedCand = JSON.parse(savedCandidateInfoStr);
            if (parsedCand && (parsedCand.email || parsedCand.name)) setCandidateInfo(parsedCand);
          } catch (e) {}
        }

        if (savedInterviewStateStr) {
          try {
            const parsedState = JSON.parse(savedInterviewStateStr);
            if (parsedState && Array.isArray(parsedState.questions) && parsedState.questions.length > 0) {
              const restoredQIndex = typeof parsedState.currentQuestionIndex === 'number'
                ? Math.max(0, Math.min(parsedState.currentQuestionIndex, parsedState.questions.length - 1))
                : 0;

              setInterviewState(prev => ({
                ...prev,
                ...parsedState,
                currentQuestionIndex: restoredQIndex,
                jobId: resolved.id,
                jobTitle: combinedData.title || 'Job Interview',
                jobDescription: combinedData.description || '',
                isMock: combinedData.isMock,
                strictness: combinedData.strictness || 'Medium'
              }));
            } else {
              setInterviewState(prev => ({
                ...prev,
                jobId: resolved.id,
                jobTitle: combinedData.title || 'Job Interview',
                jobDescription: combinedData.description || '',
                isMock: combinedData.isMock,
                strictness: combinedData.strictness || 'Medium'
              }));
            }
          } catch (e) {}
        } else {
          setInterviewState(prev => ({
            ...prev,
            jobId: resolved.id,
            jobTitle: combinedData.title || 'Job Interview',
            jobDescription: combinedData.description || '',
            isMock: combinedData.isMock,
            strictness: combinedData.strictness || 'Medium'
          }));
        }

        if (savedStep && savedStep !== 'validating' && savedStep !== 'finish') {
          setStep(savedStep);
        } else if (searchParams.get('email') && !combinedData.requiresToken) {
          setStep('collect-info');
        } else {
          sessionStorage.removeItem(`interview_wizard_step_${interviewId}`);
          setStep('welcome');
        }

      } catch (err: any) { 
        setErrorMsg(err.message); 
        setStep('collect-info'); // Fallback to show error
      }
    };
    validateAndInit();
  }, [interviewId, searchParams]);

  // 2. Handle Candidate Info Submission
  const handleInfoSubmit = async (submittedInfo: CandidateInfo, submittedFile: File | null, existingResumeUrl?: string, cloudinaryUrl?: string) => {
    setCandidateInfo(submittedInfo);

    setStep('setup');
    setLoadingMsg("Processing your information...");

    try {
      setLoadingMsg("Saving your interview consent...");
      await saveCandidateConsent(interviewId!, {
        name: submittedInfo.name,
        email: submittedInfo.email,
      });

      setLoadingMsg("Verifying attempt eligibility...");
      const attemptsRef = collection(db, 'interviews', interviewId!, 'attempts');
      
      let hasAttempted = false;
      let reattemptDocsToConsume: string[] = [];
      try {
        const emailQuery = query(attemptsRef, where('candidateInfo.email', '==', submittedInfo.email));
        const emailSnap = await getDocs(emailQuery);
        const emailReattempts = emailSnap.docs.filter(doc => doc.data().allowReattempt === true);
        
        let phoneReattempts: any[] = [];
        let phoneSnapDocs: any[] = [];
        if (submittedInfo.phone) {
          const phoneQuery = query(attemptsRef, where('candidateInfo.phone', '==', submittedInfo.phone));
          const phoneSnap = await getDocs(phoneQuery);
          phoneSnapDocs = phoneSnap.docs;
          phoneReattempts = phoneSnap.docs.filter(doc => doc.data().allowReattempt === true);
        }

        const totalAttemptsCount = emailSnap.size + phoneSnapDocs.length;
        const totalReattemptsCount = emailReattempts.length + phoneReattempts.length;

        if (totalAttemptsCount > 0) {
          if (totalReattemptsCount > 0) {
            // Collect the doc IDs of the attempts that granted the reattempt permission
            reattemptDocsToConsume = [
              ...emailReattempts.map(d => d.id),
              ...phoneReattempts.map(d => d.id)
            ];
          } else {
            hasAttempted = true;
          }
        }
      } catch (err: any) {
        console.error("Attempt verification failed:", err);
        // Map permission-denied to user-friendly already taken interview message
        if (err.message && (err.message.includes("permission") || err.code === "permission-denied" || err.message.includes("permissions"))) {
          throw new Error("You have already taken this interview. Only one attempt is allowed.");
        }
        throw err;
      }

      if (hasAttempted) {
        throw new Error("You have already taken this interview. Only one attempt is allowed.");
      }

      // Consume the reattempt permissions immediately if any exist
      if (reattemptDocsToConsume.length > 0) {
        setLoadingMsg("Consuming reattempt permission...");
        for (const docId of reattemptDocsToConsume) {
          try {
            await updateDoc(doc(db, 'interviews', interviewId!, 'attempts', docId), {
              allowReattempt: false
            });
          } catch (e) {
            console.error("Failed to consume reattempt on doc", docId, e);
          }
        }
      }

      let base64String = '';
      let resumeMimeType = '';
      let resumeUrlToSave = cloudinaryUrl || existingResumeUrl || '';
      let resumeTextContent = ''; // This will hold the parsed text content of the resume

      if (submittedFile) {
        setLoadingMsg("Parsing your resume...");
        const uploadPromise = cloudinaryUrl
          ? Promise.resolve(cloudinaryUrl)
          : uploadToCloudinary(submittedFile, 'auto').catch((error) => {
              console.error("Resume cloudinary upload failed:", error);
              return null;
            });

        const [{ base64, url }, parsedResumeText, cloudinaryResumeUrl] = await Promise.all([
          getFileAsBase64(submittedFile),
          readResumeText(submittedFile, submittedFile.name),
          uploadPromise,
        ]);

        base64String = base64;
        resumeMimeType = submittedFile.type || 'application/octet-stream';
        resumeTextContent = parsedResumeText;
        resumeUrlToSave = cloudinaryResumeUrl || url;
      } else if (cloudinaryUrl || existingResumeUrl) {
        setLoadingMsg("Fetching uploaded resume for AI...");
        try {
          const remoteResumeUrl = cloudinaryUrl || existingResumeUrl!;
          const res = await fetch(remoteResumeUrl);
          if (!res.ok) throw new Error(`Resume download failed (${res.status})`);
          const blob = await res.blob();
          const [blobBase64, parsedResumeText] = await Promise.all([
            getBlobAsBase64(blob),
            readResumeText(blob, remoteResumeUrl.split('/').pop()?.split('?')[0] || 'resume.pdf')
          ]);

          base64String = blobBase64;
          resumeMimeType = blob.type || 'application/pdf';
          resumeTextContent = parsedResumeText;
          resumeUrlToSave = remoteResumeUrl;
        } catch (error) {
          console.warn("Could not download remote resume, using profile text fallback:", error);
          resumeTextContent = `Candidate: ${submittedInfo.name || 'Candidate'}\nEmail: ${submittedInfo.email}\nPhone: ${submittedInfo.phone}\nExperience: ${submittedInfo.totalExperienceYears || 0} years\nRole: ${submittedInfo.designation || 'Candidate'}\nCompany: ${submittedInfo.currentCompanyName || ''}\nQualification: ${submittedInfo.qualificationBasic || ''}`;
          resumeMimeType = 'text/plain';
          resumeUrlToSave = remoteResumeUrl;
        }
      } else {
        // Fallback when candidate profile is loaded from database without remote PDF
        resumeTextContent = `Candidate: ${submittedInfo.name || 'Candidate'}\nEmail: ${submittedInfo.email}\nPhone: ${submittedInfo.phone}\nExperience: ${submittedInfo.totalExperienceYears || 0} years\nRole: ${submittedInfo.designation || 'Candidate'}\nCompany: ${submittedInfo.currentCompanyName || ''}\nQualification: ${submittedInfo.qualificationBasic || ''}`;
        resumeMimeType = 'text/plain';
      }

      setLoadingMsg("AI is generating tailored questions... (approx 30s)");
      const questionsPromise = generateInterviewQuestions(
        interview!.title,
        interview!.description,
        (!submittedInfo.isFresher && submittedInfo.totalExperienceYears)
          ? `${submittedInfo.totalExperienceYears} years ${submittedInfo.totalExperienceMonths} months`
          : "0 years",
        base64String,
        resumeMimeType,
        submittedInfo.language,
        (interview as any).numQuestions || 5,
        resumeTextContent, // Pass the parsed text to the AI
        {
          name: submittedInfo.name,
          designation: submittedInfo.designation,
          currentCompany: submittedInfo.currentCompanyName,
          qualification: submittedInfo.qualificationBasic,
          totalExperienceYears: submittedInfo.totalExperienceYears,
          totalExperienceMonths: submittedInfo.totalExperienceMonths,
          isFresher: submittedInfo.isFresher,
        }
      );

      const recruiterUID = (interview as any).recruiterUID || 
                           (interview as any).createdByUID || 
                           (interview as any).createdBy?.uid || 
                           (interview as any).userId || 
                           (interview as any).teamId || 
                           'PUBLIC_JOB_SEEKER_POOL';
      const parsedProfilePromise = analyzeResumeText(
        resumeTextContent,
        submittedFile?.name || resumeUrlToSave.split('/').pop()?.split('?')[0] || 'candidate-resume',
        { name: submittedInfo.name, email: submittedInfo.email, phone: submittedInfo.phone }
      );
      const saveToRecruiterLibraryPromise = parsedProfilePromise.then((profile) => {
            const userEnteredSkills = submittedInfo.highlightedSkillsForJob
              ? submittedInfo.highlightedSkillsForJob.split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];
            const mergedSkills = Array.from(new Set([...(profile.skills || []), ...userEnteredSkills]));

            // Overwrite parsed profile with candidate-entered preferred data
            const preferredProfile = {
              ...profile,
              name: submittedInfo.name || profile.name,
              email: submittedInfo.email || profile.email,
              phone: submittedInfo.phone || profile.phone,
              gender: submittedInfo.gender || profile.gender,
              location: submittedInfo.currentCity || profile.location,
              currentTitle: submittedInfo.designation || profile.currentTitle,
              currentCompany: submittedInfo.currentCompanyName || (profile as any).currentCompany || '',
              totalExperienceYears: submittedInfo.isFresher ? 0 : (parseFloat(submittedInfo.totalExperienceYears) || profile.totalExperienceYears || 0),
              education: submittedInfo.qualificationBasic
                ? [{ degree: submittedInfo.qualificationBasic, institution: '', year: '' }]
                : profile.education,
              skills: mergedSkills,
            };

            return saveResumeDumpCandidate({
              recruiterUID,
              profile: preferredProfile,
              resumeText: resumeTextContent,
              resumeUrl: resumeUrlToSave,
              fileName: submittedFile?.name || resumeUrlToSave.split('/').pop()?.split('?')[0] || 'candidate-resume',
              mimeType: resumeMimeType,
              fileSize: submittedFile?.size,
              source: 'candidate_interview',
              sourceInterviewId: interviewId!,
              sourceJobTitle: interview!.title,
            });
          }).catch((error) => {
            console.error('Could not save candidate resume to recruiter library:', error);
          });

      const [aiQuestions] = await Promise.all([questionsPromise, saveToRecruiterLibraryPromise]);

      const manualQuestions = (interview as any).manualQuestions || [];
      const rawAllQuestions = [...manualQuestions, ...aiQuestions];
      const questions: string[] = [];
      const seenQuestionKeys = new Set<string>();

      for (const q of rawAllQuestions) {
        if (!q || typeof q !== 'string') continue;
        const sanitized = sanitizeQuestionLength(q.trim());
        if (!sanitized) continue;
        // Normalize key to deduplicate questions (e.g. repeated work experience intro)
        const normalizedKey = sanitized.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
        if (normalizedKey && !seenQuestionKeys.has(normalizedKey)) {
          seenQuestionKeys.add(normalizedKey);
          questions.push(sanitized);
        }
      }

      setInterviewState((prev) => ({
        ...prev,
        questions,
        currentQuestionIndex: 0,
        candidateResumeURL: resumeUrlToSave,
        candidateResumeMimeType: resumeMimeType,
        candidateResumeBase64: base64String,
        candidateResumeText: resumeTextContent, // Store parsed text in state
        language: submittedInfo.language,
        answers: Array(questions.length).fill(null),
        videoURLs: Array(questions.length).fill(null),
        transcriptIds: Array(questions.length).fill(null),
        transcriptTexts: Array(questions.length).fill(null),
        pendingResponseCount: 0,
      }));
      setStep('show-jd');
    } catch (err: any) {
        let displayError = "Failed to process resume. Please try again later.";
        try {
            // The error from the backend seems to be a JSON string in the message
            const errorObj = JSON.parse(err.message);
            if (errorObj.error && errorObj.error.message) {
                displayError = errorObj.error.message;
            }
        } catch (e) {
            // If parsing fails, use the original message if it's not too long/complex
            if (err.message && typeof err.message === 'string') {
                displayError = err.message.length > 220 ? `${err.message.slice(0, 220)}...` : err.message;
            }
        }
        setErrorMsg(displayError);
        setStep('collect-info');
    }
  };
  
  const checkSpeed = () => {
    setSpeedStatus("Checking...");
    const start = Date.now();
    const img = new Image();
    img.onload = () => {
      const duration = (Date.now() - start) / 1000;
      const speed = (50 * 8) / duration;
      setSpeedStatus(speed > 1000 ? "Excellent" : speed > 500 ? "Good" : "Weak");
    };
    img.src = "https://i.ibb.co/3y9DKsB6/Yellow-and-Black-Illustrative-Education-Logo-1.png?t=" + start;
  };

  // --- RENDER ---
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div className="interview-flow-shell fixed inset-0 z-[9999] overflow-y-auto bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] flex flex-col items-center justify-start py-8 sm:py-12 px-4 transition-colors duration-500 font-sans">
      <div className="absolute top-4 right-4 z-[10000]">
        <DayNightToggle />
      </div>
      {children}
    </div>
  );

  if (rateLimitStopMessage) {
    return (
      <Container>
        <div role="alert" className="mt-[12vh] w-full max-w-lg overflow-hidden rounded-[14px] border border-red-500/25 bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.12)] dark:bg-[#0a0a0a]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10 text-red-500">
            <i className="fas fa-triangle-exclamation text-lg" aria-hidden="true"></i>
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-gray-950 dark:text-white">Interview unavailable</h1>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button type="button" onClick={() => navigate('/jobs')} className="w-full sm:w-auto rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 cursor-pointer">
              Browse Open Jobs
            </button>
            <button type="button" onClick={() => navigate('/upload-resume')} className="w-full sm:w-auto rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 cursor-pointer">
              Upload Resume
            </button>
          </div>
        </div>
      </Container>
    );
  }

  if (!interview) {
    return (
      <Container>
        {errorMsg ? 
          <div className="interview-state-card interview-state-error text-red-500 bg-red-100 dark:bg-red-900/20 p-4 rounded-lg">{errorMsg}</div> : 
          <div className="interview-state-loader relative w-20 h-20">
            <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-3 border-t-4 border-purple-500 rounded-full animate-spin reverse"></div>
          </div>
        }
      </Container>
    );
  }

  if (step === 'validating') {
    return (
      <Container>
        <div className="interview-state-loader relative w-20 h-20">
          <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-3 border-t-4 border-purple-500 rounded-full animate-spin reverse"></div>
        </div>
      </Container>
    );
  }

  if (step === 'welcome') {
    return (
      <Container>
        <InterviewWelcomeScreen 
          interview={interview}
          onProceed={() => {
            if (interview?.requiresToken === true) {
              setStep('enter-code');
            } else {
              setStep('collect-info');
            }
          }}
        />
      </Container>
    );
  }

  if (step === 'enter-code') {
    return (
      <Container>
        <AccessCodeVerificationScreen 
          interviewId={interviewId!}
          initialToken={searchParams.get('token') || ''}
          onSuccess={() => setStep('collect-info')}
        />
      </Container>
    );
  }

  if (step === 'collect-info') {
    return (
      <Container>
        {step === 'collect-info' && (
          <CandidateInfoForm 
            jobTitle={interviewState.jobTitle}
            interviewId={interviewId!}
            interviewData={interview}
            onBackToWelcome={() => setStep('welcome')}
            onSubmit={handleInfoSubmit} 
            errorMsg={errorMsg}
            user={user}
            userProfile={userProfile}
          />
        )}
      </Container>
    );
  }

  if (step === 'show-jd') {
    const formatLanguageName = (langCode: string) => {
      const names: Record<string, string> = {
        en: 'English',
        hi: 'Hindi (हिंदी)',
        mr: 'Marathi (मराठी)'
      };
      return names[langCode] || langCode.toUpperCase();
    };

    return (
      <Container>
        <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
          {/* Header Banner */}
          <div className="text-center mb-6 sm:mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-black mb-3 uppercase tracking-wider shadow-sm">
              <Briefcase size={14} className="text-[#D4F82C]" />
              <span>Job Description Review</span>
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#111215] dark:text-white leading-tight tracking-tight">
              {interview.title}
            </h2>
            {interview.department && (
              <p className="text-xs sm:text-sm font-semibold text-[#575A51] dark:text-[#A1A49B] mt-1.5">
                Department: {interview.department}
              </p>
            )}
          </div>

          {/* Key Parameters Bento Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5 mb-6 sm:mb-8">
            {/* Salary / CTC */}
            <div className="bg-white dark:bg-[#16171C] p-4 rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-sm flex flex-col items-center text-center transition-all duration-300 hover:border-[#111215] dark:hover:border-[#D4F82C] group">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                <IndianRupee size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-widest">Salary / CTC</span>
              <span className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1 truncate max-w-full">
                {(interview as any).salary 
                  ? (typeof (interview as any).salary === 'number' ? `₹${((interview as any).salary / 100000).toFixed(1)} LPA` : (interview as any).salary)
                  : ((interview as any).salaryRange || (interview as any).ctc || '₹3.5 LPA - ₹6.0 LPA')}
              </span>
            </div>

            {/* Location */}
            <div className="bg-white dark:bg-[#16171C] p-4 rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-sm flex flex-col items-center text-center transition-all duration-300 hover:border-[#111215] dark:hover:border-[#D4F82C] group">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                <MapPin size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-widest">Location</span>
              <span className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1 truncate max-w-full">
                {(interview as any).location || (interview as any).jobLocation || (interview as any).city || 'Pune / On-Site'}
              </span>
            </div>

            {/* Experience */}
            <div className="bg-white dark:bg-[#16171C] p-4 rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-sm flex flex-col items-center text-center transition-all duration-300 hover:border-[#111215] dark:hover:border-[#D4F82C] group">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                <GraduationCap size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-widest">Experience</span>
              <span className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1 truncate max-w-full">
                {(interview as any).experienceRequired || (interview as any).experienceLevel || (interview as any).minExperience || (interview as any).experience || '0 - 2 Years'}
              </span>
            </div>

            {/* Job Type */}
            <div className="bg-white dark:bg-[#16171C] p-4 rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-sm flex flex-col items-center text-center transition-all duration-300 hover:border-[#111215] dark:hover:border-[#D4F82C] group">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                <Briefcase size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-widest">Job Type</span>
              <span className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1 truncate max-w-full">
                {(interview as any).employmentType || (interview as any).jobType || 'Full-Time'}
              </span>
            </div>

            {/* Duration */}
            <div className="bg-white dark:bg-[#16171C] p-4 rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-sm flex flex-col items-center text-center transition-all duration-300 hover:border-[#111215] dark:hover:border-[#D4F82C] group">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                <Clock size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-widest">Duration</span>
              <span className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1">{interview.duration || 15} mins</span>
            </div>

            {/* Difficulty */}
            <div className="bg-white dark:bg-[#16171C] p-4 rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-sm flex flex-col items-center text-center transition-all duration-300 hover:border-[#111215] dark:hover:border-[#D4F82C] group">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                <Gauge size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-widest">Difficulty</span>
              <span className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1">{interview.difficulty || 'Medium'}</span>
            </div>

            {/* Strictness */}
            <div className="bg-white dark:bg-[#16171C] p-4 rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-sm flex flex-col items-center text-center transition-all duration-300 hover:border-[#111215] dark:hover:border-[#D4F82C] group">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                <Shield size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-widest">Strictness</span>
              <span className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1">{interview.strictness || 'Medium'}</span>
            </div>

            {/* Language */}
            <div className="bg-white dark:bg-[#16171C] p-4 rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-sm flex flex-col items-center text-center transition-all duration-300 hover:border-[#111215] dark:hover:border-[#D4F82C] group">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-[#111215] dark:text-[#D4F82C] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                <Globe size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#73766C] dark:text-neutral-400 uppercase tracking-widest">Language</span>
              <span className="text-xs sm:text-sm font-black text-[#111215] dark:text-white mt-1">{formatLanguageName(interviewState.language)}</span>
            </div>
          </div>

          {/* Job Description details box */}
          <div className="bg-white dark:bg-[#16171C] rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-sm p-5 sm:p-7 md:p-8 mb-6 sm:mb-8">
            <div className="flex items-center justify-between border-b border-[#E4E7DC] dark:border-white/10 pb-4 mb-4 flex-wrap gap-2.5">
              <h3 className="text-sm sm:text-base font-black text-[#111215] dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FileText size={18} className="text-[#111215] dark:text-[#D4F82C]" />
                <span>Role & Responsibilities</span>
              </h3>
              <ListenJDButton
                title={interview.title}
                description={interview.description || ''}
                lang={interviewState.language || 'en'}
                size="md"
              />
            </div>
            
            <div className="max-h-[420px] overflow-y-auto pr-2 custom-scrollbar leading-relaxed text-sm sm:text-base text-[#111215] dark:text-[#E4E7DC] select-text selection:bg-[#D4F82C]/40 touch-pan-y font-medium">
              <FormattedJobDescription description={interview.description} />
            </div>
          </div>

          {/* Action Callouts & Next button */}
          <div className="sticky bottom-0 z-30 bg-white/95 dark:bg-[#16171C]/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-[#E4E7DC] dark:border-white/15 p-4 sm:p-5 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-2xl bg-[#D4F82C] text-[#111215] flex-shrink-0 flex items-center justify-center mx-auto sm:mx-0 shadow-sm">
                <Zap size={20} className="fill-[#111215]" />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#111215] dark:text-white">Ready to begin?</h4>
                <p className="text-xs text-[#575A51] dark:text-[#A1A49B] mt-0.5">Please review the details above. The next step will verify your audio and video.</p>
              </div>
            </div>
            
            <button 
              onClick={() => setStep('instructions')}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#111215] hover:bg-[#202227] text-[#D4F82C] hover:text-white font-black text-xs sm:text-sm rounded-full shadow-lg shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group whitespace-nowrap cursor-pointer"
            >
              <span>Proceed to Hardware Check</span>
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </Container>
    );
  }

  if (step === 'instructions') {
    return (
      <div className="w-full max-w-4xl mx-auto px-1 sm:px-4 py-2 sm:py-6">
        <div className="flex items-center justify-center w-full px-0">
          <InterviewReadinessOnboarding
            interview={interview}
            state={interviewState}
            onStart={() => {
              setInterviewState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex || 0 }));
              setStep('interview');
            }}
          />
        </div>
      </div>
    );
  }

  if (step === 'setup' || step === 'processing') {
    return (
      <Container>
        <div className="interview-state-card flex flex-col items-center max-w-md text-center">
          <div className="interview-state-loader relative w-24 h-24 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700/60 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-blue-500 border-r-blue-400 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <i className="fas fa-robot text-3xl text-blue-500 leading-none animate-pulse"></i>
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">{loadingMsg}</h3>
          <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Please wait while the interview is prepared.</p>
        </div>
      </Container>
    );
  }

  if (step === 'interview') {
    return (
      <ActiveInterviewSession
        state={interviewState}
        setState={setInterviewState}
        candidateInfo={candidateInfo}
        jobTitle={interviewState.jobTitle || (interview as any)?.title || (interview as any)?.jobTitle}
        jobId={interviewId}
        onFinish={(result?: { terminated?: boolean }) => {
          setInterviewTerminated(Boolean(result?.terminated));
          setStep('finish');
        }}
        onTabSwitch={() => setTabSwitches(prev => prev + 1)}
      />
    );
  }

  if (step === 'finish') {
    return <InterviewSubmission state={interviewState} tabSwitches={tabSwitches} interviewId={interviewId!} recruiterUID={(interview as any).recruiterUID} candidateInfo={candidateInfo} terminated={interviewTerminated} />;
  }

  return null;
};

// --- Sub-Component: Active Interview (Immersive) ---
const ActiveInterviewSession: React.FC<{
  state: InterviewState;
  setState: React.Dispatch<React.SetStateAction<InterviewState>>;
  onFinish: (result?: { terminated?: boolean }) => void;
  onTabSwitch: () => void;
  candidateInfo?: CandidateInfo;
  jobTitle?: string;
  jobId?: string;
}> = ({ state, setState, onFinish, onTabSwitch, candidateInfo, jobTitle, jobId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const answerDeadlineRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const hasFinishedRef = useRef(false);

  const handleSessionFinish = (result?: { terminated?: boolean }) => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    onFinish(result);
  };

  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS / 1000);
  const [countdown, setCountdown] = useState(QUESTION_PREP_COUNTDOWN_SEC);
  const [processingVideo, setProcessingVideo] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(() => getMuteTTS());

  const livekit = useLiveKitInterview({
    jobId: jobId || state.jobId,
    jobTitle: jobTitle || state.jobTitle,
    candidateName: candidateInfo?.name || 'Candidate',
    candidateEmail: candidateInfo?.email || '',
    questions: state.questions,
    enabled: true,
    onComplete: (data) => {
      console.log('[LiveKit Auto-Submission]: All questions completed by AI Interviewer', data);
      handleSessionFinish();
    },
    onQuestionChange: (index) => {
      if (typeof index === 'number' && index >= 0 && index < state.questions.length) {
        setState(prev => ({
          ...prev,
          currentQuestionIndex: index
        }));
      }
    },
  });

  const isAiSpeaking = isSpeaking || livekit.isAgentSpeaking;

  const toggleMuteVoice = () => {
    const next = !isVoiceMuted;
    setIsVoiceMuted(next);
    setMuteTTS(next);
    if (next) {
      speak.stop();
      setIsSpeaking(false);
    }
  };

  const rawQ = state.questions[state.currentQuestionIndex];
  const currentQ = rawQ ? sanitizeQuestionLength(rawQ) : '';

  const [tabWarning, setTabWarning] = useState<string | null>(null);
  const tabWarningTimerRef = useRef<any>(null);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  });

  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  });
  const [fullscreenEscapes, setFullscreenEscapes] = useState(0);
  const [isTerminated, setIsTerminated] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const hasEnteredFullscreenRef = useRef(isFullscreen);
  const sessionReady = (isFullscreen || isMobile) && cameraReady && !isTerminated;

  useEffect(() => {
    const checkMobile = () => {
      const isMob = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setIsStopping(true);
      answerDeadlineRef.current = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const syncTimeLeftFromDeadline = () => {
    const deadline = answerDeadlineRef.current;
    if (!deadline) return;

    const remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    setTimeLeft(remainingSeconds);

    if (remainingSeconds === 0 && mediaRecorderRef.current?.state !== 'inactive') {
      stopRecording();
    }
  };

  const processRecordedAnswer = async (blob: Blob, questionIndex: number, language: string) => {
    let videoUrl: string | null = null;
    let transcriptId: string | null = null;
    let transcriptText: string | null = null;

    try {
      videoUrl = await uploadToCloudinary(blob, 'video');
      if (videoUrl) {
        transcriptId = await requestTranscription(videoUrl, language);
      } else {
        transcriptText = '(Video upload failed.)';
      }
    } catch (error) {
      console.error("Upload/transcription error:", error);
      transcriptText = '(Video upload or transcription setup failed.)';
    } finally {
      setState(prev => {
        const nextVideoUrls = [...prev.videoURLs];
        const nextTranscriptIds = [...prev.transcriptIds];
        const nextTranscriptTexts = prev.transcriptTexts
          ? [...prev.transcriptTexts]
          : Array(prev.questions.length).fill(null);

        nextVideoUrls[questionIndex] = videoUrl;
        nextTranscriptIds[questionIndex] = transcriptId;

        if (transcriptText) {
          nextTranscriptTexts[questionIndex] = transcriptText;
        }

        return {
          ...prev,
          videoURLs: nextVideoUrls,
          transcriptIds: nextTranscriptIds,
          transcriptTexts: nextTranscriptTexts,
          pendingResponseCount: Math.max((prev.pendingResponseCount ?? 1) - 1, 0),
        };
      });
    }
  };

  // Anti-cheating & Fullscreen effect
  useEffect(() => {
    // Basic Anti-Copy
    const handleCopyCutPaste = (e: ClipboardEvent) => e.preventDefault();
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (['c', 'v', 'x', 's'].includes(e.key.toLowerCase())) e.preventDefault();
      }
      if (e.key === 'F12') e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && ['u', 'U'].includes(e.key)) e.preventDefault();
    };
    const blockDrag = (e: DragEvent) => e.preventDefault();

    document.addEventListener('copy', handleCopyCutPaste);
    document.addEventListener('cut', handleCopyCutPaste);
    document.addEventListener('paste', handleCopyCutPaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', blockDrag);

    return () => {
      document.removeEventListener('copy', handleCopyCutPaste);
      document.removeEventListener('cut', handleCopyCutPaste);
      document.removeEventListener('paste', handleCopyCutPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', blockDrag);
    };
  }, []);

  useEffect(() => {
    if (isTerminated) return;

    const handleFullscreenChange = () => {
      if (isMobile) {
        setIsFullscreen(true);
        hasEnteredFullscreenRef.current = true;
        return;
      }
      const isFS = !!getFullscreenElement();
      setIsFullscreen(isFS);
      
      if (isFS) {
        hasEnteredFullscreenRef.current = true;
        setFullscreenError(null);
      } else if (hasEnteredFullscreenRef.current) {
        setFullscreenEscapes(prev => {
          const newCount = prev + 1;
          if (newCount >= 3) {
            setIsTerminated(true);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
            handleSessionFinish({ terminated: true });
          }
          return newCount;
        });
      }
    };

    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange as EventListener);
    };
  }, [isTerminated, onFinish, isMobile]);


  // Tab Visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        onTabSwitch();
        const warning = 'TAB SWITCH DETECTED - This activity has been recorded and will be flagged in your report.';
        setTabWarning(warning);
        // Auto-clear the warning banner after 5 seconds
        if (tabWarningTimerRef.current) clearTimeout(tabWarningTimerRef.current);
        tabWarningTimerRef.current = setTimeout(() => setTabWarning(null), 5000);
      }

      syncTimeLeftFromDeadline();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (tabWarningTimerRef.current) clearTimeout(tabWarningTimerRef.current);
    };
  }, [onTabSwitch]);

  // Camera
  useEffect(() => {
    let isCancelled = false;

    const setupCamera = async () => {
      setCameraReady(false);
      setCameraError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser does not support camera/microphone recording.");
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      } catch (err1) {
        console.warn("Primary camera setup failed, trying basic video+audio:", err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err2) {
          console.warn("Video+audio setup failed, trying audio-only fallback:", err2);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (err3) {
            console.error("All media recording setups failed:", err3);
            if (!isCancelled) {
              setCameraError("Microphone access is required for recording your interview answers.");
            }
            return;
          }
        }
      }

      if (!stream || isCancelled) {
        if (stream) stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      const hasVideo = stream.getVideoTracks().length > 0;
      if (videoRef.current && hasVideo) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraReady(true);
    };
    setupCamera();
    return () => {
      isCancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      speak.stop();
    };
  }, []);

  // TTS auto-play - Kokoro TTS (English) / Web Speech API (Hindi, Marathi)
  // Reads the current question aloud as soon as it appears on screen.
  useEffect(() => {
    if (!currentQ || !sessionReady) return;

    // Map the short language code from candidate selection to BCP-47
    const langMap: Record<string, string> = { en: 'en', hi: 'hi-IN', mr: 'mr-IN' };
    const ttsLang = langMap[state.language] || 'en';

    // Small delay so the question text renders before audio starts
    const timeout = setTimeout(() => {
      unlockTTSAudio();
      setIsSpeaking(true);
      speak(currentQ, {
        lang: ttsLang,
        onEnd: () => {
          setIsSpeaking(false);
          console.log('[TTS] Finished reading question');
        },
        onError: (err) => {
          setIsSpeaking(false);
          console.warn('[TTS] Error reading question:', err);
        },
      });
    }, 300);

    return () => {
      clearTimeout(timeout);
      speak.stop();
      setIsSpeaking(false);
    };
  }, [currentQ, state.language, sessionReady]);



  // Auto-Logic
  useEffect(() => {
    if (!sessionReady || isRecording || processingVideo || isStopping) {
      return;
    }

    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    } else if (countdown === 0) {
      startRecording();
    }
  }, [countdown, sessionReady, isRecording, processingVideo, isStopping]);

  useEffect(() => {
    if (!isRecording || isTerminated) return;

    syncTimeLeftFromDeadline();
    const timer = window.setInterval(syncTimeLeftFromDeadline, 1000);
    document.addEventListener('visibilitychange', syncTimeLeftFromDeadline);
    window.addEventListener('focus', syncTimeLeftFromDeadline);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncTimeLeftFromDeadline);
      window.removeEventListener('focus', syncTimeLeftFromDeadline);
    };
  }, [isRecording, isTerminated]);

  const startRecording = () => {
    if (!sessionReady || !streamRef.current) return;
    if (typeof MediaRecorder === 'undefined') {
      setCameraError("This browser does not support in-browser recording.");
      return;
    }
    
    // Low-spec: 150kbps keeps upload and encode costs low on weaker devices.
    let options: any = { videoBitsPerSecond: 150_000 };
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
    } else if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('video/mp4')) {
        options.mimeType = 'video/mp4';
    }

    const questionIndex = state.currentQuestionIndex;
    const isLastQuestion = questionIndex >= state.questions.length - 1;
    let recorder: MediaRecorder;

    try {
      recorder = new MediaRecorder(streamRef.current, options);
    } catch (error) {
      console.error("MediaRecorder setup error:", error);
      setCameraError("Recording could not be started on this browser/device.");
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onerror = (error) => {
      console.error("Recorder error:", error);
      answerDeadlineRef.current = null;
      setIsRecording(false);
      setIsStopping(false);
      setProcessingVideo(false);
      setCameraError("Recording failed. Please refresh and try again.");
    };
    recorder.onstop = async () => {
      const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      chunksRef.current = [];
      answerDeadlineRef.current = null;

      const recordedDurationMs = recordingStartTimeRef.current 
        ? Math.max(1000, Date.now() - recordingStartTimeRef.current) 
        : 0;
      recordingStartTimeRef.current = null;

      let finalBlob = rawBlob;
      // Inject missing duration into WebM EBML header so AssemblyAI / media parsers
      // don't read duration as Infinity / NaN and fail with "Error: Audio duration is too long."
      if ((recorder.mimeType || 'video/webm').includes('webm') && recordedDurationMs > 0) {
        try {
          finalBlob = await fixWebmDuration(rawBlob, recordedDurationMs);
        } catch (patchErr) {
          console.warn("Could not patch WebM duration header:", patchErr);
        }
      }

      setState(prev => {
        const nextAnswers = [...prev.answers];
        const nextTranscriptTexts = prev.transcriptTexts
          ? [...prev.transcriptTexts]
          : Array(prev.questions.length).fill(null);

        nextAnswers[questionIndex] = "Answered";
        nextTranscriptTexts[questionIndex] = null;

        return {
          ...prev,
          answers: nextAnswers,
          transcriptTexts: nextTranscriptTexts,
          currentQuestionIndex: isLastQuestion ? questionIndex : questionIndex + 1,
          pendingResponseCount: (prev.pendingResponseCount ?? 0) + 1,
        };
      });

      void processRecordedAnswer(finalBlob, questionIndex, state.language);
      setProcessingVideo(false);
      setIsStopping(false);
      if (isLastQuestion) {
        handleSessionFinish();
      } else {
        setCountdown(QUESTION_PREP_COUNTDOWN_SEC);
        setTimeLeft(QUESTION_TIME_MS / 1000);
      }
    };
    mediaRecorderRef.current = recorder;
    try {
      recorder.start();
      recordingStartTimeRef.current = Date.now();
      answerDeadlineRef.current = Date.now() + QUESTION_TIME_MS;
      setTimeLeft(QUESTION_TIME_MS / 1000);
      setIsRecording(true);
      setCameraError(null);
    } catch (error) {
      console.error("Recorder start error:", error);
      setCameraError("Recording could not be started on this browser/device.");
    }
  };

  const renderFullscreenOverlay = () => {
    if (isMobile) return null;
    if (!isFullscreen && !isTerminated) {
      return createPortal(
        <div className="interview-room-overlay fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 sm:p-6 text-white text-center">
          <div className="interview-room-overlay-card max-w-md w-full p-6 sm:p-8 bg-[#111] rounded-2xl border border-red-500/30 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <i className="fas fa-exclamation-triangle text-5xl text-yellow-500 mb-4"></i>
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Fullscreen Required</h2>
            <p className="interview-room-overlay-copy text-gray-300 mb-6 font-medium text-xs sm:text-sm leading-relaxed">
              {cameraError || fullscreenError || (
                hasEnteredFullscreenRef.current
                  ? `You have exited fullscreen mode. You have ${3 - fullscreenEscapes} escape(s) remaining before automatic termination.`
                  : "This assessment must be taken in fullscreen mode to ensure a secure environment. Please enter fullscreen to start."
              )}
            </p>
            <button 
              onClick={async () => {
                setFullscreenError(null);
                try {
                  const docEl = document.documentElement as HTMLElement & {
                    webkitRequestFullscreen?: () => Promise<void>;
                    msRequestFullscreen?: () => Promise<void>;
                  };

                  if (docEl.requestFullscreen) {
                    await docEl.requestFullscreen();
                  } else if (docEl.webkitRequestFullscreen) {
                    await docEl.webkitRequestFullscreen();
                  } else if (docEl.msRequestFullscreen) {
                    await docEl.msRequestFullscreen();
                  } else {
                    setFullscreenError("Fullscreen mode is not supported on this browser/device.");
                  }
                } catch (err) {
                  console.error("Fullscreen error:", err);
                  setFullscreenError("Fullscreen could not be enabled. Please allow fullscreen and try again.");
                }
              }}
              className="interview-room-primary-button w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <i className="fas fa-terminal text-lg"></i>
              {hasEnteredFullscreenRef.current ? "Return to Fullscreen" : "Enter Fullscreen & Start"}
            </button>
          </div>
        </div>,
        document.body
      );
    }
    return null;
  };

  // --- SPLIT-PANEL DASHBOARD LAYOUT (LANDING PAGE BENTO THEME) ---
  return (
    <div
      className="interview-room-shell fixed inset-0 z-[9999] bg-[#F8F9F5] dark:bg-[#0D0E11] text-[#111215] dark:text-[#F8F9F5] flex flex-col overflow-hidden select-none font-sans"
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {renderFullscreenOverlay()}

      {/* Subtle blueprint dot-matrix grid overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 z-0" 
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(17,18,21,0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} 
      />

      {/* Top Bento Header Bar */}
      <header className="relative z-10 shrink-0 px-4 py-2.5 md:px-6 md:py-3 border-b border-[#E4E7DC] dark:border-white/10 bg-white/80 dark:bg-[#16171C]/80 backdrop-blur-md flex items-center justify-between gap-3 shadow-xs">
        {/* Left: Brand + Role Badge */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#111215] text-[#D4F82C] flex items-center justify-center font-black text-xs shadow-md">
              <Sparkles size={15} className="text-[#D4F82C]" />
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-xs font-black tracking-wider uppercase text-[#111215] dark:text-white">ATS SNAB</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#D4F82C] text-[#111215] font-black uppercase tracking-wider shadow-2xs">
                AI INTERVIEW
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-[#E4E7DC] dark:bg-white/10 hidden sm:block" />

          {/* Job Title Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs font-bold text-[#111215] dark:text-white truncate max-w-[180px] sm:max-w-xs">
            <Briefcase size={12} className="text-[#73766C] dark:text-neutral-400 shrink-0" />
            <span className="truncate">{jobTitle || state.jobTitle || 'AI Video Assessment'}</span>
          </div>

          {/* Candidate Name Badge */}
          {candidateInfo?.name && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs font-medium text-[#73766C] dark:text-neutral-300">
              <User size={12} className="text-[#111215] dark:text-white" />
              <span className="font-bold text-[#111215] dark:text-white">{candidateInfo.name}</span>
            </div>
          )}
        </div>

        {/* Center: Live Progress Steps */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs font-mono font-bold">
            <span className="text-[#73766C] dark:text-neutral-400">Question</span>
            <span className="font-black text-[#111215] dark:text-[#D4F82C]">{state.currentQuestionIndex + 1}</span>
            <span className="text-neutral-400">/</span>
            <span>{state.questions.length}</span>
          </div>
          <div className="flex items-center gap-1">
            {state.questions.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === state.currentQuestionIndex 
                    ? 'w-6 bg-[#D4F82C] shadow-[0_0_10px_rgba(212,248,44,0.6)]' 
                    : i < state.currentQuestionIndex 
                      ? 'w-2.5 bg-[#111215] dark:bg-white' 
                      : 'w-2 bg-[#E4E7DC] dark:bg-white/15'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Right: Proctor & LiveKit Status Badges */}
        <div className="flex items-center gap-2">
          {livekit.isConnected ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4F82C]/15 border border-[#D4F82C]/35 text-[#111215] dark:text-[#D4F82C] text-[11px] font-black tracking-wide">
              <span className="w-2 h-2 rounded-full bg-[#D4F82C] animate-pulse"></span>
              <span className="hidden sm:inline">LIVEKIT AI</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden sm:inline">AI READY</span>
            </div>
          )}

          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono font-bold transition-all ${
            isFullscreen 
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 animate-pulse'
          }`}>
            <ShieldCheck size={13} className={isFullscreen ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
            <span className="hidden sm:inline">{isFullscreen ? 'PROCTOR ARMED' : 'FULLSCREEN REQUIRED'}</span>
          </div>
        </div>
      </header>

      {cameraError && (
        <div className="interview-room-banner-wrap px-4 pt-3 relative z-10">
          <div className="w-full px-4 py-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{cameraError}</span>
          </div>
        </div>
      )}

      {/* Main Content Grid: camera/avatar (left) + question/voice (right) */}
      <div className="interview-room-grid flex-1 flex flex-col md:flex-row gap-3 md:gap-4 p-3 md:p-4 overflow-hidden min-h-0 relative z-10">

        {/* Left panel: AI Recruiter Hologram Station & Candidate Camera Feed */}
        <div className="interview-room-camera-column w-full md:w-5/12 flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 md:shrink md:min-h-0">
          
          {/* AI Interviewer Avatar Card */}
          <div className="hidden md:flex relative h-auto py-5 px-5 md:flex-1 bg-[#111215] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex-col items-center justify-between">
            <style>{`
              @keyframes soundbar {
                0%, 100% { height: 25%; }
                50% { height: 100%; }
              }
            `}</style>
            
            {/* Holographic scanner blueprint backdrop */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
              backgroundImage: 'radial-gradient(circle, rgba(212,248,44,0.18) 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}></div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#D4F82C]/10 via-transparent to-blue-500/5 pointer-events-none"></div>

            {/* Top Micro-Header */}
            <div className="w-full flex items-center justify-between px-2 z-10">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#D4F82C]">
                <Sparkles size={11} className="text-[#D4F82C]" />
                <span>AI Interviewer</span>
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 font-bold tracking-wider">
                REALTIME 2.5
              </span>
            </div>
            
            {/* AI Hologram Visualizer Core */}
            <div className="relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center my-auto">
              {/* Outer orbit ring with rotating dash */}
              <div className={`absolute inset-0 rounded-full border border-dashed border-[#D4F82C]/50 ${isAiSpeaking ? 'animate-spin' : 'animate-[spin_20s_linear_infinite]'} opacity-80`}></div>
              
              {/* Middle glowing glass shell */}
              <div className={`absolute inset-3 rounded-full border border-white/10 bg-white/5 transition-all duration-700 ${
                isAiSpeaking ? 'scale-105 opacity-90 shadow-[0_0_35px_rgba(212,248,44,0.35)]' : 'scale-100 opacity-40 shadow-none'
              }`}></div>

              {/* Dynamic Speech wave arcs */}
              <svg className="absolute w-full h-full pointer-events-none z-10" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="32" fill="none" stroke="#D4F82C" strokeWidth="1" strokeDasharray="5,15" className={`origin-center transition-all ${isAiSpeaking ? 'animate-[spin_4s_linear_infinite]' : 'animate-[spin_12s_linear_infinite]'}`} />
                <circle cx="50" cy="50" r="28" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="40,20" className={`origin-center transition-all ${isAiSpeaking ? 'animate-[spin_6s_linear_infinite_reverse] opacity-80' : 'animate-[spin_18s_linear_infinite_reverse] opacity-30'}`} />
              </svg>

              {/* Centered Avatar Core with Fallback */}
              <div className={`relative w-18 h-18 md:w-22 md:h-22 rounded-full overflow-hidden border-2 flex items-center justify-center shadow-xl z-20 transition-all duration-300 ${
                isAiSpeaking 
                  ? 'scale-105 border-[#D4F82C] shadow-[0_0_35px_rgba(212,248,44,0.45)]' 
                  : 'border-white/20 bg-gradient-to-tr from-[#16171C] to-[#202227]'
              }`}>
                <img 
                  src="/recruiter_avatar.png" 
                  alt="" 
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                  className={`w-full h-full object-cover transition-transform duration-300 ${isAiSpeaking ? 'scale-105' : 'scale-100'}`} 
                />
                <div className="absolute inset-0 flex items-center justify-center text-[#D4F82C] -z-10 bg-[#16171C]">
                  <Bot size={34} />
                </div>
              </div>
            </div>

            {/* High-Fidelity Sound wave bars */}
            <div className="h-5 flex items-end gap-1 mt-2 z-10">
              {isAiSpeaking ? (
                <>
                  <span className="w-1 bg-[#D4F82C] rounded-full animate-[soundbar_0.8s_ease-in-out_infinite]" style={{ height: '40%' }}></span>
                  <span className="w-1 bg-white rounded-full animate-[soundbar_0.6s_ease-in-out_infinite_0.1s]" style={{ height: '80%' }}></span>
                  <span className="w-1 bg-[#D4F82C] rounded-full animate-[soundbar_0.7s_ease-in-out_infinite_0.3s]" style={{ height: '60%' }}></span>
                  <span className="w-1 bg-[#D4F82C] rounded-full animate-[soundbar_0.5s_ease-in-out_infinite_0.2s]" style={{ height: '100%' }}></span>
                  <span className="w-1 bg-white rounded-full animate-[soundbar_0.9s_ease-in-out_infinite_0.4s]" style={{ height: '70%' }}></span>
                  <span className="w-1 bg-[#D4F82C] rounded-full animate-[soundbar_0.7s_ease-in-out_infinite_0.15s]" style={{ height: '50%' }}></span>
                  <span className="w-1 bg-[#D4F82C] rounded-full animate-[soundbar_0.6s_ease-in-out_infinite_0.35s]" style={{ height: '30%' }}></span>
                </>
              ) : (
                <div className="flex gap-1">
                  {[...Array(7)].map((_, i) => (
                    <span key={i} className="w-1 h-1.5 bg-white/20 rounded-full"></span>
                  ))}
                </div>
              )}
            </div>

            {/* Speaking/Listening Status Pill */}
            <div className="mt-2 text-center z-10 flex flex-col items-center">
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black transition-all duration-300 ${
                isAiSpeaking 
                  ? 'bg-[#D4F82C]/20 text-[#D4F82C] border border-[#D4F82C]/40 shadow-[0_0_15px_rgba(212,248,44,0.25)] animate-pulse' 
                  : 'bg-white/10 text-neutral-300 border border-white/15'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isAiSpeaking ? 'bg-[#D4F82C] animate-ping' : 'bg-emerald-400'}`}></span>
                <span>{isAiSpeaking ? 'AI Recruiter Speaking...' : 'AI Listening to You'}</span>
              </span>
            </div>
          </div>

          {/* Camera Viewfinder Card with Futuristic HUD */}
          <div className="relative min-h-[160px] h-[25vh] sm:h-auto sm:flex-1 md:min-h-[210px] bg-[#111215] rounded-3xl overflow-hidden border border-[#E4E7DC] dark:border-white/10 shadow-xl shrink-0">
            {/* Viewfinder HUD Corner Brackets */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#D4F82C]/70 rounded-tl pointer-events-none z-10" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#D4F82C]/70 rounded-tr pointer-events-none z-10" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#D4F82C]/70 rounded-bl pointer-events-none z-10" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#D4F82C]/70 rounded-br pointer-events-none z-10" />

            {/* Mobile AI Recruiter Floating Badge */}
            <div className="md:hidden absolute top-2.5 left-2.5 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-[#111215]/90 backdrop-blur-md border border-[#D4F82C]/30 text-white">
              <div className="relative w-5 h-5 rounded-full overflow-hidden border border-[#D4F82C]/60 shrink-0">
                <img src="/recruiter_avatar.png" alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className={`w-1.5 h-1.5 rounded-full ${isAiSpeaking ? 'bg-[#D4F82C] animate-ping' : 'bg-emerald-400'}`}></span>
                <span className={isAiSpeaking ? 'text-[#D4F82C] font-black' : 'text-neutral-300'}>
                  {isAiSpeaking ? 'AI Speaking...' : 'AI Listening'}
                </span>
              </div>
            </div>

            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />

            {/* Countdown Overlay with Bento Typography */}
            {sessionReady && countdown > 0 && (
              <div className="absolute inset-0 bg-[#111215]/85 backdrop-blur-md flex flex-col items-center justify-center z-20 animate-in fade-in">
                <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-neutral-300 text-[11px] font-black uppercase tracking-widest mb-3">
                  Get Ready to Answer
                </span>
                <span className="text-6xl md:text-8xl font-black text-[#D4F82C] tracking-tight drop-shadow-[0_0_25px_rgba(212,248,44,0.4)]">
                  {countdown}
                </span>
                <p className="text-white/60 text-xs font-medium mt-2">Question starts automatically</p>
              </div>
            )}

            {/* TicTacToe during processing */}
            {processingVideo && <TicTacToe />}
          </div>

          {/* Status Bar Below Camera */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#16171C] rounded-2xl border border-[#E4E7DC] dark:border-white/10 shadow-sm">
            <div className="flex items-center gap-2">
              {isRecording ? (
                <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>
                  <span>LIVE REC</span>
                </div>
              ) : !cameraReady ? (
                <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span>INITIALIZING</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#F8F9F5] dark:bg-white/5 text-[#73766C] dark:text-neutral-400 border border-[#E4E7DC] dark:border-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full"></div>
                  <span>STANDBY</span>
                </div>
              )}

              <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#73766C] dark:text-neutral-400 font-medium">
                <Camera size={12} />
                <span>1080p HD</span>
              </div>
            </div>

            <div className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
              isFullscreen 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
            }`}>
              <ShieldCheck size={12} />
              <span>{isFullscreen ? 'FULLSCREEN PROCTOR ON' : 'FULLSCREEN OFF'}</span>
            </div>
          </div>
        </div>

        {/* Right panel: Bento Question Card + Spoken Response & Voice Controls */}
        <div className="interview-room-question-column w-full md:w-7/12 flex flex-col gap-3 min-h-0 flex-1">
          {/* Bento Question Card */}
          <div className="flex-1 flex flex-col bg-white dark:bg-[#16171C] rounded-3xl border border-[#E4E7DC] dark:border-white/10 shadow-2xl overflow-hidden min-h-0">

            {/* Question Header: Counter + Countdown Timer */}
            <div className="flex items-center justify-between px-6 md:px-8 py-3.5 md:py-4 border-b border-[#E4E7DC] dark:border-white/10 shrink-0 bg-white/50 dark:bg-transparent">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#111215] dark:text-[#D4F82C]">
                  <Briefcase size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-[#73766C] dark:text-neutral-400 uppercase tracking-widest font-black">Question Index</p>
                  <p className="text-base md:text-xl font-black text-[#111215] dark:text-white">
                    {state.currentQuestionIndex + 1} <span className="text-neutral-400 text-xs md:text-sm font-normal">/ {state.questions.length}</span>
                  </p>
                </div>
              </div>

              {/* Countdown Timer Pill */}
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-black text-xs md:text-sm border transition-colors shadow-2xs ${
                timeLeft < 30
                  ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800 animate-pulse'
                  : 'bg-[#F8F9F5] text-[#111215] border-[#E4E7DC] dark:bg-white/5 dark:text-white dark:border-white/10'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-neutral-400'}`}></div>
                <Clock size={13} className="opacity-70" />
                <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>

            {/* Horizontal Dynamic Neon Lime Progress Line */}
            <div className="w-full bg-[#E4E7DC]/60 dark:bg-white/5 h-1">
              <div 
                className="bg-[#D4F82C] h-1 transition-all duration-500 shadow-[0_0_10px_rgba(212,248,44,0.6)]"
                style={{ width: `${((state.currentQuestionIndex + 1) / state.questions.length) * 100}%` }}
              />
            </div>

            {/* Question Body */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6 md:py-8 flex flex-col justify-between touch-pan-y custom-scrollbar">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111215] text-[#D4F82C] text-[10px] font-black uppercase tracking-wider shadow-xs">
                    <Mic size={11} className="text-[#D4F82C]" />
                    <span>Speak Your Response Clearly Below</span>
                  </span>
                  {livekit.isConnected && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {livekit.isAgentSpeaking ? 'Alex (AI) is Speaking...' : livekit.isCandidateSpeaking ? 'Listening to You...' : 'Realtime Voice AI Active'}
                    </span>
                  )}
                </div>

                {livekit.lastCompliment && (
                  <div className="mb-4 px-4 py-3 rounded-2xl bg-[#D4F82C]/20 border border-[#D4F82C]/50 text-[#111215] dark:text-[#D4F82C] text-xs font-black flex items-center gap-2 animate-fade-in shadow-xs">
                    <Sparkles size={16} className="text-[#111215] dark:text-[#D4F82C] shrink-0" />
                    <span>Alex: "{livekit.lastCompliment}"</span>
                  </div>
                )}

                {livekit.isCrossQuestioning && (
                  <div className="mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-black flex items-center gap-2 animate-pulse">
                    <Sparkles size={16} className="text-amber-500 shrink-0" />
                    <span>AI Cross-Questioning: Probing In-Depth Technical Architecture & Real-World Decisions</span>
                  </div>
                )}

                <h2 className="text-xl sm:text-2xl md:text-3xl font-black leading-relaxed text-[#111215] dark:text-white selection:bg-[#D4F82C]/40 tracking-tight">
                  {livekit.currentQuestionText || currentQ}
                </h2>
              </div>

              {/* Candidate Audio Listening Status Card */}
              <div className="mt-6 pt-4 border-t border-[#E4E7DC]/60 dark:border-white/5">
                <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.03] border border-[#E4E7DC] dark:border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 flex items-center justify-center text-[#111215] dark:text-[#D4F82C] shrink-0">
                      <Mic size={16} className={isRecording ? 'text-rose-500 animate-pulse' : 'text-[#73766C] dark:text-neutral-400'} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111215] dark:text-white">
                        {isRecording ? 'Listening to your microphone...' : 'Microphone is on standby'}
                      </p>
                      <p className="text-[11px] text-[#73766C] dark:text-neutral-400">
                        {isRecording ? 'Speak clearly at normal pace. AI records both video and audio.' : 'Recording begins automatically when countdown concludes.'}
                      </p>
                    </div>
                  </div>

                  {isRecording && (
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-3 bg-emerald-500 rounded-full animate-[soundbar_0.6s_ease-in-out_infinite]" />
                      <span className="w-1 h-5 bg-emerald-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite_0.1s]" />
                      <span className="w-1 h-4 bg-emerald-500 rounded-full animate-[soundbar_0.7s_ease-in-out_infinite_0.2s]" />
                      <span className="w-1 h-2 bg-emerald-500 rounded-full animate-[soundbar_0.4s_ease-in-out_infinite_0.3s]" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons & Voice Controls */}
            <div className="flex flex-row items-center justify-between gap-3 px-6 md:px-8 py-4 border-t border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5]/70 dark:bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (getMuteTTS()) return;
                    unlockTTSAudio();
                    speak.stop();
                    setIsSpeaking(true);
                    const langMap: Record<string, string> = { en: 'en', hi: 'hi-IN', mr: 'mr-IN' };
                    const ttsLang = langMap[state.language] || 'en';
                    speak(currentQ, {
                      lang: ttsLang,
                      onEnd: () => setIsSpeaking(false),
                      onError: () => setIsSpeaking(false),
                    });
                  }}
                  className={`px-4 py-2.5 rounded-full border text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 ${
                    isSpeaking
                      ? 'bg-[#111215] text-[#D4F82C] border-[#111215] shadow-md animate-pulse'
                      : 'bg-white dark:bg-white/5 hover:bg-[#E4E7DC]/50 text-[#111215] dark:text-white border-[#E4E7DC] dark:border-white/10'
                  }`}
                  title="Replay Voice Aloud"
                >
                  <Volume2 size={14} className={isSpeaking ? 'text-[#D4F82C]' : ''} />
                  <span>{isSpeaking ? 'Speaking...' : 'Replay Voice'}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleMuteVoice}
                  className={`px-3.5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border active:scale-95 ${
                    isVoiceMuted
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      : 'bg-white dark:bg-white/5 text-[#73766C] dark:text-neutral-300 border-[#E4E7DC] dark:border-white/10 hover:bg-[#E4E7DC]/50'
                  }`}
                  title={isVoiceMuted ? "Unmute AI Voice" : "Mute AI Voice"}
                >
                  <Mic size={13} className={isVoiceMuted ? 'text-rose-500' : ''} />
                  <span className="hidden sm:inline">{isVoiceMuted ? 'Voice Muted' : 'Mute Voice'}</span>
                </button>
              </div>

              {/* Next / Stop CTA Button */}
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-7 py-3 rounded-full font-black text-xs sm:text-sm bg-[#111215] hover:bg-[#202227] text-[#D4F82C] hover:text-white shadow-xl shadow-black/15 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                >
                  <span>{state.currentQuestionIndex >= state.questions.length - 1 ? 'Finish & Submit' : 'Next Question'}</span>
                  <ArrowRight size={15} />
                </button>
              ) : processingVideo || isStopping ? (
                <div className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-[#73766C] dark:text-neutral-400 bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                  <RefreshCw size={13} className="animate-spin text-[#D4F82C]" />
                  <span>Loading next...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-[#73766C] dark:text-neutral-400 bg-white dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10">
                  <Clock size={13} />
                  <span>Ready</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="interview-room-footer shrink-0 px-3 md:px-4 pb-3 relative z-10">
        {/* Tab-switch warning banner (red, real-time) */}
        {tabWarning && (
          <div className="interview-room-warning w-full px-4 py-3 bg-red-500/10 dark:bg-red-950/40 rounded-2xl border border-red-500/20 shadow-md flex items-center gap-3 animate-in fade-in">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertCircle size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-red-600 dark:text-red-400 uppercase tracking-widest font-black mb-0.5">Security Alert</p>
              <p className="text-xs md:text-sm text-red-700 dark:text-red-300 font-bold truncate">{tabWarning}</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] font-mono font-black shrink-0">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
              FLAGGED
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Global in-flight and completed submission caches across mounts / strict mode
const activeSubmissionLocks = new Set<string>();
const completedSubmissionCache = new Map<string, { docId: string; reportUrl: string }>();

// --- Submission Screen ---
const InterviewSubmission: React.FC<{
  state: InterviewState;
  tabSwitches: number;
  interviewId: string;
  recruiterUID?: string;
  candidateInfo: CandidateInfo;
  terminated: boolean;
}> = ({ state, tabSwitches, interviewId, recruiterUID, candidateInfo, terminated }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState("Finalizing transcripts...");
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [reportUrl, setReportUrl] = useState('');
  const [finalScores, setFinalScores] = useState<{ overall: string, resume: string, qna: string } | null>(null);
  const navigate = useNavigate();
  const [factIndex, setFactIndex] = useState(0);
  const hasSubmittedRef = useRef(false);
  const latestStateRef = useRef(state);
  const facts = [
    "The first computer bug was a real moth.", "Symbolics.com was the first domain.", "NASA's internet is 91 GB/s.",
    "The Firefox logo is a red panda.", "Email existed before the Web."
  ];

  const candidateEmail = (candidateInfo?.email || '').trim().toLowerCase();
  const lockKey = `${interviewId}_${candidateEmail || candidateInfo?.phone || 'cand'}`;

  const [candidateRating, setCandidateRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Prevent accidental page refresh / exit during submission & processing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!showCompletionPopup) {
        e.preventDefault();
        e.returnValue = 'Your assessment is currently uploading and being analyzed. Please do not refresh or close this page!';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [showCompletionPopup]);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    const i = setInterval(() => setFactIndex(p => (p + 1) % facts.length), 4000);
    return () => clearInterval(i);
  }, [facts.length]);

  useEffect(() => {
    // Guard 1: only run once per component instance
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    // Guard 2: fast-path check if this candidate already completed the interview in memory or session
    const cached = completedSubmissionCache.get(lockKey);
    const sessionDocId = sessionStorage.getItem(`interview_completed_${lockKey}`);
    const completedDocId = cached?.docId || sessionDocId;
    if (completedDocId) {
      setReportUrl(`/report/${interviewId}/${completedDocId}`);
      setShowCompletionPopup(true);
      setStatus('Successfully Submitted!');
      return;
    }

    // Guard 3: prevent concurrent in-flight submissions (e.g. React StrictMode double-mount)
    if (activeSubmissionLocks.has(lockKey)) {
      console.warn(`[Interview] Submission already in flight for ${lockKey}, skipping duplicate execution.`);
      return;
    }
    activeSubmissionLocks.add(lockKey);

    const finalize = async () => {
      const waitForPendingResponses = async () => {
        let attempts = 0;

        while ((latestStateRef.current.pendingResponseCount ?? 0) > 0 && attempts < 180) {
          const pendingResponses = latestStateRef.current.pendingResponseCount ?? 0;
          setStatus(`Processing ${pendingResponses} recorded answer${pendingResponses === 1 ? '' : 's'}...`);
          await sleep(1000);
          attempts++;
        }
      };

      const resolveTranscriptText = async (transcriptId: string | null, existingText: string | null) => {
        if (!transcriptId) {
          return existingText || '(Transcript unavailable)';
        }

        if (existingText) {
          return existingText;
        }

        for (let attempts = 0; attempts < TRANSCRIPT_POLL_ATTEMPTS; attempts++) {
          await sleep(TRANSCRIPT_POLL_DELAY_MS);
          const res = await fetchTranscriptText(transcriptId);

          if (res.status === 'completed') {
            return res.text || '(No speech detected)';
          }

          if (res.status === 'error') {
            console.warn(`[Transcription] Provider error for ${transcriptId}:`, res.text);
            return '(Audio answer recorded - transcript unavailable)';
          }
        }

        return '(Transcription timeout)';
      };

      try {
        // Guard 4: Check Firestore if an attempt already exists for this candidate on this interview
        if (candidateInfo?.email) {
          try {
            const attemptsRef = collection(db, 'interviews', interviewId, 'attempts');
            const emailQuery = query(attemptsRef, where('candidateInfo.email', '==', candidateInfo.email));
            const existingSnap = await getDocs(emailQuery);
            const alreadySubmittedDoc = existingSnap.docs.find(d => !d.data().allowReattempt);
            if (alreadySubmittedDoc) {
              console.warn(`[Interview] Existing attempt found (${alreadySubmittedDoc.id}), preventing duplicate save.`);
              const existingId = alreadySubmittedDoc.id;
              completedSubmissionCache.set(lockKey, { docId: existingId, reportUrl: `/report/${interviewId}/${existingId}` });
              sessionStorage.setItem(`interview_completed_${lockKey}`, existingId);
              sessionStorage.removeItem(`interview_wizard_step_${interviewId}`);
              sessionStorage.removeItem(`interview_wizard_state_${interviewId}`);
              setReportUrl(`/report/${interviewId}/${existingId}`);
              setShowCompletionPopup(true);
              setStatus('Successfully Submitted!');
              activeSubmissionLocks.delete(lockKey);
              return;
            }
          } catch (dupCheckErr) {
            console.warn('[Interview] Pre-submission duplicate check warning:', dupCheckErr);
          }
        }

        await waitForPendingResponses();
        setStatus("Finalizing transcripts...");
        const finalState = latestStateRef.current;
        const transcriptTexts = await Promise.all(
          finalState.questions.map((_, index) =>
            resolveTranscriptText(
              finalState.transcriptIds[index] ?? null,
              finalState.transcriptTexts?.[index] ?? null
            )
          )
        );
        
        setStatus("AI Analyzing performance...");
        let base64Resume = finalState.candidateResumeBase64;
        let resumeTextContent = finalState.candidateResumeText;
        
        if (!base64Resume) {
          // Fallback to fetch resume if not already base64'd (e.g. from Cloudinary URL)
          if (!finalState.candidateResumeURL) {
              throw new Error("Candidate resume URL is missing for feedback generation.");
          }

          const resp = await fetch(finalState.candidateResumeURL);
          const blob = await resp.blob();

          if (!resumeTextContent) {
            resumeTextContent = await extractResumeText(blob);
          }

          base64Resume = await getBlobAsBase64(blob);
        }

        const candidateExperience = (!candidateInfo.isFresher && candidateInfo.totalExperienceYears)
            ? `${candidateInfo.totalExperienceYears} years ${candidateInfo.totalExperienceMonths} months`
            : "0 years";

        const feedbackRaw = await generateFeedback(
          finalState.jobTitle,
          finalState.jobDescription,
          candidateExperience,
          base64Resume,
          finalState.candidateResumeMimeType!,
          finalState.questions,
          transcriptTexts,
          resumeTextContent,
          finalState.strictness || 'Medium'
        );

        const parseScoreValue = (regex: RegExp): number => {
          const match = feedbackRaw.match(regex);
          if (match && match[1]) {
            return parseInt(match[1], 10);
          }
          return 0;
        };

        const resumeScoreNum = parseScoreValue(/Resume Score:\s*(\d{1,3})(?:\s*\/\s*100)?/i);
        const qnaScoreNum = parseScoreValue(/Q&A Score:\s*(\d{1,3})(?:\s*\/\s*100)?/i);

        const overallScoreNum = Math.round((resumeScoreNum * 0.4) + (qnaScoreNum * 0.6));

        setFinalScores({
          overall: (overallScoreNum / 10).toFixed(1),
          resume: (resumeScoreNum / 10).toFixed(1),
          qna: (qnaScoreNum / 10).toFixed(1)
        });

        setStatus("Saving Report...");
        const attemptData = {
            ...finalState,
            candidateResumeBase64: null, // Do not bloat Firebase storage
            transcriptTexts,
            pendingResponseCount: 0,
            feedback: feedbackRaw,
            score: `${overallScoreNum}/100`,
            resumeScore: `${resumeScoreNum}/100`,
            qnaScore: `${qnaScoreNum}/100`,
            candidateInfo,
            status: terminated ? 'Terminated' : 'Completed',
            submittedAt: serverTimestamp(), 
            candidateUID: user?.uid || null,
            interviewId: interviewId,
            interviewTitle: state.title || state.jobTitle || state.interviewTitle || 'Untitled Interview',
            title: state.title || state.jobTitle || state.interviewTitle || 'Untitled Interview',
            recruiterUID: recruiterUID || null,
            jobId: interviewId,
            isMock: state.isMock || false,
            meta: { tabSwitchCount: tabSwitches }
        }
        const docRef = doc(collection(db, 'interviews', interviewId, 'attempts'));
        await recordCandidateSubmission('interviews', docRef, attemptData);

        const targetRecruiterUID = recruiterUID ||
                                  (state as any).recruiterUID ||
                                  (state as any).createdByUID ||
                                  (state as any).createdBy?.uid ||
                                  'PUBLIC_JOB_SEEKER_POOL';

        if (targetRecruiterUID && candidateInfo?.email) {
          saveResumeDumpCandidate({
            recruiterUID: targetRecruiterUID,
            profile: {
              name: candidateInfo.name || 'Candidate',
              email: candidateInfo.email,
              phone: candidateInfo.phone || '',
              gender: candidateInfo.gender || '',
              location: candidateInfo.currentCity || '',
              currentTitle: candidateInfo.designation || '',
              summary: '',
              totalExperienceYears: candidateInfo.isFresher ? 0 : (parseFloat(candidateInfo.totalExperienceYears) || 0),
              skills: [],
              experience: [],
              education: candidateInfo.qualificationBasic ? [{ degree: candidateInfo.qualificationBasic, institution: '', year: '' }] : [],
              certifications: [],
              languages: [],
              keywords: [],
              linkedinUrl: '',
              portfolioUrl: ''
            } as ParsedResumeProfile,
            resumeText: state.candidateResumeText || '',
            resumeUrl: state.candidateResumeURL || '',
            fileName: 'candidate-resume',
            mimeType: state.candidateResumeMimeType || 'application/pdf',
            source: 'candidate_interview',
            sourceInterviewId: interviewId,
            sourceJobTitle: state.title || state.jobTitle || 'Interview'
          }).catch(err => console.warn('Final completion dump save fallback warning:', err));
        }

        completedSubmissionCache.set(lockKey, { docId: docRef.id, reportUrl: `/report/${interviewId}/${docRef.id}` });
        sessionStorage.setItem(`interview_completed_${lockKey}`, docRef.id);
        sessionStorage.removeItem(`interview_wizard_step_${interviewId}`);
        sessionStorage.removeItem(`interview_wizard_state_${interviewId}`);
        activeSubmissionLocks.delete(lockKey);

        setReportUrl(`/report/${interviewId}/${docRef.id}`);
        setShowCompletionPopup(true);
        setStatus('Successfully Submitted!');
      } catch (err) { 
          activeSubmissionLocks.delete(lockKey);
          console.error("Finalization error:", err);
          setStatus("An error occurred while saving your report. Please contact support."); 
      }
    };
    finalize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="interview-completion-shell min-h-screen bg-[#F8F9F5] dark:bg-[#0D0E11] flex flex-col items-center justify-center p-4 text-center font-sans">
        <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
          {/* Glowing background ring */}
          <div className="absolute inset-0 rounded-full bg-[#D4F82C]/10 blur-xl animate-pulse"></div>
          
          {/* Static track circle */}
          <div className="absolute inset-0 border-4 border-[#E4E7DC] dark:border-white/10 rounded-full"></div>
          
          {/* Animated spinning progress arc */}
          <div className="absolute inset-0 border-4 border-t-[#111215] dark:border-t-[#D4F82C] border-r-[#111215]/40 dark:border-r-[#D4F82C]/40 border-b-transparent border-l-transparent rounded-full animate-spin"></div>

          {/* Centered Icon Container */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {showCompletionPopup || status === 'Successfully Submitted!' ? (
              <Check size={36} className="text-emerald-500 animate-in zoom-in duration-300" />
            ) : (
              <BrainCircuit size={36} className="text-[#111215] dark:text-[#D4F82C] animate-pulse" />
            )}
          </div>
        </div>

        {/* Dynamic Title */}
        <h2 className="text-2xl sm:text-4xl font-black text-[#111215] dark:text-white mb-2 tracking-tight">
          {terminated 
            ? 'Interview Terminated' 
            : (showCompletionPopup || status === 'Successfully Submitted!' ? 'Assessment Submitted!' : 'Submitting Assessment...')}
        </h2>

        {/* Status description */}
        <p className={`mb-5 text-sm sm:text-base ${terminated ? 'text-rose-500 font-bold' : 'text-[#575A51] dark:text-[#A1A49B] font-medium'}`}>
          {terminated ? 'Session revoked due to security violations.' : status}
        </p>

        {/* Warning Alert Box: Do Not Refresh */}
        {!showCompletionPopup && !terminated && (
          <div className="mb-6 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2 max-w-md shadow-sm">
            <AlertCircle size={15} className="shrink-0 text-amber-500" />
            <span>Please <strong>do NOT refresh or close</strong> this window while we process and upload your evaluation.</span>
          </div>
        )}

        <div className="bg-white dark:bg-[#16171C] p-6 rounded-3xl max-w-lg text-center border border-[#E4E7DC] dark:border-white/10 shadow-lg">
          <p className="text-[11px] font-black text-[#73766C] dark:text-neutral-400 uppercase mb-2 tracking-widest">While we evaluate</p>
          <p className="text-[#111215] dark:text-[#E4E7DC] font-semibold italic text-base leading-relaxed transition-all duration-500">"{facts[factIndex]}"</p>
        </div>

        {(showCompletionPopup || status === 'Successfully Submitted!') && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
            <button 
              type="button"
              onClick={() => navigate('/jobs')} 
              className="w-full bg-[#111215] hover:bg-[#202227] text-[#D4F82C] hover:text-white font-black py-3.5 px-6 rounded-full shadow-lg shadow-black/10 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              <Briefcase size={15} />
              <span>Explore All Jobs</span>
            </button>
            <button 
              type="button"
              onClick={() => navigate('/upload-resume')} 
              className="w-full bg-white dark:bg-white/5 hover:bg-[#E4E7DC]/50 text-[#111215] dark:text-white font-black py-3.5 px-6 rounded-full border border-[#E4E7DC] dark:border-white/10 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              <FileText size={15} />
              <span>Upload Resume</span>
            </button>
          </div>
        )}
      </div>

      {/* Thank You Modal Popup with Rating */}
      {showCompletionPopup && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[10000] p-4" onClick={() => navigate('/jobs')}>
          <div className="bg-white dark:bg-[#16171C] rounded-3xl shadow-2xl w-full max-w-lg text-center p-6 sm:p-8 m-4 animate-in zoom-in-95 duration-300 border border-[#E4E7DC] dark:border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 mx-auto bg-[#D4F82C] text-[#111215] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-black/10">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="font-black text-2xl sm:text-3xl text-[#111215] dark:text-white mb-2 tracking-tight">Thank You!</h3>
            <p className="text-xs sm:text-sm text-[#575A51] dark:text-[#A1A49B] mb-5 leading-relaxed font-medium">
              Your interview assessment has been successfully recorded. The hiring team has been notified and will review your performance shortly.
            </p>

            {/* Candidate Experience Rating */}
            <div className="bg-[#F8F9F5] dark:bg-white/[0.02] p-5 rounded-2xl border border-[#E4E7DC] dark:border-white/10 mb-6">
              <p className="text-[11px] font-black text-[#73766C] dark:text-neutral-400 uppercase tracking-wider mb-2.5">
                Rate Your Interview Experience
              </p>
              <div className="flex items-center justify-center gap-2 my-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      setCandidateRating(star);
                      setRatingSubmitted(true);
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                    title={`${star} Star${star > 1 ? 's' : ''}`}
                  >
                    <Star 
                      size={24} 
                      className={`${star <= (hoverRating || candidateRating) ? 'fill-amber-400 text-amber-400' : 'text-neutral-300 dark:text-neutral-600'}`} 
                    />
                  </button>
                ))}
              </div>
              {ratingSubmitted && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 animate-in fade-in flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={13} />
                  <span>Thank you for rating ({candidateRating}/5 stars)!</span>
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button 
                type="button"
                onClick={() => navigate('/jobs')} 
                className="w-full bg-[#111215] hover:bg-[#202227] text-[#D4F82C] hover:text-white font-black py-4 px-6 rounded-full shadow-lg shadow-black/10 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm cursor-pointer"
              >
                <Briefcase size={16} />
                <span>Explore All Open Jobs</span>
                <ArrowRight size={14} />
              </button>

              <button 
                type="button"
                onClick={() => navigate('/upload-resume')} 
                className="w-full bg-[#F8F9F5] dark:bg-white/5 hover:bg-[#E4E7DC]/60 text-[#111215] dark:text-white font-black py-3.5 px-6 rounded-full border border-[#E4E7DC] dark:border-white/10 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
              >
                <FileText size={15} />
                <span>Upload Resume for More Roles</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default CandidateInterviewFlow;
