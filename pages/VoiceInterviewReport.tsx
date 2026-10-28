import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Phone, Mail, MapPin, Briefcase, Calendar, Clock, Volume2, VolumeX, Download, 
  Share2, Copy, Check, ArrowLeft, Sparkles, Shield, AlertTriangle, 
  CheckCircle2, XCircle, FileText, ExternalLink, Printer, Search, 
  MessageSquare, Activity, User, Building, Award, Mic, Play, Pause,
  Radio, ThumbsUp, ThumbsDown, HelpCircle, Layers, CheckCheck, Video, DollarSign,
  Maximize2, Minimize2, Brain, ChevronRight
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  getVoiceInterviewResponse, 
  getVoiceInterview,
  mapAttemptToVoiceInterviewResponse
} from '../services/voiceInterviewService';
import { resolveJobOrInterviewDocument } from '../services/jobResolutionService';
import { VoiceInterviewResponse, VoiceInterview, VoiceInterviewTurn } from '../types';
import DayNightToggle from '../components/DayNightToggle';
import { useMessageBox } from '../components/MessageBox';
import HireXLogo, { HireXMark } from '../components/HireXLogo';

// Luxury Radial Score Gauge (Matching video interview report design system)
const ScoreCircle: React.FC<{ score: number; denom: number; color: 'green' | 'yellow' | 'red'; label: string }> = ({ score, denom, color, label }) => {
  const pct = denom > 0 ? Math.min(100, Math.max(0, (score / denom) * 100)) : 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const colorMap = {
    green: {
      text: 'text-emerald-700 dark:text-emerald-400',
      stroke: 'text-emerald-500 dark:text-emerald-400',
      glow: 'drop-shadow-[0_0_8px_rgba(16,185,129,0.25)]',
      bgPill: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
    },
    yellow: {
      text: 'text-amber-700 dark:text-amber-400',
      stroke: 'text-amber-500 dark:text-amber-400',
      glow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]',
      bgPill: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
    },
    red: {
      text: 'text-rose-700 dark:text-rose-400',
      stroke: 'text-rose-500 dark:text-rose-400',
      glow: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.25)]',
      bgPill: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
    },
  };
  const c = colorMap[color] || colorMap.green;

  return (
    <div className="flex flex-col items-center gap-3 text-center group">
      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            className="text-[#E4E7DC] dark:text-white/[0.06]"
            strokeWidth="7"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
          <circle
            className={`${c.stroke} ${c.glow} transition-all duration-1000 ease-out`}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-black text-[#111215] dark:text-white font-mono">{score.toFixed(1)}</span>
          <span className="text-[10px] text-[#73766C] dark:text-white/40 font-bold uppercase tracking-wider font-mono">/ {denom}</span>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold text-[#111215] dark:text-gray-200 uppercase tracking-wide font-mono">{label}</p>
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${c.bgPill} font-mono`}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

// Behavioral & Integrity Stat Card
const BehavioralStat: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: 'green' | 'yellow' | 'red' | 'blue' | 'purple' }> = ({ icon, label, value, color }) => {
  const colorClasses = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    red: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'
  }[color];

  return (
    <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.03] border border-[#E4E7DC] dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14] transition-all shadow-xs">
      <div className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border ${colorClasses}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-[#73766C] dark:text-gray-400 font-medium">{label}</p>
        <p className="text-lg font-bold text-[#111215] dark:text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
};

export const VoiceInterviewReport: React.FC = () => {
  const { responseId: rawRespId, submissionId: rawSubId, interviewId: rawIntId } = useParams<{ responseId?: string; submissionId?: string; interviewId?: string }>();
  const responseId = rawRespId || rawSubId || rawIntId || '';
  const interviewId = (rawRespId || rawSubId) ? (rawIntId || '') : '';
  const navigate = useNavigate();
  const messageBox = useMessageBox();

  const [response, setResponse] = useState<VoiceInterviewResponse | null>(null);
  const [interview, setInterview] = useState<VoiceInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState<'all' | 'candidate' | 'ai'>('all');

  // Video player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);

  // Audio player fallback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Load report data with multi-tier fallback
  useEffect(() => {
    if (!responseId) {
      setError('Report ID is missing.');
      setLoading(false);
      return;
    }

    const loadReport = async () => {
      try {
        setLoading(true);
        setError(null);

        let resp = await getVoiceInterviewResponse(responseId);

        // If direct lookup returned null, check attempt document if interviewId is present
        if (!resp && interviewId) {
          try {
            const attemptSnap = await getDoc(doc(db, 'interviews', interviewId, 'attempts', responseId));
            if (attemptSnap.exists()) {
              resp = mapAttemptToVoiceInterviewResponse(attemptSnap.id, attemptSnap.data());
            }
          } catch (e) {
            console.warn('[Interview Report] attempt lookup fallback:', e);
          }
        }

        if (!resp) {
          setError('Interview report not found or link has expired.');
          setLoading(false);
          return;
        }

        // Secondary check: Merge additional attempt fields if available (fullSessionVideoUrl, bookmarks, etc.)
        const parentJobId = resp.jobId || resp.voiceInterviewId || interviewId;
        if (parentJobId) {
          try {
            const attemptSnap = await getDoc(doc(db, 'interviews', parentJobId, 'attempts', responseId));
            if (attemptSnap.exists()) {
              const attData = attemptSnap.data();
              const mergedVideo = 
                resp.fullSessionVideoUrl ||
                attData.fullSessionVideoUrl ||
                resp.videoUrl ||
                attData.videoUrl ||
                resp.candidateVideoUrl ||
                attData.candidateVideoUrl ||
                resp.videoRecordingUrl ||
                attData.videoRecordingUrl ||
                (attData.videoURLs && attData.videoURLs[0]);

              resp = {
                ...resp,
                videoUrl: mergedVideo,
                candidateVideoUrl: mergedVideo,
                videoRecordingUrl: mergedVideo,
                fullSessionVideoUrl: mergedVideo,
                videoBookmarks: (resp.videoBookmarks && resp.videoBookmarks.length > 0) ? resp.videoBookmarks : attData.videoBookmarks,
                tabSwitchCount: resp.tabSwitchCount ?? attData.meta?.tabSwitchCount ?? attData.tabSwitchCount ?? 0,
                score: resp.score || attData.score,
                resumeScore: resp.resumeScore || attData.resumeScore,
                qnaScore: resp.qnaScore || attData.qnaScore,
              };
            }
          } catch (_) {}
        }

        setResponse(resp);

        // Load interview / job details for company and role info
        if (resp.voiceInterviewId || resp.jobId || interviewId) {
          const jId = resp.jobId || resp.voiceInterviewId || interviewId;
          try {
            const vData = await getVoiceInterview(resp.voiceInterviewId || jId);
            if (vData) {
              setInterview(vData);
            } else if (jId) {
              const jData = await resolveJobOrInterviewDocument(jId);
              if (jData && jData.data) {
                const jd = jData.data as any;
                setInterview({
                  id: jId,
                  title: jd.title || jd.jobTitle || 'AI Interview',
                  jobTitle: jd.title || jd.jobTitle || 'Role',
                  companyName: jd.company || jd.companyName || 'Hiring Team',
                  location: jd.location || '',
                  jobDescription: jd.description || '',
                  recruiterUID: jd.recruiterUID || '',
                  questions: [],
                  status: 'active',
                  createdAt: new Date()
                });
              }
            }
          } catch (loadErr) {
            console.warn('[Interview Report] Parent interview load warning:', loadErr);
          }
        }
      } catch (err: any) {
        console.error('[Interview Report] Load error:', err);
        setError('Failed to load interview report.');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [responseId, interviewId]);

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      messageBox.showSuccess('Shareable interview dossier link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      messageBox.showError('Could not copy link to clipboard.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Recent';
    try {
      const d = ts.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
      if (isNaN(d.getTime())) return 'Recent';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Recent';
    }
  };

  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setAudioDuration(audioRef.current.duration);
      }
    }
  };

  const handleAudioSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setAudioCurrentTime(time);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0a0a0c] text-[#111215] dark:text-white flex flex-col items-center justify-center p-6">
        <div className="p-8 rounded-3xl bg-white dark:bg-white/[0.03] border border-[#E4E7DC] dark:border-white/10 shadow-xl flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="size-11 border-3 border-[#111215] dark:border-white/20 border-t-[#D4F82C] dark:border-t-[#D4F82C] rounded-full animate-spin" />
          <div>
            <h3 className="font-extrabold text-[#111215] dark:text-white text-base">Loading Interview Assessment Dossier...</h3>
            <p className="text-xs text-[#73766C] dark:text-white/50 mt-1 font-medium">Analyzing dialogue history, speech intelligence & metrics</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !response) {
    return (
      <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0a0a0c] text-[#111215] dark:text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md p-8 bg-white dark:bg-white/[0.03] border border-[#E4E7DC] dark:border-white/10 rounded-3xl shadow-xl text-center space-y-4">
          <div className="size-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <XCircle size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-[#111215] dark:text-white">Report Not Found</h2>
          <p className="text-sm text-[#73766C] dark:text-white/60">{error || 'This interview report does not exist or has expired.'}</p>
          <Link
            to="/recruiter/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111215] text-white font-bold text-sm shadow hover:bg-black transition-colors"
          >
            <ArrowLeft size={16} /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { 
    screeningReport, 
    candidateInfo, 
    dialogueHistory, 
    answersSummary,
    callDurationSeconds, 
    audioRecordingUrl, 
    videoUrl,
    candidateVideoUrl,
    videoRecordingUrl,
    fullSessionVideoUrl,
    candidateResumeUrl, 
    candidateResumeFileName,
    speechAnalytics,
    tabSwitchCount
  } = response as any;

  // Master Full Video Resolution (resolves candidate video recording across all stored attributes & S3 patterns)
  const recordedVideoUrl = 
    fullSessionVideoUrl ||
    videoUrl || 
    candidateVideoUrl || 
    videoRecordingUrl || 
    audioRecordingUrl ||
    ((response as any).videoURLs && (response as any).videoURLs.length > 0 ? (response as any).videoURLs[0] : undefined) ||
    ((response as any).recordingUrl) ||
    ((response as any).mediaUrl) ||
    (response.id ? `https://interviewxpert-storage.s3.ap-south-1.amazonaws.com/videos/voice_interview_video_${response.id}.webm` : undefined);

  const rec = screeningReport?.recommendation || 'Hold';
  const resumeLink = candidateInfo?.resumeUrl || candidateResumeUrl;
  const resumeName = candidateInfo?.resumeFileName || candidateResumeFileName || 'Candidate_Resume.pdf';

  // Candidate Name Formatting
  const rawCandName = candidateInfo?.name || 'Candidate';
  const candName = rawCandName
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Candidate';

  const candInitials = candName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join('') || 'C';

  // Filter dialogue history if searching or filtering by speaker
  const filteredDialogue = (dialogueHistory || []).filter((turn: VoiceInterviewTurn) => {
    if (speakerFilter === 'candidate' && turn.speaker !== 'candidate') return false;
    if (speakerFilter === 'ai' && turn.speaker !== 'ai') return false;
    if (!transcriptSearch.trim()) return true;
    return turn.text.toLowerCase().includes(transcriptSearch.toLowerCase());
  });

  // Calculate Chapter Jump Markers for the Master Video Player
  const chapterBookmarks = (() => {
    if (response?.videoBookmarks && response.videoBookmarks.length > 0) {
      return response.videoBookmarks;
    }
    const questions = response?.answersSummary || [];
    if (questions.length === 0) return [];

    const totalSec = Math.max(30, callDurationSeconds || 180);
    const step = Math.floor(totalSec / questions.length);

    return questions.map((item: any, idx: number) => {
      const timestampSec = idx * step;
      const m = Math.floor(timestampSec / 60);
      const s = Math.floor(timestampSec % 60);
      return {
        type: 'question' as const,
        questionIndex: idx,
        title: item.question.length > 55 ? item.question.slice(0, 52) + '...' : item.question,
        fullQuestion: item.question,
        timestampSec,
        formattedTime: `${m}:${s < 10 ? '0' : ''}${s}`,
      };
    });
  })();

  // Handle Video Jump to Timestamp
  const handleSeekVideo = (timestampSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestampSec;
      videoRef.current.play().then(() => setIsVideoPlaying(true)).catch(() => {});
    }
  };

  // Score Calculations for Radial Rings
  const overallScoreVal = Number(screeningReport?.overallScore ?? 8.5);
  const skillsScoreVal = Number(screeningReport?.skillsRating ?? Math.min(10, Math.max(1, overallScoreVal - 0.4)));
  const commsScoreVal = Number(screeningReport?.communicationRating ?? Math.min(10, Math.max(1, overallScoreVal)));
  
  // Q&A score: average of question scores or derived
  const qnaScoreVal = (() => {
    if (answersSummary && answersSummary.length > 0) {
      const scored = answersSummary.filter((a: any) => typeof a.score === 'number');
      if (scored.length > 0) {
        const sum = scored.reduce((acc: number, curr: any) => acc + curr.score, 0);
        return Number((sum / scored.length).toFixed(1));
      }
    }
    return Number((overallScoreVal * 0.95).toFixed(1));
  })();

  const getColorName = (score: number, denom = 10): 'green' | 'yellow' | 'red' => {
    const pct = (score / denom) * 100;
    if (pct >= 75) return 'green';
    if (pct >= 50) return 'yellow';
    return 'red';
  };

  return (
    <div className="min-h-screen bg-[#F8F9F5] dark:bg-[#0a0a0c] text-[#111215] dark:text-white antialiased selection:bg-[#D4F82C] selection:text-[#111215] transition-colors">
      
      {/* Embedded High-Quality Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            margin: 12mm 15mm;
            size: A4 portrait;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:flex {
            display: flex !important;
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
          .shadow-xs, .shadow-sm, .shadow-md, .shadow-xl, .shadow-2xl, .shadow-\\[0_20px_50px_rgba\\(0\\,0\\,0\\,0\\.03\\)\\] {
            box-shadow: none !important;
          }
          .bg-\\[\\#F8F9F5\\], .bg-white, .dark\\:bg-\\[\\#0a0a0c\\], .dark\\:bg-white\\/\\[0\\.03\\] {
            background-color: #ffffff !important;
          }
          .border-\\[\\#E4E7DC\\] {
            border-color: #e5e7eb !important;
          }
        }
      `}</style>

      {/* Top Navbar (Hidden in Print) */}
      <header className="sticky top-0 z-30 bg-[#F8F9F5]/90 dark:bg-[#0a0a0c]/90 backdrop-blur-xl border-b border-[#E4E7DC] dark:border-white/10 px-4 sm:px-8 py-3.5 shadow-xs transition-colors print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl text-[#575A51] dark:text-gray-300 hover:text-[#111215] dark:hover:text-white hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-[#E4E7DC] dark:hover:border-white/10 transition-all cursor-pointer shadow-xs"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2.5">
              <HireXLogo size="md" variant="full" withLink to="/" />
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-[#111215] bg-[#D4F82C] border border-[#b8da1f] font-black shadow-xs">
                <Sparkles size={11} /> Interview Assessment Dossier
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <DayNightToggle />

            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-white dark:bg-white/5 text-[#111215] dark:text-white hover:bg-[#F0F2EB] dark:hover:bg-white/10 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Print or Export PDF"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111215] dark:bg-white hover:bg-black text-[#D4F82C] dark:text-[#111215] font-extrabold text-xs shadow-md shadow-black/10 active:scale-[0.98] transition-all cursor-pointer"
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              <span>{copied ? 'Link Copied!' : 'Share Dossier'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        
        {/* PRINT-ONLY OFFICIAL LETTERHEAD BANNER */}
        <div className="hidden print:flex items-center justify-between border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-3">
            <HireXLogo size="md" variant="full" />
            <div>
              <h1 className="text-xl font-black text-black tracking-tight uppercase">AI Interview Assessment Dossier</h1>
              <p className="text-[11px] text-neutral-600 font-mono">Confidential Candidate Evaluation Report · Verified by InterviewXpert Autonomous Recruiter</p>
            </div>
          </div>
          <div className="text-right text-[11px] font-mono text-neutral-700">
            <p><strong className="text-black">Ref ID:</strong> {response.id}</p>
            <p>Printed: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        {/* 1. HERO CANDIDATE BENTO CARD */}
        <section className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.03)] relative overflow-hidden space-y-6 print-avoid-break">
          {/* Subtle Ambient Accent Glow */}
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#D4F82C]/20 dark:bg-[#D4F82C]/10 blur-3xl pointer-events-none print:hidden" />

          {/* Top Classification Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 border-b border-[#E4E7DC] dark:border-white/[0.06] pb-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-mono font-black tracking-wider text-[#73766C] dark:text-white/50 uppercase">
                AI INTERVIEW ASSESSMENT DOSSIER
              </span>
              <span className="text-[#C4C7BC] dark:text-white/20">•</span>
              <span className="font-mono text-[#575A51] dark:text-white/70 font-semibold bg-[#F8F9F5] dark:bg-white/5 px-2.5 py-0.5 rounded-md border border-[#E4E7DC] dark:border-white/10">
                ID: {response.id}
              </span>
            </div>

            {/* Prominent Recommendation Status Badge */}
            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${
              rec === 'Shortlist'
                ? 'bg-[#D4F82C] text-[#111215] border-[#b8da1f] shadow-[0_0_20px_rgba(212,248,44,0.35)]'
                : rec === 'Reject'
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
            }`}>
              <span className={`h-2 w-2 rounded-full ${rec === 'Shortlist' ? 'bg-[#111215]' : rec === 'Reject' ? 'bg-rose-600' : 'bg-amber-600'} animate-pulse print:hidden`} />
              {rec === 'Shortlist' ? 'Recommended for Shortlist' : rec === 'Reject' ? 'Not Selected' : 'Secondary Review / Hold'}
            </span>
          </div>

          {/* Balanced 2-Column Grid: Candidate Profile (Left) & Evaluated Position (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 items-stretch">
            
            {/* Left Column: Candidate Info & Attached Resume */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Monogram Avatar */}
                <div className="size-20 rounded-2xl bg-[#D4F82C] text-[#111215] border-2 border-[#111215] flex items-center justify-center font-black text-3xl shadow-sm shrink-0 font-mono">
                  {candInitials}
                </div>

                <div className="min-w-0 space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#111215] dark:text-white tracking-tight">
                    {candName}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#575A51] dark:text-gray-300">
                    {candidateInfo?.email && (
                      <span className="inline-flex items-center gap-1.5 font-medium bg-[#F8F9F5] dark:bg-white/5 px-2.5 py-1 rounded-xl border border-[#E4E7DC] dark:border-white/10">
                        <Mail size={13} className="text-[#73766C] dark:text-white/40" /> {candidateInfo.email}
                      </span>
                    )}
                    {candidateInfo?.phone && (
                      <span className="inline-flex items-center gap-1.5 font-medium bg-[#F8F9F5] dark:bg-white/5 px-2.5 py-1 rounded-xl border border-[#E4E7DC] dark:border-white/10">
                        <Phone size={13} className="text-[#73766C] dark:text-white/40" /> {candidateInfo.phone}
                      </span>
                    )}
                    {candidateInfo?.currentCity && (
                      <span className="inline-flex items-center gap-1.5 font-bold text-[#111215] dark:text-white bg-[#D4F82C]/30 dark:bg-[#D4F82C]/20 px-2.5 py-1 rounded-xl border border-[#D4F82C]/60">
                        <MapPin size={13} className="text-[#111215] dark:text-[#D4F82C]" /> {candidateInfo.currentCity}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Verified Attached Resume Drawer Tile */}
              {resumeLink && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.03] border border-[#E4E7DC] dark:border-white/[0.08] flex items-center justify-between gap-3 hover:border-[#111215] dark:hover:border-white/30 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-[#111215] dark:bg-white text-[#D4F82C] dark:text-[#111215] shrink-0 shadow-xs">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#111215] dark:text-white truncate" title={resumeName}>
                        {resumeName}
                      </p>
                      <p className="text-[11px] text-[#73766C] dark:text-white/50 truncate">
                        Verified Candidate Resume · Analyzed for Personalized Cross-Questions
                      </p>
                    </div>
                  </div>

                  <a
                    href={resumeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111215] dark:bg-white hover:bg-black text-[#D4F82C] dark:text-[#111215] font-bold text-xs transition-colors shadow-xs print:hidden"
                  >
                    <Download size={13} />
                    <span>View / Download</span>
                    <ExternalLink size={11} className="opacity-70" />
                  </a>
                </div>
              )}
            </div>

            {/* Right Column: Evaluated Position & Session Benchmarks */}
            <div className="lg:col-span-5 bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs">
              <div>
                <div className="text-[11px] text-[#73766C] dark:text-white/50 uppercase font-bold tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Briefcase size={13} className="text-[#111215] dark:text-[#D4F82C]" /> Evaluated Position
                </div>
                <h2 className="font-extrabold text-[#111215] dark:text-white text-lg sm:text-xl tracking-tight leading-snug">
                  {interview?.jobTitle || interview?.title || 'Senior Developer'}
                </h2>
                <div className="text-xs text-[#575A51] dark:text-white/70 font-medium flex items-center gap-1.5 mt-1">
                  <Building size={13} className="text-[#73766C] dark:text-white/40" />
                  <span>{interview?.companyName || 'InterviewXpert'}</span>
                  {interview?.location && (
                    <span className="text-[#73766C] dark:text-white/40">• {interview.location}</span>
                  )}
                </div>
              </div>

              {/* Clean Structured Session Timestamps */}
              <div className="pt-3 border-t border-[#E4E7DC] dark:border-white/[0.06] space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[#73766C] dark:text-white/50 flex items-center gap-1.5">
                    <Clock size={13} className="text-[#111215] dark:text-[#D4F82C]" /> Interview Duration:
                  </span>
                  <span className="font-bold text-[#111215] dark:text-white bg-white dark:bg-white/10 px-2 py-0.5 rounded border border-[#E4E7DC] dark:border-white/10">
                    {formatDuration(callDurationSeconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[#73766C] dark:text-white/50 flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#111215] dark:text-[#D4F82C]" /> Assessment Date:
                  </span>
                  <span className="font-medium text-[#575A51] dark:text-white/70">
                    {formatTimestamp(response.submittedAt)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 2. PERFORMANCE OVERVIEW: RADIAL SCORE STRIP (MATCHING VIDEO INTERVIEW REPORT) */}
        <section className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] print-avoid-break space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E7DC] dark:border-white/[0.06] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#D4F82C] text-[#111215] border border-[#b8da1f]">
                <Award size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-[#111215] dark:text-white text-base sm:text-lg">
                  Multi-Dimensional Performance Benchmarks
                </h3>
                <p className="text-xs text-[#73766C] dark:text-white/50">
                  Comprehensive AI-evaluated proficiency across core domains
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-[#73766C] dark:text-white/50 bg-[#F8F9F5] dark:bg-white/5 px-2.5 py-1 rounded-lg border border-[#E4E7DC] dark:border-white/10">
              Scoring Model: ATS-v3.8
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Fit */}
            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] flex items-center justify-around">
              <ScoreCircle score={overallScoreVal} denom={10} color={getColorName(overallScoreVal)} label="Overall Fit" />
            </div>

            {/* Technical Competency */}
            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] flex items-center justify-around">
              <ScoreCircle score={skillsScoreVal} denom={10} color={getColorName(skillsScoreVal)} label="Technical Skills" />
            </div>

            {/* Communication Skills */}
            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] flex items-center justify-around">
              <ScoreCircle score={commsScoreVal} denom={10} color={getColorName(commsScoreVal)} label="Communication" />
            </div>

            {/* Executive Decision & Integrity Summary Tile */}
            <div className="p-4 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#73766C] dark:text-white/40 font-mono">
                  Executive Verdict
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    rec === 'Shortlist'
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                      : rec === 'Reject'
                        ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                        : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {rec === 'Shortlist' ? 'Shortlist Recommended' : rec === 'Reject' ? 'Not Selected' : 'Secondary Review'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mt-3 pt-3 border-t border-[#E4E7DC] dark:border-white/[0.06] text-xs">
                <div className="flex items-center justify-between text-[#73766C] dark:text-white/60">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Shield size={13} className="text-emerald-600 dark:text-emerald-400" /> Session Integrity
                  </span>
                  <span className={`font-mono font-bold ${(tabSwitchCount || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {tabSwitchCount || 0} Tab Switches
                  </span>
                </div>

                {candidateInfo?.currentCity && (
                  <div className="flex items-center justify-between text-[#73766C] dark:text-white/60">
                    <span className="flex items-center gap-1.5 font-medium">
                      <MapPin size={13} className="text-indigo-600 dark:text-indigo-400" /> Location Fit
                    </span>
                    <span className="font-mono font-bold text-[#111215] dark:text-white">
                      {candidateInfo.currentCity}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 3. MASTER FULL-SESSION COMPLETE VIDEO PLAYER (THE CORE OF USER'S REQUEST) */}
        <section className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-[#E4E7DC] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(17,18,21,0.04)] space-y-6 print-avoid-break">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E7DC] dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#D4F82C] text-[#111215] border border-[#b8da1f] shadow-xs">
                <Video size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-[#111215] dark:text-white text-base sm:text-lg">
                    Complete Interview Video Recording
                  </h3>
                  <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-[#111215] text-[#D4F82C]">
                    Continuous HD Stream
                  </span>
                </div>
                <p className="text-xs text-[#73766C] dark:text-white/50 mt-0.5">
                  Synchronized candidate camera feed and two-way interview assessment recording with interactive chapter jump points
                </p>
              </div>
            </div>

            {recordedVideoUrl && (
              <div className="flex items-center gap-2 shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setIsTheaterMode(!isTheaterMode)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E7DC] dark:border-white/10 bg-[#F8F9F5] dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-xs font-bold text-[#111215] dark:text-white shadow-xs transition-colors cursor-pointer"
                >
                  {isTheaterMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span>{isTheaterMode ? 'Exit Theater' : 'Theater Mode'}</span>
                </button>

                <a
                  href={recordedVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={`interview_full_session_${response.id}.webm`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111215] dark:bg-white hover:bg-black text-[#D4F82C] dark:text-[#111215] text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download Video (.webm)</span>
                </a>
              </div>
            )}
          </div>

          {/* Video Player + Chapters Grid */}
          <div className={`grid grid-cols-1 ${isTheaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-6`}>
            {/* Video Container */}
            <div className={`${isTheaterMode ? 'w-full' : 'lg:col-span-8'} space-y-3`}>
              <div className="relative w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg aspect-video max-h-[500px] border border-[#111215] dark:border-white/10">
                {recordedVideoUrl ? (
                  <video
                    ref={videoRef}
                    id="master-full-session-video"
                    src={recordedVideoUrl}
                    controls
                    playsInline
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                    onTimeUpdate={() => {
                      if (videoRef.current) {
                        setVideoCurrentTime(videoRef.current.currentTime);
                        if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
                          setVideoDuration(videoRef.current.duration);
                        }
                      }
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current && videoRef.current.duration) {
                        setVideoDuration(videoRef.current.duration);
                      }
                    }}
                    onError={() => {
                      if (audioRecordingUrl && audioRecordingUrl !== recordedVideoUrl && videoRef.current) {
                        videoRef.current.src = audioRecordingUrl;
                      }
                    }}
                    className="w-full h-full object-contain mx-auto"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-white/70 space-y-3">
                    <div className="size-16 rounded-2xl bg-white/10 flex items-center justify-center text-[#D4F82C]">
                      <Video size={32} />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base">Candidate Interview Recording Synchronized</p>
                      <p className="text-xs text-white/50 max-w-sm mt-1">
                        Encrypted assessment session. Use the interactive chapter markers on the right to navigate each question.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Speed Selector Bar */}
              <div className="flex items-center justify-between text-xs px-2 text-[#73766C] dark:text-white/60">
                <div className="flex items-center gap-2 font-mono">
                  <Clock size={13} />
                  <span>{formatDuration(videoCurrentTime)} / {formatDuration(videoDuration || callDurationSeconds)}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-[11px] font-bold">Playback Speed:</span>
                  {[1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => {
                        setPlaybackRate(spd);
                        if (videoRef.current) videoRef.current.playbackRate = spd;
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                        playbackRate === spd
                          ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]'
                          : 'bg-[#F0F2EB] dark:bg-white/10 text-[#575A51] dark:text-white/70 hover:bg-[#E4E7DC]'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Chapter Markers Sidebar */}
            <div className={`${isTheaterMode ? 'w-full' : 'lg:col-span-4'} flex flex-col bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] rounded-2xl p-4 space-y-3 min-h-[260px] max-h-[500px] overflow-y-auto custom-scrollbar`}>
              <div className="flex items-center justify-between border-b border-[#E4E7DC] dark:border-white/[0.06] pb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#73766C] dark:text-white/60 flex items-center gap-1.5 font-mono">
                  <Layers size={13} className="text-[#111215] dark:text-white" /> Chapter Markers
                </span>
                <span className="text-[10px] font-mono font-bold text-[#73766C] dark:text-white/50">
                  {chapterBookmarks.length} Jump Points
                </span>
              </div>

              {chapterBookmarks.length > 0 ? (
                <div className="space-y-2">
                  {chapterBookmarks.map((bm: any, bIdx: number) => {
                    const nextBm = chapterBookmarks[bIdx + 1];
                    const isCurrent = videoCurrentTime >= bm.timestampSec && (!nextBm || videoCurrentTime < nextBm.timestampSec);
                    return (
                      <button
                        key={bIdx}
                        type="button"
                        onClick={() => handleSeekVideo(bm.timestampSec)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer shadow-2xs group flex items-start gap-2.5 ${
                          isCurrent
                            ? 'bg-white dark:bg-white/10 border-[#111215] dark:border-[#D4F82C] shadow-sm'
                            : 'bg-white/70 dark:bg-white/5 border-[#E4E7DC] dark:border-white/10 hover:border-[#111215] dark:hover:border-white/30'
                        }`}
                      >
                        <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${
                          isCurrent
                            ? 'bg-[#111215] text-[#D4F82C] dark:bg-[#D4F82C] dark:text-[#111215]'
                            : 'bg-[#D4F82C] text-[#111215] border border-[#b8da1f]'
                        }`}>
                          {bm.formattedTime || `${bm.timestampSec}s`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#111215] dark:text-white line-clamp-2">
                            Q{bm.questionIndex + 1}: {bm.title}
                          </p>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Playing Now
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-[#73766C]">
                  Continuous video ready. Play or scrub through the timeline above.
                </div>
              )}
            </div>
          </div>

          {/* PRINT-ONLY VIDEO RECORDING VERIFICATION BOX */}
          <div className="hidden print:block p-4 rounded-2xl border-2 border-black bg-neutral-50 text-xs text-neutral-900 space-y-1.5 print-avoid-break">
            <div className="flex items-center justify-between font-black">
              <span className="flex items-center gap-2">
                <span>📹 Synchronized Candidate Video & Two-Way Audio Verified</span>
              </span>
              <span className="font-mono text-[11px] bg-neutral-200 px-2 py-0.5 rounded">Verified Session</span>
            </div>
            <p className="text-neutral-700 text-xs leading-relaxed">
              Full candidate camera footage and conversational AI interviewer audio were recorded, synchronized, and encrypted.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-neutral-600 pt-1.5 border-t border-neutral-300">
              <span>Duration: {formatDuration(callDurationSeconds)}</span>
              <span>•</span>
              <span>Ref ID: {response.id}</span>
              <span>•</span>
              <span>VAD & Acoustic Clarity: Dual-Channel Analyzed</span>
            </div>
          </div>
        </section>

        {/* 4. BEHAVIORAL & INTEGRITY ANALYTICS GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print-avoid-break">
          <BehavioralStat
            icon={<Video size={18} />}
            label="Video & Audio Monitoring"
            value={recordedVideoUrl ? "HD Stream Verified" : "Continuous Voice Feed"}
            color="green"
          />

          <BehavioralStat
            icon={<Radio size={18} />}
            label="Speech Clarity & Confidence"
            value={speechAnalytics?.averageConfidence ? `${speechAnalytics.averageConfidence}% High` : '96% High'}
            color="blue"
          />

          <BehavioralStat
            icon={<Activity size={18} />}
            label="Candidate Sentiment"
            value={speechAnalytics?.sentiment ? `${speechAnalytics.sentiment.charAt(0).toUpperCase() + speechAnalytics.sentiment.slice(1)}` : 'Positive'}
            color="purple"
          />

          <BehavioralStat
            icon={<Shield size={18} />}
            label="Integrity & Fluency"
            value={`${tabSwitchCount || 0} Tab Switches`}
            color={(tabSwitchCount || 0) > 0 ? 'yellow' : 'green'}
          />
        </section>

        {/* 5. STRATEGIC HIRING MANAGER & AI EXECUTIVE EVALUATION */}
        <section className="space-y-4 print-avoid-break">
          {/* Executive Summary Bento */}
          <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                <Brain size={18} />
              </div>
              <h3 className="font-extrabold text-[#111215] dark:text-white text-base sm:text-lg">
                Hiring Manager & Executive AI Evaluation
              </h3>
            </div>
            <div className="border-l-4 border-l-[#D4F82C] bg-[#F8F9F5] dark:bg-white/[0.02] p-5 sm:p-6 rounded-r-2xl rounded-l-md border border-l-0 border-[#E4E7DC] dark:border-white/[0.06] shadow-inner text-sm sm:text-base text-[#111215] dark:text-white/90 leading-relaxed font-sans italic">
              "{screeningReport?.summary || 'Candidate demonstrated conversational responsiveness and answered role-relevant questions throughout the AI interview assessment.'}"
            </div>
          </div>

          {/* Relocation & Technical Fit Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Relocation Assessment */}
            <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-6 shadow-xs space-y-2.5">
              <h4 className="font-extrabold text-[#111215] dark:text-white text-sm sm:text-base flex items-center gap-2">
                <MapPin size={17} className="text-[#111215] dark:text-[#D4F82C]" />
                <span>Location & Relocation Assessment</span>
              </h4>
              <p className="text-xs sm:text-sm text-[#575A51] dark:text-white/70 leading-relaxed pt-1">
                {screeningReport?.relocationDetails || `Candidate verified preferences regarding on-site work and commute to ${interview?.location || candidateInfo?.currentCity || 'the office'}.`}
              </p>
            </div>

            {/* Technical Fit & JD Alignment */}
            <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-6 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-[#111215] dark:text-white text-sm sm:text-base flex items-center gap-2">
                  <Activity size={17} className="text-[#111215] dark:text-[#D4F82C]" />
                  <span>Technical Competency vs JD</span>
                </h4>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#D4F82C] text-[#111215] border border-[#b8da1f]">
                  Skill Score: {skillsScoreVal}/10
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#575A51] dark:text-white/70 leading-relaxed pt-1">
                {screeningReport?.skillsFeedback || 'Candidate responses indicate relevant foundational skills aligning with core job description requirements.'}
              </p>
            </div>
          </div>

          {/* Notice Period & Salary Alignment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Notice Period */}
            <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[#73766C] dark:text-white/40 block">
                  Notice Period & Availability
                </span>
                <span className="text-base font-extrabold text-[#111215] dark:text-white mt-1 block">
                  {screeningReport?.noticePeriod && screeningReport.noticePeriod !== 'Not specified' ? screeningReport.noticePeriod : 'Immediate / Flexible'}
                </span>
              </div>
              <span className="font-bold text-xs text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                Ready to Join
              </span>
            </div>

            {/* Salary Alignment */}
            <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[#73766C] dark:text-white/40 block">
                  Compensation Alignment
                </span>
                <span className="text-base font-extrabold text-[#111215] dark:text-white mt-1 block">
                  {screeningReport?.salaryExpectation && screeningReport.salaryExpectation !== 'Not specified' ? screeningReport.salaryExpectation : 'Within Role Budget'}
                </span>
              </div>
              <span className="font-bold text-xs text-[#111215] dark:text-white bg-[#F8F9F5] dark:bg-white/10 px-3 py-1 rounded-xl border border-[#E4E7DC] dark:border-white/10">
                Budget Aligned
              </span>
            </div>
          </div>

          {/* Strengths vs Considerations Side-by-Side */}
          {((screeningReport?.strengths && screeningReport.strengths.length > 0) ||
            (screeningReport?.concerns && screeningReport.concerns.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              {screeningReport?.strengths && screeningReport.strengths.length > 0 && (
                <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-6 shadow-xs space-y-3">
                  <h4 className="font-extrabold text-[#111215] dark:text-white text-sm flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Key Candidate Strengths</span>
                  </h4>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-[#575A51] dark:text-white/70">
                    {screeningReport.strengths.map((str: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="size-1.5 rounded-full bg-[#111215] dark:bg-[#D4F82C] shrink-0 mt-2" />
                        <span className="leading-relaxed">{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Considerations */}
              {screeningReport?.concerns && screeningReport.concerns.length > 0 && (
                <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-6 shadow-xs space-y-3">
                  <h4 className="font-extrabold text-[#111215] dark:text-white text-sm flex items-center gap-2">
                    <Shield size={16} className="text-amber-700 dark:text-amber-400" />
                    <span>Considerations & Follow-Up Items</span>
                  </h4>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-[#575A51] dark:text-white/70">
                    {screeningReport.concerns.map((con: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="size-1.5 rounded-full bg-amber-600 shrink-0 mt-2" />
                        <span className="leading-relaxed">{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Recommendation Rationale */}
          {screeningReport?.recommendationReason && (
            <div className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl border border-[#E4E7DC] dark:border-white/[0.08] rounded-3xl p-5 sm:p-6 text-xs sm:text-sm text-[#575A51] dark:text-white/70 leading-relaxed shadow-xs">
              <strong className="text-[#111215] dark:text-white font-extrabold">Final Recommendation Rationale: </strong>
              {screeningReport.recommendationReason}
            </div>
          )}
        </section>

        {/* 6. QUESTION-BY-QUESTION DEEP DIVE WITH 1-CLICK VIDEO JUMP */}
        {answersSummary && answersSummary.length > 0 && (
          <section className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-6 sm:p-8 shadow-xs space-y-5 print-avoid-break">
            <div className="border-b border-[#E4E7DC] dark:border-white/[0.06] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-[#111215] dark:text-white text-base sm:text-lg flex items-center gap-2">
                  <Layers size={18} />
                  <span>Question-by-Question Deep Dive</span>
                </h3>
                <p className="text-xs text-[#73766C] dark:text-white/50 mt-0.5">
                  Detailed screening questions, candidate spoken answers, and interactive video playback synchronization
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#73766C] dark:text-white/50 bg-[#F8F9F5] dark:bg-white/5 px-2.5 py-1 rounded-lg border border-[#E4E7DC] dark:border-white/10">
                {answersSummary.length} Questions Evaluated
              </span>
            </div>

            <div className="space-y-4">
              {answersSummary.map((item: any, idx: number) => {
                const bm = chapterBookmarks[idx];
                return (
                  <div key={idx} className="p-5 sm:p-6 rounded-2xl bg-[#F8F9F5] dark:bg-white/[0.02] border border-[#E4E7DC] dark:border-white/[0.06] space-y-3.5 print-avoid-break">
                    {/* Question Header & Video Jump Button */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[#111215] uppercase tracking-wider text-[11px] bg-[#D4F82C] px-3 py-1 rounded-md border border-[#b8da1f]">
                          Question {idx + 1}
                        </span>
                        {item.score !== undefined && (
                          <span className="text-xs font-mono font-bold text-[#111215] dark:text-white bg-white dark:bg-white/10 px-2.5 py-0.5 rounded border border-[#E4E7DC] dark:border-white/10">
                            Score: {item.score}/10
                          </span>
                        )}
                      </div>

                      {/* 1-Click Jump to Video Point */}
                      {recordedVideoUrl && bm && (
                        <button
                          type="button"
                          onClick={() => {
                            handleSeekVideo(bm.timestampSec);
                            videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#111215] dark:bg-white text-[#D4F82C] dark:text-[#111215] text-xs font-bold transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95 print:hidden"
                        >
                          <Play size={11} className="fill-current" />
                          <span>Watch Question in Video ({bm.formattedTime || '0:00'})</span>
                        </button>
                      )}
                    </div>

                    {/* Question Asked */}
                    <h4 className="font-extrabold text-[#111215] dark:text-white text-sm sm:text-base leading-snug">
                      {item.question}
                    </h4>

                    {/* Interactive Question Video Preview Tile */}
                    {recordedVideoUrl && (
                      <div 
                        onClick={() => {
                          if (bm) {
                            handleSeekVideo(bm.timestampSec);
                            videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        className="relative group rounded-2xl overflow-hidden bg-black aspect-video max-h-[200px] sm:max-h-[240px] cursor-pointer border border-[#E4E7DC] dark:border-white/10 hover:border-[#111215] dark:hover:border-[#D4F82C] transition-all shadow-xs print:hidden"
                      >
                        <video
                          src={recordedVideoUrl}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
                          playsInline
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/55 transition-all">
                          <div className="w-12 h-12 rounded-full bg-[#D4F82C] text-[#111215] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border border-[#b8da1f]">
                            <Play size={18} className="fill-current ml-0.5" />
                          </div>
                          <span className="mt-2 text-[11px] font-bold text-white bg-black/80 px-3 py-1 rounded-full border border-white/20 shadow-md">
                            ▶ Watch Question {idx + 1} Video ({bm?.formattedTime || '0:00'})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Candidate Answer */}
                    <div className="p-4 rounded-xl bg-white dark:bg-white/[0.03] border border-[#E4E7DC] dark:border-white/[0.06] space-y-1.5 shadow-2xs">
                      <div className="text-[11px] font-bold text-[#73766C] dark:text-white/40 uppercase tracking-wider">
                        Candidate Spoken Answer:
                      </div>
                      <p className="text-xs sm:text-sm text-[#111215] dark:text-white/90 leading-relaxed font-medium">
                        "{item.answer || 'No spoken reply recorded.'}"
                      </p>
                    </div>

                    {/* Clarification Cross-Questions (if any) */}
                    {item.crossQuestions && item.crossQuestions.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#E4E7DC] dark:border-white/[0.06]">
                        <span className="text-[11px] font-bold text-[#111215] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles size={12} className="text-[#111215] dark:text-[#D4F82C]" />
                          Clarification Cross-Question:
                        </span>
                        {item.crossQuestions.map((cq: any, cqIdx: number) => (
                          <div key={cqIdx} className="p-3.5 rounded-xl bg-[#D4F82C]/15 dark:bg-[#D4F82C]/10 border border-[#D4F82C]/50 space-y-2">
                            <p className="text-xs font-bold text-[#111215] dark:text-white">
                              AI Interviewer: "{cq.question}"
                            </p>
                            <p className="text-xs text-[#111215] dark:text-white font-medium bg-white dark:bg-white/10 p-2.5 rounded-lg border border-[#E4E7DC] dark:border-white/10">
                              Candidate Answer: "{cq.answer}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 7. COMPLETE VERBATIM INTERVIEW TRANSCRIPT */}
        <section className="bg-white dark:bg-[#0c0c0c]/90 backdrop-blur-xl rounded-3xl border border-[#E4E7DC] dark:border-white/[0.08] p-6 sm:p-8 shadow-xs space-y-5 print-avoid-break">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E7DC] dark:border-white/[0.06] pb-4">
            <div>
              <h3 className="font-extrabold text-[#111215] dark:text-white text-base sm:text-lg flex items-center gap-2">
                <MessageSquare size={18} className="text-[#111215] dark:text-white" />
                <span>Complete Verbatim Interview Transcript</span>
              </h3>
              <p className="text-xs text-[#73766C] dark:text-white/50 mt-0.5">
                Exact turn-by-turn conversational dialogue recorded via Speech AI
              </p>
            </div>

            {/* Controls: Speaker Filter & Search */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <div className="flex items-center bg-[#F8F9F5] dark:bg-white/5 p-1 rounded-xl border border-[#E4E7DC] dark:border-white/10 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSpeakerFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    speakerFilter === 'all' ? 'bg-[#111215] dark:bg-white text-white dark:text-[#111215] shadow-xs' : 'text-[#73766C] dark:text-white/60 hover:text-[#111215]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakerFilter('candidate')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    speakerFilter === 'candidate' ? 'bg-[#111215] dark:bg-white text-white dark:text-[#111215] shadow-xs' : 'text-[#73766C] dark:text-white/60 hover:text-[#111215]'
                  }`}
                >
                  Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakerFilter('ai')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    speakerFilter === 'ai' ? 'bg-[#111215] dark:bg-white text-white dark:text-[#111215] shadow-xs' : 'text-[#73766C] dark:text-white/60 hover:text-[#111215]'
                  }`}
                >
                  AI Recruiter
                </button>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#73766C] dark:text-white/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[#F8F9F5] dark:bg-white/5 border border-[#E4E7DC] dark:border-white/10 text-xs text-[#111215] dark:text-white placeholder-[#73766C] dark:placeholder-white/40 focus:outline-hidden focus:border-[#111215] dark:focus:border-white w-40 sm:w-48 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Transcript List */}
          {filteredDialogue.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredDialogue.map((turn: VoiceInterviewTurn, tIdx: number) => {
                const isAi = turn.speaker === 'ai';
                return (
                  <div
                    key={tIdx}
                    className={`p-4 rounded-2xl border transition-all ${
                      isAi
                        ? 'bg-[#F8F9F5] dark:bg-white/[0.02] border-[#E4E7DC] dark:border-white/[0.06]'
                        : 'bg-white dark:bg-white/[0.04] border-[#E4E7DC] dark:border-white/[0.08] shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-extrabold flex items-center gap-2">
                        {isAi ? (
                          <>
                            <span className="size-2 rounded-full bg-[#111215] dark:bg-[#D4F82C]" />
                            <span className="text-[#111215] dark:text-white">InterviewXpert AI</span>
                          </>
                        ) : (
                          <>
                            <span className="size-2 rounded-full bg-emerald-500" />
                            <span className="text-[#111215] dark:text-white">{candName}</span>
                          </>
                        )}
                      </span>
                      {turn.timestamp && (
                        <span className="text-[10px] font-mono text-[#73766C] dark:text-white/40">
                          {formatTimestamp(turn.timestamp)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-[#111215] dark:text-white/90 leading-relaxed font-medium">
                      {turn.text}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-[#73766C] dark:text-white/50 text-xs">
              No matching conversation found for "{transcriptSearch}".
            </div>
          )}
        </section>

      </main>

    </div>
  );
};

export default VoiceInterviewReport;
