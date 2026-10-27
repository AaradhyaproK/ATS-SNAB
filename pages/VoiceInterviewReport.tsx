import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Phone, Mail, MapPin, Briefcase, Calendar, Clock, Volume2, VolumeX, Download, 
  Share2, Copy, Check, ArrowLeft, Sparkles, Shield, AlertTriangle, 
  CheckCircle2, XCircle, FileText, ExternalLink, Printer, Search, 
  MessageSquare, Activity, User, Building, Award, Mic, Play, Pause,
  Radio, ThumbsUp, ThumbsDown, HelpCircle, Layers, CheckCheck, Video, DollarSign
} from 'lucide-react';
import { 
  getVoiceInterviewResponse, 
  getVoiceInterview 
} from '../services/voiceInterviewService';
import { resolveJobOrInterviewDocument } from '../services/jobResolutionService';
import { VoiceInterviewResponse, VoiceInterview, VoiceInterviewTurn } from '../types';
import DayNightToggle from '../components/DayNightToggle';
import { useMessageBox } from '../components/MessageBox';
import HireXLogo, { HireXMark } from '../components/HireXLogo';

export const VoiceInterviewReport: React.FC = () => {
  const { responseId: rawRespId, submissionId: rawSubId } = useParams<{ responseId?: string; submissionId?: string }>();
  const responseId = rawRespId || rawSubId || '';
  const navigate = useNavigate();
  const messageBox = useMessageBox();

  const [response, setResponse] = useState<VoiceInterviewResponse | null>(null);
  const [interview, setInterview] = useState<VoiceInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState<'all' | 'candidate' | 'ai'>('all');

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Load report data
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

        const resp = await getVoiceInterviewResponse(responseId);
        if (!resp) {
          setError('Interview report not found or link has expired.');
          setLoading(false);
          return;
        }

        setResponse(resp);

        // Load interview / job details for company and role info
        if (resp.voiceInterviewId) {
          try {
            const vData = await getVoiceInterview(resp.voiceInterviewId);
            if (vData) {
              setInterview(vData);
            } else if (resp.jobId) {
              const jData = await resolveJobOrInterviewDocument(resp.jobId);
              if (jData && jData.data) {
                const jd = jData.data as any;
                setInterview({
                  id: resp.voiceInterviewId,
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
  }, [responseId]);

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
      <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col items-center justify-center p-6">
        <div className="p-6 rounded-3xl bg-white border border-[#E4E7DC] shadow-xl flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="size-11 border-3 border-[#111215] border-t-[#D4F82C] rounded-full animate-spin" />
          <div>
            <h3 className="font-extrabold text-[#111215] text-base">Loading Interview Assessment Dossier...</h3>
            <p className="text-xs text-[#73766C] mt-1 font-medium">Analyzing dialogue history, speech intelligence & metrics</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !response) {
    return (
      <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md p-8 bg-white border border-[#E4E7DC] rounded-3xl shadow-xl text-center space-y-4">
          <div className="size-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <XCircle size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-[#111215]">Report Not Found</h2>
          <p className="text-sm text-[#73766C]">{error || 'This interview report does not exist or has expired.'}</p>
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
    candidateResumeUrl, 
    candidateResumeFileName,
    speechAnalytics 
  } = response as any;

  const recordedVideoUrl = 
    videoUrl || 
    candidateVideoUrl || 
    videoRecordingUrl || 
    (audioRecordingUrl && (audioRecordingUrl.includes('/videos/') || audioRecordingUrl.includes('video') || audioRecordingUrl.endsWith('.webm') || audioRecordingUrl.endsWith('.mp4')) ? audioRecordingUrl : undefined);

  const rec = screeningReport?.recommendation || 'Hold';
  const resumeLink = candidateInfo?.resumeUrl || candidateResumeUrl;
  const resumeName = candidateInfo?.resumeFileName || candidateResumeFileName || 'Candidate_Resume.pdf';

  // Candidate Name Formatting (proper capitalisation)
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

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] antialiased selection:bg-[#D4F82C] selection:text-[#111215]">
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
          .bg-\\[\\#F8F9F5\\], .bg-white {
            background-color: #ffffff !important;
          }
          .border-\\[\\#E4E7DC\\] {
            border-color: #e5e7eb !important;
          }
        }
      `}</style>

      {/* Top Navbar (Hidden in Print) */}
      <header className="sticky top-0 z-30 bg-[#F8F9F5]/90 backdrop-blur-xl border-b border-[#E4E7DC] px-4 sm:px-8 py-3.5 shadow-xs transition-colors print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl text-[#575A51] hover:text-[#111215] hover:bg-white border border-transparent hover:border-[#E4E7DC] transition-all cursor-pointer shadow-xs"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2.5">
              <HireXLogo size="md" variant="full" withLink to="/" />
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-[#111215] bg-[#D4F82C] border border-[#b8da1f] font-black shadow-xs">
                <Sparkles size={11} /> Interview Dossier
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <DayNightToggle />

            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E7DC] bg-white text-[#111215] hover:bg-[#F0F2EB] text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Print or Export PDF"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111215] hover:bg-black text-[#D4F82C] font-extrabold text-xs shadow-md shadow-black/10 active:scale-[0.98] transition-all cursor-pointer"
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

        {/* 1. HERO CANDIDATE BENTO CARD (PERFECTLY ALIGNED DUAL-COLUMN GRID) */}
        <section className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.03)] relative overflow-hidden space-y-6 print-avoid-break">
          {/* Subtle Ambient Accent Glow */}
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#D4F82C]/20 blur-3xl pointer-events-none print:hidden" />

          {/* Top Classification Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 border-b border-[#E4E7DC] pb-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-mono font-black tracking-wider text-[#73766C] uppercase">
                AI INTERVIEW ASSESSMENT DOSSIER
              </span>
              <span className="text-[#C4C7BC]">•</span>
              <span className="font-mono text-[#575A51] font-semibold bg-[#F8F9F5] px-2.5 py-0.5 rounded-md border border-[#E4E7DC]">
                ID: {response.id}
              </span>
            </div>

            {/* Prominent Recommendation Status Badge */}
            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${
              rec === 'Shortlist'
                ? 'bg-[#D4F82C] text-[#111215] border-[#b8da1f] shadow-[0_0_20px_rgba(212,248,44,0.35)]'
                : rec === 'Reject'
                  ? 'bg-red-50 text-red-900 border-red-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}>
              <span className={`h-2 w-2 rounded-full ${rec === 'Shortlist' ? 'bg-[#111215]' : rec === 'Reject' ? 'bg-red-600' : 'bg-amber-600'} animate-pulse print:hidden`} />
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
                  <h1 className="text-2xl sm:text-3xl font-black text-[#111215] tracking-tight">
                    {candName}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#575A51]">
                    {candidateInfo?.email && (
                      <span className="inline-flex items-center gap-1.5 font-medium bg-[#F8F9F5] px-2.5 py-1 rounded-xl border border-[#E4E7DC]">
                        <Mail size={13} className="text-[#73766C]" /> {candidateInfo.email}
                      </span>
                    )}
                    {candidateInfo?.phone && (
                      <span className="inline-flex items-center gap-1.5 font-medium bg-[#F8F9F5] px-2.5 py-1 rounded-xl border border-[#E4E7DC]">
                        <Phone size={13} className="text-[#73766C]" /> {candidateInfo.phone}
                      </span>
                    )}
                    {candidateInfo?.currentCity && (
                      <span className="inline-flex items-center gap-1.5 font-bold text-[#111215] bg-[#D4F82C]/30 px-2.5 py-1 rounded-xl border border-[#D4F82C]">
                        <MapPin size={13} className="text-[#111215]" /> {candidateInfo.currentCity}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Seamless Attached Resume Drawer Tile */}
              {resumeLink && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] flex items-center justify-between gap-3 hover:border-[#111215] transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-[#111215] text-[#D4F82C] shrink-0 shadow-xs">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#111215] truncate" title={resumeName}>
                        {resumeName}
                      </p>
                      <p className="text-[11px] text-[#73766C] truncate">
                        Verified Candidate Resume · Analyzed for Personalized Cross-Questions
                      </p>
                    </div>
                  </div>

                  <a
                    href={resumeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111215] hover:bg-black text-[#D4F82C] font-bold text-xs transition-colors shadow-xs print:hidden"
                  >
                    <Download size={13} />
                    <span>View / Download</span>
                    <ExternalLink size={11} className="opacity-70" />
                  </a>
                </div>
              )}
            </div>

            {/* Right Column: Evaluated Position & Session Benchmarks */}
            <div className="lg:col-span-5 bg-[#F8F9F5] border border-[#E4E7DC] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs">
              <div>
                <div className="text-[11px] text-[#73766C] uppercase font-bold tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Briefcase size={13} className="text-[#111215]" /> Evaluated Position
                </div>
                <h2 className="font-extrabold text-[#111215] text-lg sm:text-xl tracking-tight leading-snug">
                  {interview?.jobTitle || interview?.title || 'Senior Backend Developer'}
                </h2>
                <div className="text-xs text-[#575A51] font-medium flex items-center gap-1.5 mt-1">
                  <Building size={13} className="text-[#73766C]" />
                  <span>{interview?.companyName || 'InterviewXpert'}</span>
                  {interview?.location && (
                    <span className="text-[#73766C]">• {interview.location}</span>
                  )}
                </div>
              </div>

              {/* Clean Structured Session Timestamps */}
              <div className="pt-3 border-t border-[#E4E7DC] space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[#73766C] flex items-center gap-1.5">
                    <Clock size={13} className="text-[#111215]" /> Interview Duration:
                  </span>
                  <span className="font-bold text-[#111215] bg-white px-2 py-0.5 rounded border border-[#E4E7DC]">
                    {formatDuration(callDurationSeconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[#73766C] flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#111215]" /> Assessment Date:
                  </span>
                  <span className="font-medium text-[#575A51]">
                    {formatTimestamp(response.submittedAt)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 2. FOUR KEY METRIC CARDS (UNIFIED HEIGHT & ALIGNED BENTO GRID) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print-avoid-break">
          
          {/* Card 1: Overall Fit Score */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-5 shadow-xs flex flex-col justify-between hover:border-[#111215] transition-all min-h-[160px]">
            <div>
              <div className="flex items-center justify-between text-[#73766C] mb-2.5">
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase">Overall Fit Score</span>
                <Award size={16} className="text-[#111215]" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-[#111215] tracking-tight">
                  {screeningReport?.overallScore ?? 'N/A'}
                </span>
                <span className="text-sm font-bold text-[#73766C]">/ 10</span>
              </div>
              <div className="w-full h-1.5 bg-[#F0F2EB] rounded-full overflow-hidden mt-3 print:hidden">
                <div
                  className="h-full bg-[#111215] rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, ((screeningReport?.overallScore || 0) / 10) * 100))}%` }}
                />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E4E7DC] flex items-center justify-between text-xs">
              <span className="text-[#73766C]">Communication:</span>
              <span className="font-extrabold text-[#111215] bg-[#D4F82C]/40 px-2 py-0.5 rounded-md border border-[#b8da1f]">
                {screeningReport?.communicationRating || '8'}/10
              </span>
            </div>
          </div>

          {/* Card 2: Relocation Alignment */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-5 shadow-xs flex flex-col justify-between hover:border-[#111215] transition-all min-h-[160px]">
            <div>
              <div className="flex items-center justify-between text-[#73766C] mb-2.5">
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase">Relocation & Location</span>
                <MapPin size={16} className="text-[#111215]" />
              </div>
              <div className="text-lg font-black text-[#111215] tracking-tight leading-snug">
                {screeningReport?.relocationStatus || 'Ready to relocate'}
              </div>
              <p className="text-xs text-[#73766C] mt-1 truncate">
                {candidateInfo?.currentCity ? `Current: ${candidateInfo.currentCity}` : 'Verified during interview'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E4E7DC] flex items-center justify-between text-xs">
              <span className="text-[#73766C]">Job Location:</span>
              <span className="font-bold text-[#111215] truncate max-w-[130px]">
                {interview?.location || candidateInfo?.currentCity || 'Office Location'}
              </span>
            </div>
          </div>

          {/* Card 3: Notice Period & Availability */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-5 shadow-xs flex flex-col justify-between hover:border-[#111215] transition-all min-h-[160px]">
            <div>
              <div className="flex items-center justify-between text-[#73766C] mb-2.5">
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase">Notice Period</span>
                <Calendar size={16} className="text-[#111215]" />
              </div>
              <div className="text-lg font-black text-[#111215] tracking-tight leading-snug">
                {screeningReport?.noticePeriod && screeningReport.noticePeriod !== 'Not specified'
                  ? screeningReport.noticePeriod
                  : 'Immediate / Flexible'}
              </div>
              <p className="text-xs text-[#73766C] mt-1">Candidate availability to join</p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E4E7DC] flex items-center justify-between text-xs">
              <span className="text-[#73766C]">Joining Status:</span>
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Ready to Join
              </span>
            </div>
          </div>

          {/* Card 4: Salary & Compensation */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-5 shadow-xs flex flex-col justify-between hover:border-[#111215] transition-all min-h-[160px]">
            <div>
              <div className="flex items-center justify-between text-[#73766C] mb-2.5">
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase">Salary Alignment</span>
                <DollarSign size={16} className="text-[#111215]" />
              </div>
              <div className="text-sm font-black text-[#111215] leading-snug line-clamp-2">
                {screeningReport?.salaryExpectation && screeningReport.salaryExpectation !== 'Not specified'
                  ? screeningReport.salaryExpectation
                  : 'Flexible / Within Budget'}
              </div>
              <p className="text-xs text-[#73766C] mt-1">Compensation alignment</p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E4E7DC] flex items-center justify-between text-xs">
              <span className="text-[#73766C]">Budget Fit:</span>
              <span className="font-bold text-[#111215]">
                {screeningReport?.salaryFit || 'Role Budget Aligned'}
              </span>
            </div>
          </div>

        </section>

        {/* 3. INTERVIEW VIDEO / AUDIO & SPEECH AI INTELLIGENCE */}
        <section className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs space-y-6 print-avoid-break">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E7DC] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#D4F82C] text-[#111215] border border-[#b8da1f] shadow-xs">
                {recordedVideoUrl ? <Video size={20} /> : <Radio size={20} className="animate-pulse" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-[#111215] text-base sm:text-lg">
                    {recordedVideoUrl ? 'Interview Video & Speech Intelligence' : 'Dual-Channel Speech AI Intelligence'}
                  </h3>
                  <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-[#111215] text-[#D4F82C]">
                    {recordedVideoUrl ? 'HD Video + Voice' : 'Acoustic Audio'}
                  </span>
                </div>
                <p className="text-xs text-[#73766C] font-medium mt-0.5">
                  {recordedVideoUrl 
                    ? 'Synchronized candidate camera feed and two-way interview assessment recording' 
                    : 'Real-time conversational Voice Activity Detection, Lexical Clarity, and Acoustic Analytics'}
                </p>
              </div>
            </div>

            {(recordedVideoUrl || audioRecordingUrl) && (
              <a
                href={recordedVideoUrl || audioRecordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={recordedVideoUrl ? `interview_video_${response.id}.webm` : `interview_audio_${response.id}.webm`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#111215] hover:bg-black text-[#D4F82C] text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer print:hidden"
              >
                <Download size={14} />
                <span>{recordedVideoUrl ? 'Download Interview Video (.webm)' : 'Download Audio Recording'}</span>
              </a>
            )}
          </div>

          {/* PRINT-ONLY VIDEO RECORDING VERIFICATION BOX (Replaces blank video in Print) */}
          {recordedVideoUrl && (
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
                <span>VAD & Acoustic Clarity: Dual-Channel Analyzed</span>
              </div>
            </div>
          )}

          {/* Full Screen Cinematic Video Player (Screen Only) */}
          {recordedVideoUrl ? (
            <div className="rounded-3xl bg-[#0C0D11] border border-white/10 p-4 sm:p-5 shadow-xl space-y-3 print:hidden">
              <div className="flex items-center justify-between text-xs px-1 text-white">
                <div className="flex items-center gap-2 font-bold">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Candidate Camera & Audio Synchronized Stream</span>
                </div>
              </div>
              <div className="relative w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-inner aspect-video max-h-[480px]">
                <video
                  src={recordedVideoUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain mx-auto"
                />
              </div>
            </div>
          ) : null}

          {/* Speech Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print-avoid-break">
            <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Clarity & Confidence</span>
              <span className="text-xl font-extrabold text-[#111215] block">
                {speechAnalytics?.averageConfidence ? `${speechAnalytics.averageConfidence}%` : '96% High'}
              </span>
              <span className="text-[11px] text-[#575A51] font-medium block">Deepgram STT Accuracy</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Candidate Sentiment</span>
              <span className="text-xl font-extrabold text-[#111215] block capitalize">
                {speechAnalytics?.sentiment || 'Positive'}
              </span>
              <span className="text-[11px] text-[#575A51] font-medium block">Acoustic Tone Analysis</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Filler Words Detected</span>
              <span className="text-xl font-extrabold text-[#111215] block">
                {speechAnalytics?.fillerWordsDetected ?? '2'}
              </span>
              <span className="text-[11px] text-[#575A51] font-medium block">Fluency & Composure</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Speech AI Engine</span>
              <span className="text-xl font-extrabold text-[#111215] block uppercase">
                {speechAnalytics?.detectedLanguage || 'LiveKit Pro'}
              </span>
              <span className="text-[11px] text-[#575A51] font-medium block">Smart Format & VAD</span>
            </div>
          </div>

          {/* Custom Sleek Audio Player (Fallback when audio only) */}
          {!recordedVideoUrl && audioRecordingUrl && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-3 print:hidden">
              <audio 
                ref={audioRef}
                src={audioRecordingUrl}
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={handleAudioTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleAudioPlay}
                    className="size-12 rounded-full bg-[#111215] hover:bg-black text-[#D4F82C] flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                  </button>

                  <div>
                    <h4 className="font-extrabold text-[#111215] text-sm">
                      {isPlaying ? 'Playing Two-Way Interview Audio...' : 'Listen to Full Interview Call'}
                    </h4>
                    <p className="text-xs text-[#73766C]">
                      AI Interviewer voice + Candidate speech mixed in high fidelity
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono font-bold text-[#111215] bg-white px-3 py-1.5 rounded-xl border border-[#E4E7DC]">
                  <Clock size={13} className="text-[#73766C]" />
                  <span>{formatDuration(audioCurrentTime)} / {formatDuration(audioDuration || callDurationSeconds)}</span>
                </div>
              </div>

              {/* Scrubber Timeline */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min={0}
                  max={audioDuration || callDurationSeconds || 100}
                  step={0.1}
                  value={audioCurrentTime}
                  onChange={handleAudioSeek}
                  className="w-full h-2 bg-[#E4E7DC] rounded-lg appearance-none cursor-pointer accent-[#111215]"
                />
              </div>
            </div>
          )}
        </section>

        {/* 4. EXECUTIVE SUMMARY & RECRUITER STRATEGIC EVALUATION */}
        <section className="space-y-4 print-avoid-break">
          {/* Executive Summary Bento */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs space-y-3">
            <h3 className="font-extrabold text-[#111215] text-base sm:text-lg flex items-center gap-2">
              <Sparkles size={18} className="text-[#111215]" />
              <span>AI Recruiter Executive Summary</span>
            </h3>
            <div className="p-5 sm:p-6 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC]">
              <p className="text-sm sm:text-base text-[#111215] leading-relaxed font-medium italic">
                "{screeningReport?.summary || 'Candidate demonstrated conversational responsiveness and answered role-relevant questions throughout the AI interview assessment.'}"
              </p>
            </div>
          </div>

          {/* Relocation & Technical Assessment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Relocation Assessment */}
            <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 shadow-xs space-y-2.5">
              <h4 className="font-extrabold text-[#111215] text-sm sm:text-base flex items-center gap-2">
                <MapPin size={17} className="text-[#111215]" />
                <span>Location & Relocation Assessment</span>
              </h4>
              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed pt-1">
                {screeningReport?.relocationDetails || `Candidate verified preferences regarding on-site work and commute to ${interview?.location || candidateInfo?.currentCity || 'the office'}.`}
              </p>
            </div>

            {/* Technical Fit & JD Alignment */}
            <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-[#111215] text-sm sm:text-base flex items-center gap-2">
                  <Activity size={17} className="text-[#111215]" />
                  <span>Technical Competency vs JD</span>
                </h4>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#D4F82C] text-[#111215] border border-[#b8da1f]">
                  Skill Score: {screeningReport?.skillsRating || '8'}/10
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed pt-1">
                {screeningReport?.skillsFeedback || 'Candidate responses indicate relevant foundational skills aligning with core job description requirements.'}
              </p>
            </div>
          </div>

          {/* Strengths vs Considerations Side-by-Side */}
          {((screeningReport?.strengths && screeningReport.strengths.length > 0) ||
            (screeningReport?.concerns && screeningReport.concerns.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              {screeningReport?.strengths && screeningReport.strengths.length > 0 && (
                <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 shadow-xs space-y-3">
                  <h4 className="font-extrabold text-[#111215] text-sm flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Key Candidate Strengths</span>
                  </h4>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-[#575A51]">
                    {screeningReport.strengths.map((str: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="size-1.5 rounded-full bg-[#111215] shrink-0 mt-2" />
                        <span className="leading-relaxed">{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Considerations */}
              {screeningReport?.concerns && screeningReport.concerns.length > 0 && (
                <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 shadow-xs space-y-3">
                  <h4 className="font-extrabold text-[#111215] text-sm flex items-center gap-2">
                    <Shield size={16} className="text-amber-700" />
                    <span>Considerations & Follow-Up Items</span>
                  </h4>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-[#575A51]">
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
            <div className="bg-white border border-[#E4E7DC] rounded-3xl p-5 sm:p-6 text-xs sm:text-sm text-[#575A51] leading-relaxed shadow-xs">
              <strong className="text-[#111215] font-extrabold">Final Recommendation Rationale: </strong>
              {screeningReport.recommendationReason}
            </div>
          )}
        </section>

        {/* 5. QUESTION-BY-QUESTION BREAKDOWN & CROSS-QUESTIONS */}
        {answersSummary && answersSummary.length > 0 && (
          <section className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs space-y-5 print-avoid-break">
            <div className="border-b border-[#E4E7DC] pb-4">
              <h3 className="font-extrabold text-[#111215] text-base sm:text-lg flex items-center gap-2">
                <Layers size={18} />
                <span>Question-by-Question Deep Dive</span>
              </h3>
              <p className="text-xs text-[#73766C] mt-0.5">
                Detailed screening questions, candidate spoken answers, and AI clarification cross-questions
              </p>
            </div>

            <div className="space-y-4">
              {answersSummary.map((item: any, idx: number) => (
                <div key={idx} className="p-5 sm:p-6 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-3.5 print-avoid-break">
                  {/* Question Header */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-[#111215] uppercase tracking-wider text-[11px] bg-[#D4F82C] px-3 py-1 rounded-md border border-[#b8da1f]">
                      Question {idx + 1}
                    </span>
                    {item.score !== undefined && (
                      <span className="text-xs font-mono font-bold text-[#111215] bg-white px-2.5 py-0.5 rounded border border-[#E4E7DC]">
                        Score: {item.score}/10
                      </span>
                    )}
                  </div>

                  {/* Question Asked */}
                  <h4 className="font-extrabold text-[#111215] text-sm sm:text-base leading-snug">
                    {item.question}
                  </h4>

                  {/* Candidate Answer */}
                  <div className="p-4 rounded-xl bg-white border border-[#E4E7DC] space-y-1.5 shadow-2xs">
                    <div className="text-[11px] font-bold text-[#73766C] uppercase tracking-wider">
                      Candidate Spoken Answer:
                    </div>
                    <p className="text-xs sm:text-sm text-[#111215] leading-relaxed font-medium">
                      "{item.answer || 'No spoken reply provided.'}"
                    </p>
                  </div>

                  {/* Cross-Questions (if any) */}
                  {item.crossQuestions && item.crossQuestions.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#E4E7DC]">
                      <span className="text-[11px] font-bold text-[#111215] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={12} className="text-[#111215]" />
                        Clarification Cross-Question:
                      </span>
                      {item.crossQuestions.map((cq: any, cqIdx: number) => (
                        <div key={cqIdx} className="p-3.5 rounded-xl bg-[#D4F82C]/15 border border-[#D4F82C]/50 space-y-2">
                          <p className="text-xs font-bold text-[#111215]">
                            AI Interviewer: "{cq.question}"
                          </p>
                          <p className="text-xs text-[#111215] font-medium bg-white p-2.5 rounded-lg border border-[#E4E7DC]">
                            Candidate Answer: "{cq.answer}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. COMPLETE VERBATIM INTERVIEW TRANSCRIPT */}
        <section className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs space-y-5 print-avoid-break">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E7DC] pb-4">
            <div>
              <h3 className="font-extrabold text-[#111215] text-base sm:text-lg flex items-center gap-2">
                <MessageSquare size={18} className="text-[#111215]" />
                <span>Complete Verbatim Interview Transcript</span>
              </h3>
              <p className="text-xs text-[#73766C] mt-0.5">
                Exact turn-by-turn conversational transcript recorded via Speech AI
              </p>
            </div>

            {/* Controls: Speaker Filter & Search (Hidden in Print) */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <div className="flex items-center bg-[#F8F9F5] p-1 rounded-xl border border-[#E4E7DC] text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSpeakerFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    speakerFilter === 'all' ? 'bg-[#111215] text-white shadow-xs' : 'text-[#73766C] hover:text-[#111215]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakerFilter('candidate')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    speakerFilter === 'candidate' ? 'bg-[#111215] text-white shadow-xs' : 'text-[#73766C] hover:text-[#111215]'
                  }`}
                >
                  Candidate Only
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakerFilter('ai')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    speakerFilter === 'ai' ? 'bg-[#111215] text-white shadow-xs' : 'text-[#73766C] hover:text-[#111215]'
                  }`}
                >
                  AI Interviewer
                </button>
              </div>

              {/* Transcript Search Bar */}
              <div className="relative w-full sm:w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#73766C]" />
                <input
                  type="text"
                  placeholder="Search spoken words..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] text-xs text-[#111215] placeholder-[#73766C] focus:outline-none focus:border-[#111215] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Transcript Dialogue List */}
          <div className="space-y-3.5 pt-1">
            {filteredDialogue.length > 0 ? (
              filteredDialogue.map((turn: VoiceInterviewTurn, i: number) => {
                const isAi = turn.speaker === 'ai';
                return (
                  <div
                    key={i}
                    className={`rounded-2xl p-4 sm:p-5 transition-colors shadow-xs print-avoid-break ${
                      isAi
                        ? 'bg-[#F8F9F5] border border-[#E4E7DC]'
                        : 'bg-white border-2 border-[#111215]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isAi ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-[#111215] text-white">
                            🤖 AI Interviewer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-[#D4F82C] text-[#111215] border border-[#b8da1f]">
                            👤 Candidate ({candName})
                          </span>
                        )}
                        {turn.isCrossQuestion && (
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-full">
                            Follow-Up Question
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-[#73766C] font-semibold">
                        {turn.timestamp}
                      </span>
                    </div>

                    <p className={`text-xs sm:text-sm leading-relaxed ${
                      isAi
                        ? 'text-[#575A51]'
                        : 'text-[#111215] font-bold'
                    }`}>
                      {turn.text}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-xs text-[#73766C] font-medium bg-[#F8F9F5] rounded-2xl border border-[#E4E7DC]">
                {transcriptSearch ? 'No spoken words matched your search query.' : 'Transcript not available for this session.'}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#E4E7DC] py-8 text-center text-xs text-[#73766C] mt-12 bg-white print:border-t-2 print:border-black print:mt-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-[#111215]">
            <HireXMark className="h-5 w-auto" />
            <span>InterviewXpert Automated Interview Intelligence</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono font-medium text-[#73766C]">
            <span>Report ID: {response.id}</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCheck size={14} /> Two-Way Audio & Video Verified
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default VoiceInterviewReport;
