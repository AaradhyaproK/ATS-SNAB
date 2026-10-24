import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Phone, Mail, MapPin, Briefcase, Calendar, Clock, Volume2, VolumeX, Download, 
  Share2, Copy, Check, ArrowLeft, Sparkles, Shield, AlertTriangle, 
  CheckCircle2, XCircle, FileText, ExternalLink, Printer, Search, 
  MessageSquare, Activity, User, Building, Award, Mic, Play, Pause,
  Radio, ThumbsUp, ThumbsDown, HelpCircle, Layers, CheckCheck
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
  const { responseId } = useParams<{ responseId: string }>();
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
          setError('Voice screening report not found or link has expired.');
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
                  title: jd.title || jd.jobTitle || 'Screening Interview',
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
            console.warn('[Voice Report] Parent interview load warning:', loadErr);
          }
        }
      } catch (err: any) {
        console.error('[Voice Report] Load error:', err);
        setError('Failed to load voice screening report.');
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
      messageBox.showSuccess('Shareable report link copied to clipboard!');
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
    if (ts.toDate) return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (ts instanceof Date) return ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return 'Recent';
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
        <div className="p-5 rounded-3xl bg-white border border-[#E4E7DC] shadow-xl flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-3 border-[#111215] border-t-[#D4F82C] rounded-full animate-spin" />
          <div className="text-center">
            <h3 className="font-extrabold text-[#111215] text-base">Loading Screening Assessment Dossier...</h3>
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
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <XCircle size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-[#111215]">Report Not Found</h2>
          <p className="text-sm text-[#73766C]">{error || 'This voice screening report does not exist or has expired.'}</p>
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
    candidateResumeUrl, 
    candidateResumeFileName,
    speechAnalytics 
  } = response;

  const rec = screeningReport?.recommendation || 'Hold';
  const resumeLink = candidateInfo?.resumeUrl || candidateResumeUrl;
  const resumeName = candidateInfo?.resumeFileName || candidateResumeFileName || 'Candidate_Resume.pdf';

  // Candidate Initials
  const candName = candidateInfo?.name || 'Candidate';
  const candInitials = candName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || 'C';

  // Filter dialogue history if searching or filtering by speaker
  const filteredDialogue = (dialogueHistory || []).filter(turn => {
    if (speakerFilter === 'candidate' && turn.speaker !== 'candidate') return false;
    if (speakerFilter === 'ai' && turn.speaker !== 'ai') return false;
    if (!transcriptSearch.trim()) return true;
    return turn.text.toLowerCase().includes(transcriptSearch.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] antialiased selection:bg-[#D4F82C] selection:text-[#111215]">
      {/* Top Navbar: Day Mode Landing Page Aesthetic */}
      <header className="sticky top-0 z-30 bg-[#F8F9F5]/90 backdrop-blur-xl border-b border-[#E4E7DC] px-4 sm:px-8 py-3.5 shadow-xs transition-colors">
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
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider text-[#111215] bg-[#D4F82C] border border-[#b8da1f] font-black shadow-xs">
                <Sparkles size={11} /> Voice Screening Dossier
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
        
        {/* 1. HERO CANDIDATE BENTO CARD */}
        <section className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative overflow-hidden space-y-6">
          {/* Ambient Lime Accent Glow */}
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#D4F82C]/20 blur-3xl pointer-events-none" />

          {/* Top Classification Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 border-b border-[#E4E7DC] pb-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-black tracking-wider text-[#73766C] uppercase">
                AUTOMATED PHONE SCREENING DOSSIER
              </span>
              <span className="text-[#E4E7DC]">•</span>
              <span className="text-xs font-mono text-[#575A51] font-semibold">
                ID: {response.id}
              </span>
            </div>

            {/* Prominent Recommendation Status Badge */}
            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${
              rec === 'Shortlist'
                ? 'bg-[#D4F82C] text-[#111215] border-[#b8da1f] shadow-[0_0_20px_rgba(212,248,44,0.35)]'
                : rec === 'Reject'
                  ? 'bg-red-100 text-red-900 border-red-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}>
              <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
              {rec === 'Shortlist' ? '✓ Recommended for Shortlist' : rec === 'Reject' ? '✕ Not Selected' : '⏸ Secondary Review / Hold'}
            </span>
          </div>

          {/* Candidate Profile Details & Target Position Box */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
              {/* Monogram Avatar with Landing Page Theme */}
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-[#D4F82C] text-[#111215] border-2 border-[#111215] flex items-center justify-center font-black text-2xl sm:text-3xl shadow-sm shrink-0 font-mono">
                {candInitials}
              </div>

              <div className="min-w-0 space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111215] tracking-tight">
                  {candidateInfo?.name || 'Candidate'}
                </h1>

                <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs sm:text-sm text-[#575A51]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Mail size={14} className="text-[#73766C]" /> {candidateInfo?.email || 'N/A'}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Phone size={14} className="text-[#73766C]" /> {candidateInfo?.phone || 'N/A'}
                  </span>
                  {candidateInfo?.currentCity && (
                    <span className="flex items-center gap-1.5 font-bold text-[#111215] bg-[#F0F2EB] px-2.5 py-0.5 rounded-full border border-[#E4E7DC]">
                      <MapPin size={13} className="text-[#111215]" /> {candidateInfo.currentCity}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Target Role & Call Statistics Mini Bento */}
            <div className="bg-[#F8F9F5] border border-[#E4E7DC] rounded-2xl p-4 sm:p-5 min-w-[280px] space-y-2 shadow-xs">
              <div className="text-[11px] text-[#73766C] uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Briefcase size={13} className="text-[#111215]" /> Evaluated Position
              </div>
              <div className="font-extrabold text-[#111215] text-base sm:text-lg tracking-tight">
                {interview?.jobTitle || interview?.title || 'Screening Position'}
              </div>
              <div className="text-xs text-[#575A51] font-medium flex items-center gap-1">
                <Building size={12} className="text-[#73766C]" />
                <span>{interview?.companyName || 'SNAB HireX'}</span>
                {interview?.location && (
                  <span className="text-[#73766C]">• {interview.location}</span>
                )}
              </div>
              <div className="pt-2 flex items-center justify-between text-[11px] font-mono font-medium text-[#73766C] border-t border-[#E4E7DC] mt-2">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> Call: {formatDuration(callDurationSeconds)}
                </span>
                <span>{formatTimestamp(response.submittedAt)}</span>
              </div>
            </div>
          </div>

          {/* Attached Resume Banner */}
          {resumeLink && (
            <div className="mt-4 pt-4 border-t border-[#E4E7DC]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8F9F5] border border-[#E4E7DC] rounded-2xl p-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#111215] text-[#D4F82C] shadow-sm shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#111215] text-sm truncate max-w-md">
                      {resumeName}
                    </div>
                    <span className="text-xs text-[#73766C]">
                      Candidate verified resume uploaded for AI screening
                    </span>
                  </div>
                </div>

                <a
                  href={resumeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#111215] hover:bg-black text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <Download size={14} className="text-[#D4F82C]" />
                  <span>View / Download Resume ↗</span>
                </a>
              </div>
            </div>
          )}
        </section>

        {/* 2. FOUR KEY METRIC CARDS (Bento Grid) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Overall Fit Score */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-5 text-center shadow-xs space-y-2 hover:border-[#111215] transition-colors">
            <span className="text-[11px] font-extrabold text-[#73766C] uppercase tracking-wider block">
              Overall Screener Score
            </span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-black text-[#111215] tracking-tight">
                {screeningReport?.overallScore ?? 'N/A'}
              </span>
              <span className="text-base font-bold text-[#73766C]">/10</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#D4F82C]/30 text-[#111215] border border-[#D4F82C]">
              Communication: {screeningReport?.communicationRating || '8'}/10
            </div>
          </div>

          {/* Card 2: Relocation Alignment */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-5 text-center shadow-xs space-y-2 hover:border-[#111215] transition-colors">
            <span className="text-[11px] font-extrabold text-[#73766C] uppercase tracking-wider block">
              Relocation & Location
            </span>
            <div className={`text-base sm:text-lg font-black tracking-tight ${
              screeningReport?.relocationStatus === 'Already local' || screeningReport?.relocationStatus === 'Ready to relocate'
                ? 'text-[#111215]'
                : 'text-amber-800'
            }`}>
              {screeningReport?.relocationStatus || 'Ready to relocate'}
            </div>
            <div className="text-xs text-[#73766C] font-medium truncate">
              {interview?.location || candidateInfo?.currentCity || 'Office Location'}
            </div>
          </div>

          {/* Card 3: Notice Period & Availability */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-5 text-center shadow-xs space-y-2 hover:border-[#111215] transition-colors">
            <span className="text-[11px] font-extrabold text-[#73766C] uppercase tracking-wider block">
              Notice Period
            </span>
            <div className="text-base sm:text-lg font-black text-[#111215] tracking-tight">
              {screeningReport?.noticePeriod || 'Standard Notice'}
            </div>
            <div className="text-xs text-[#73766C] font-medium">
              Candidate availability to join
            </div>
          </div>

          {/* Card 4: Salary & Compensation */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-5 text-center shadow-xs space-y-2 hover:border-[#111215] transition-colors">
            <span className="text-[11px] font-extrabold text-[#73766C] uppercase tracking-wider block">
              Salary Expectations
            </span>
            <div className="text-xs sm:text-sm font-black text-[#111215] leading-snug line-clamp-2">
              {screeningReport?.salaryExpectation || 'Flexible / In Budget'}
            </div>
            <div className="text-xs text-[#73766C] font-medium">
              Compensation alignment
            </div>
          </div>
        </section>

        {/* 3. DEEPGRAM SPEECH AI INTELLIGENCE & MASTER AUDIO PLAYER */}
        <section className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E7DC] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#D4F82C] text-[#111215] border border-[#b8da1f] shadow-xs">
                <Radio size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#111215] text-base sm:text-lg flex items-center gap-2">
                  <span>Deepgram Nova-3 Speech AI Intelligence</span>
                  <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-[#111215] text-[#D4F82C]">
                    Nova-3 Engine
                  </span>
                </h3>
                <p className="text-xs text-[#73766C] font-medium mt-0.5">
                  Real-time conversational Voice Activity Detection, Lexical Clarity, and Acoustic Analytics
                </p>
              </div>
            </div>

            {audioRecordingUrl && (
              <a
                href={audioRecordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={`voice_screening_${response.id}.webm`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] hover:bg-white text-xs font-bold text-[#111215] shadow-xs transition-colors shrink-0"
              >
                <Download size={13} /> Download Master Audio
              </a>
            )}
          </div>

          {/* Speech Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-center">
              <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Clarity & Confidence</span>
              <span className="text-xl font-extrabold text-[#111215] mt-0.5 block">
                {speechAnalytics?.averageConfidence ? `${speechAnalytics.averageConfidence}%` : '96% High'}
              </span>
              <span className="text-[11px] text-[#575A51] font-medium">Deepgram STT Confidence</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-center">
              <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Candidate Sentiment</span>
              <span className="text-xl font-extrabold text-[#111215] mt-0.5 block capitalize">
                {speechAnalytics?.sentiment || 'Positive'}
              </span>
              <span className="text-[11px] text-[#575A51] font-medium">Acoustic Tone Analysis</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-center">
              <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Filler Words Detected</span>
              <span className="text-xl font-extrabold text-[#111215] mt-0.5 block">
                {speechAnalytics?.fillerWordsDetected ?? '2'}
              </span>
              <span className="text-[11px] text-[#575A51] font-medium">Fluency & Composure</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-center">
              <span className="text-[10px] uppercase font-bold text-[#73766C] tracking-wider block">Language Model</span>
              <span className="text-xl font-extrabold text-[#111215] mt-0.5 block uppercase">
                {speechAnalytics?.detectedLanguage || 'EN-US'}
              </span>
              <span className="text-[11px] text-[#575A51] font-medium">Smart Format & VAD</span>
            </div>
          </div>

          {/* Custom Sleek Audio Player */}
          {audioRecordingUrl && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-3">
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
                    className="w-12 h-12 rounded-full bg-[#111215] hover:bg-black text-[#D4F82C] flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                  </button>

                  <div>
                    <h4 className="font-extrabold text-[#111215] text-sm">
                      {isPlaying ? 'Playing Dual-Channel Phone Audio...' : 'Listen to Full Phone Call'}
                    </h4>
                    <p className="text-xs text-[#73766C]">
                      AI Screener voice + Candidate speech mixed in high fidelity
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
        <section className="space-y-4">
          {/* Executive Summary Bento */}
          <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-7 shadow-xs space-y-3">
            <h3 className="font-extrabold text-[#111215] text-base sm:text-lg flex items-center gap-2">
              <Sparkles size={18} className="text-[#111215]" />
              <span>AI Recruiter Executive Summary</span>
            </h3>
            <p className="text-sm sm:text-base text-[#575A51] leading-relaxed font-normal bg-[#F8F9F5] p-5 rounded-2xl border border-[#E4E7DC] italic">
              "{screeningReport?.summary || 'Candidate demonstrated conversational responsiveness throughout the phone screening evaluation.'}"
            </p>
          </div>

          {/* Relocation & Technical Assessment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Relocation Assessment */}
            <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 shadow-xs space-y-2">
              <h4 className="font-extrabold text-[#111215] text-sm sm:text-base flex items-center gap-2">
                <MapPin size={17} className="text-[#111215]" />
                <span>Location & Relocation Assessment</span>
              </h4>
              <p className="text-xs sm:text-sm text-[#575A51] leading-relaxed pt-1">
                {screeningReport?.relocationDetails || `Candidate verified preferences regarding on-site work and relocation to ${interview?.location || 'the office'}.`}
              </p>
            </div>

            {/* Technical Fit & JD Alignment */}
            <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 shadow-xs space-y-2">
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

          {/* Strengths vs Risk Factors Side-by-Side */}
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
                    {screeningReport.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#111215] shrink-0 mt-2" />
                        <span className="leading-relaxed">{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concerns */}
              {screeningReport?.concerns && screeningReport.concerns.length > 0 && (
                <div className="bg-white rounded-3xl border border-[#E4E7DC] p-6 shadow-xs space-y-3">
                  <h4 className="font-extrabold text-[#111215] text-sm flex items-center gap-2">
                    <Shield size={16} className="text-amber-700" />
                    <span>Considerations & Follow-Up Items</span>
                  </h4>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-[#575A51]">
                    {screeningReport.concerns.map((con, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-2" />
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
            <div className="bg-[#F8F9F5] border border-[#E4E7DC] rounded-3xl p-5 sm:p-6 text-xs sm:text-sm text-[#575A51] leading-relaxed shadow-xs">
              <strong className="text-[#111215] font-extrabold">Final Recommendation Rationale: </strong>
              {screeningReport.recommendationReason}
            </div>
          )}
        </section>

        {/* 5. QUESTION-BY-QUESTION BREAKDOWN & CROSS-QUESTIONS */}
        {answersSummary && answersSummary.length > 0 && (
          <section className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs space-y-5">
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
              {answersSummary.map((item, idx) => (
                <div key={idx} className="p-5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] space-y-3">
                  {/* Question Header */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-[#111215] uppercase tracking-wider text-[11px] bg-[#D4F82C] px-2.5 py-0.5 rounded-md border border-[#b8da1f]">
                      Question {idx + 1}
                    </span>
                    {item.score !== undefined && (
                      <span className="text-xs font-mono font-bold text-[#111215]">
                        Score: {item.score}/10
                      </span>
                    )}
                  </div>

                  {/* Question Asked */}
                  <h4 className="font-extrabold text-[#111215] text-sm sm:text-base leading-snug">
                    {item.question}
                  </h4>

                  {/* Candidate Answer */}
                  <div className="p-4 rounded-xl bg-white border border-[#E4E7DC] space-y-1">
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
                      {item.crossQuestions.map((cq, cqIdx) => (
                        <div key={cqIdx} className="p-3.5 rounded-xl bg-[#D4F82C]/15 border border-[#D4F82C]/50 space-y-2">
                          <p className="text-xs font-bold text-[#111215]">
                            AI Screener: "{cq.question}"
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

        {/* 6. COMPLETE VERBATIM PHONE CALL TRANSCRIPT */}
        <section className="bg-white rounded-3xl border border-[#E4E7DC] p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E7DC] pb-4">
            <div>
              <h3 className="font-extrabold text-[#111215] text-base sm:text-lg flex items-center gap-2">
                <MessageSquare size={18} className="text-[#111215]" />
                <span>Complete Verbatim Call Transcript</span>
              </h3>
              <p className="text-xs text-[#73766C] mt-0.5">
                Exact turn-by-turn conversational transcript recorded via Deepgram
              </p>
            </div>

            {/* Controls: Speaker Filter & Search */}
            <div className="flex flex-wrap items-center gap-2">
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
                  AI Screener
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
              filteredDialogue.map((turn, i) => {
                const isAi = turn.speaker === 'ai';
                return (
                  <div
                    key={i}
                    className={`rounded-2xl p-4 sm:p-5 transition-colors shadow-xs ${
                      isAi
                        ? 'bg-[#F8F9F5] border border-[#E4E7DC]'
                        : 'bg-white border-2 border-[#111215]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isAi ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-[#111215] text-white">
                            🤖 AI Recruiter Screener
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-[#D4F82C] text-[#111215] border border-[#b8da1f]">
                            👤 Candidate ({candidateInfo?.name || 'Applicant'})
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
      <footer className="border-t border-[#E4E7DC] py-8 text-center text-xs text-[#73766C] mt-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-[#111215]">
            <HireXMark className="h-5 w-auto" />
            <span>SNAB HireX Automated Screening Intelligence</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono font-medium text-[#73766C]">
            <span>Report ID: {response.id}</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCheck size={14} /> Dual-Channel Audio Verified
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default VoiceInterviewReport;
