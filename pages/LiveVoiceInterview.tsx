import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  UploadCloud,
  Sparkles,
  Search,
  Check,
  Edit3,
  User,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  Maximize,
  Minimize,
  MessageSquare,
  Volume2,
  Radio,
  Clock,
  ChevronRight,
  X,
  Shield,
  Briefcase,
} from 'lucide-react';
import { resolveJobOrInterviewDocument } from '../services/jobResolutionService';
import { evaluateVoiceInterviewSession, saveVoiceInterviewResponse } from '../services/voiceInterviewService';
import { readResumeText, analyzeResumeText, saveResumeDumpCandidate, ParsedResumeProfile } from '../services/resumeService';
import { generateInterviewQuestions } from '../services/api';
import { uploadToS3 } from '../services/s3Service';
import { getCandidateRateLimitReachedMessage, isRateLimitReached, loadCompanyRateLimitStatus, recordCandidateSubmission } from '../services/rateLimitService';
import { db } from '../services/firebase';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where, limit } from 'firebase/firestore';
import { VoiceInterviewResponse, VoiceInterviewTurn } from '../types';
import HireXLogo from '../components/HireXLogo';

type Phase = 'form' | 'connecting' | 'live' | 'saving' | 'done' | 'error';
type Line = { role: 'agent' | 'candidate'; text: string };

/**
 * Completely isolated, memoized Candidate Camera Tile.
 * Attaches the video stream only once to prevent any periodic 3-4s flicker.
 */
const CandidateCameraTile: React.FC<{
  stream: MediaStream | null;
  candidateName: string;
  isMuted: boolean;
  isVideoOff: boolean;
}> = React.memo(({ stream, candidateName, isMuted, isVideoOff }) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="relative w-full h-full min-h-[300px] sm:min-h-[360px] rounded-3xl overflow-hidden bg-[#0C0D11] border border-white/10 shadow-2xl flex items-center justify-center group">
      {isVideoOff || !stream || stream.getVideoTracks().length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center text-2xl font-bold text-white border border-white/10 shadow-inner">
            {(candidateName || 'C').charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-neutral-400">Camera Feed Paused</span>
        </div>
      ) : (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
      )}

      {/* Top Overlay Badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
        <div className="px-3 py-1 rounded-full bg-red-600/90 text-white text-[11px] font-black flex items-center gap-1.5 shadow-lg backdrop-blur-md">
          <span className="size-2 rounded-full bg-white animate-pulse" />
          REC
        </div>
        <div className="px-2.5 py-1 rounded-full bg-black/60 text-white/90 text-[11px] font-mono border border-white/10 backdrop-blur-md">
          Live Camera Feed
        </div>
      </div>

      {/* Bottom Identity Overlay */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 z-10">
        <div className="flex items-center gap-2.5 truncate">
          <div className={`p-1.5 rounded-full ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </div>
          <span className="font-bold truncate text-sm">{candidateName || 'Candidate'}</span>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
          ACTIVE
        </span>
      </div>
    </div>
  );
});

/**
 * AI Interviewer Visualizer Tile with dynamic acoustic aura
 */
const AiInterviewerTile: React.FC<{
  company: string;
  agentState: string;
  currentQuestion?: string;
}> = React.memo(({ company, agentState, currentQuestion }) => {
  return (
    <div className="relative w-full h-full min-h-[300px] sm:min-h-[360px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#12141A] via-[#0C0D10] to-[#151821] border border-white/10 shadow-2xl flex flex-col justify-between p-6 sm:p-8">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/90 font-medium">
          <Sparkles size={13} className="text-[#D4F82C]" />
          AI Interviewer
        </span>
        <span className="font-mono text-[11px] text-[#A0A39A]">{company}</span>
      </div>

      {/* Center Aura & Acoustic Visualizer */}
      <div className="flex flex-col items-center my-auto py-4">
        <div className="relative flex items-center justify-center">
          {/* Animated concentric pulse rings when agent is speaking */}
          {agentState === 'speaking' && (
            <>
              <div className="absolute size-44 rounded-full bg-[#D4F82C]/10 animate-ping pointer-events-none" />
              <div className="absolute size-36 rounded-full bg-[#D4F82C]/20 animate-pulse pointer-events-none" />
            </>
          )}
          {agentState === 'listening' && (
            <div className="absolute size-36 rounded-full bg-emerald-500/20 animate-pulse pointer-events-none" />
          )}

          <div className={`size-24 rounded-full flex items-center justify-center shadow-2xl border transition-all duration-300 z-10 ${
            agentState === 'speaking'
              ? 'bg-[#111215] border-[#D4F82C] text-[#D4F82C] scale-105 shadow-[#D4F82C]/20'
              : agentState === 'listening'
              ? 'bg-[#111215] border-emerald-400 text-emerald-400'
              : 'bg-[#181B22] border-white/20 text-white/60'
          }`}>
            {agentState === 'speaking' ? (
              <Radio size={40} className="animate-pulse" />
            ) : agentState === 'listening' ? (
              <Volume2 size={36} className="animate-bounce" />
            ) : (
              <Sparkles size={36} className="animate-spin" />
            )}
          </div>
        </div>

        <div className="mt-5 text-center">
          <h3 className="text-base font-extrabold text-white flex items-center justify-center gap-2">
            <span>AI Executive Recruiter</span>
            <span className={`size-2 rounded-full ${
              agentState === 'speaking' ? 'bg-[#D4F82C] animate-pulse' : agentState === 'listening' ? 'bg-emerald-400 animate-ping' : 'bg-neutral-500'
            }`} />
          </h3>
          <p className="text-xs text-[#9DA2B3] mt-1 capitalize font-medium">
            {agentState === 'speaking' ? 'Interviewer is speaking…' : agentState === 'thinking' ? 'Analyzing your answer…' : agentState === 'listening' ? 'Listening to your response — speak freely' : 'Connecting to session…'}
          </p>
        </div>
      </div>

      {/* Bottom Active Question Banner */}
      {currentQuestion && (
        <div className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-left backdrop-blur-md">
          <p className="text-[10px] uppercase font-mono font-bold text-[#D4F82C] tracking-wider mb-1">
            Current Screening Question
          </p>
          <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed line-clamp-3">
            "{currentQuestion}"
          </p>
        </div>
      )}
    </div>
  );
});

/**
 * Live AI Voice & Video Interview Room
 */
export const LiveVoiceInterview: React.FC = () => {
  const { jobId: rawJobId, interviewId: rawInterviewId, voiceInterviewId: rawVoiceId } = useParams<{ jobId?: string; interviewId?: string; voiceInterviewId?: string }>();
  const jobId = rawJobId || rawInterviewId || rawVoiceId || '';
  const [params] = useSearchParams();
  const [job, setJob] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [connectingMsg, setConnectingMsg] = useState('Connecting your microphone & camera…');
  const [error, setError] = useState('');

  // Contact lookup & profile state
  const initialContact = params.get('email') || params.get('phone') || '';
  const [contactInput, setContactInput] = useState(initialContact);
  const [isSearchingDump, setIsSearchingDump] = useState(false);
  const [dumpFound, setDumpFound] = useState<boolean | null>(null);
  const [dumpCandidate, setDumpCandidate] = useState<any | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  // Candidate fields
  const [name, setName] = useState(params.get('name') || '');
  const [email, setEmail] = useState(params.get('email') || '');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [city, setCity] = useState('');
  
  // Resume state
  const [resume, setResume] = useState<{ file: File; text: string } | null>(null);
  const [existingResumeUrl, setExistingResumeUrl] = useState('');
  const [existingResumeFileName, setExistingResumeFileName] = useState('');
  const [existingResumeText, setExistingResumeText] = useState('');
  const [isParsingResume, setIsParsingResume] = useState(false);

  // Live Call State
  const [lines, setLines] = useState<Line[]>([]);
  const [agentState, setAgentState] = useState('connecting');
  const [left, setLeft] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeMediaStream, setActiveMediaStream] = useState<MediaStream | null>(null);
  const [submittedSessionId, setSubmittedSessionId] = useState<string>('');
  const [savedVideoUrl, setSavedVideoUrl] = useState<string>('');
  const [savingStage, setSavingStage] = useState('Uploading high-definition video recording to secure cloud storage…');

  // Strict Proctoring / Tab Switch Detection State
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const tabSwitchCountRef = useRef(0);
  const isAwayRef = useRef(false);
  const [tabWarning, setTabWarning] = useState<string | null>(null);
  const tabWarningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const roomRef = useRef<Room | null>(null);
  const linesRef = useRef<Line[]>([]);
  const startedAtRef = useRef(0);
  const recorderRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; ctx: AudioContext; dest: MediaStreamAudioDestinationNode; mimeType: string } | null>(null);
  const finishedRef = useRef(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Strict Tab Switch & Window Focus Loss Detector
  useEffect(() => {
    if (phase !== 'live') return;

    const recordTabSwitch = () => {
      if (isAwayRef.current) return;
      isAwayRef.current = true;

      tabSwitchCountRef.current += 1;
      const count = tabSwitchCountRef.current;
      setTabSwitchCount(count);

      const msg = `TAB SWITCH DETECTED (${count}) — Window focus was lost. This tab switch has been recorded in your integrity audit report.`;
      setTabWarning(msg);

      if (tabWarningTimerRef.current) clearTimeout(tabWarningTimerRef.current);
      tabWarningTimerRef.current = setTimeout(() => {
        setTabWarning(null);
      }, 5000);
    };

    const recordReturn = () => {
      if (!document.hidden && document.hasFocus()) {
        isAwayRef.current = false;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        recordTabSwitch();
      } else {
        recordReturn();
      }
    };

    const handleBlur = () => {
      if (document.hidden || !document.hasFocus()) {
        recordTabSwitch();
      }
    };

    const handleFocus = () => {
      recordReturn();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      if (tabWarningTimerRef.current) clearTimeout(tabWarningTimerRef.current);
    };
  }, [phase]);

  // Prevent accidental page refresh or tab close during live interview and while submitting
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (phase === 'live' || phase === 'saving') {
        e.preventDefault();
        e.returnValue = 'Your interview is actively in progress or submitting. Please do NOT refresh or close this tab!';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase]);

  // Resolve job document
  useEffect(() => {
    resolveJobOrInterviewDocument(jobId).then((r) => {
      if (r) {
        setJob(r.data);
      } else {
        setError('This interview link is not valid.');
        setPhase('error');
      }
    });
  }, [jobId]);

  // Clean up LiveKit room & camera tracks on unmount
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Fullscreen toggle helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Helper to query resume dump for candidate by email or phone
  const searchResumeDump = async (rawInput: string) => {
    const raw = rawInput.trim();
    if (!raw) return;

    setIsSearchingDump(true);
    setError('');

    try {
      const isEmail = raw.includes('@');
      const cleanEmail = raw.toLowerCase();
      const cleanDigits = raw.replace(/\D/g, '').slice(-10);

      let record: any = null;

      // 1. Check by email
      if (isEmail && cleanEmail.includes('.')) {
        const emailVariants = Array.from(new Set([cleanEmail, raw])).filter(Boolean);
        const collectionsToCheck = ['resumeDumpCandidates', 'resumeDump', 'candidates'];

        for (const col of collectionsToCheck) {
          let snap = await getDocs(query(collection(db, col), where('email', 'in', emailVariants), limit(1))).catch(() => null);
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, col), where('profile.email', 'in', emailVariants), limit(1))).catch(() => null);
          }
          if (snap && !snap.empty) {
            const rawData = snap.docs[0].data();
            record = { ...(rawData.profile || {}), ...rawData, _id: snap.docs[0].id };
            break;
          }
        }
      }

      // 2. Check by phone
      if (!record && cleanDigits.length >= 7) {
        const phoneVariants = Array.from(new Set([
          cleanDigits,
          `+91 ${cleanDigits}`,
          `+91${cleanDigits}`,
          `91${cleanDigits}`,
          `0${cleanDigits}`,
          raw,
        ])).filter(Boolean);

        const collectionsToCheck = ['resumeDumpCandidates', 'resumeDump', 'candidates'];
        for (const col of collectionsToCheck) {
          let snap = await getDocs(query(collection(db, col), where('phone', 'in', phoneVariants), limit(1))).catch(() => null);
          if (!snap || snap.empty) {
            snap = await getDocs(query(collection(db, col), where('profile.phone', 'in', phoneVariants), limit(1))).catch(() => null);
          }
          if (snap && !snap.empty) {
            const rawData = snap.docs[0].data();
            record = { ...(rawData.profile || {}), ...rawData, _id: snap.docs[0].id };
            break;
          }
        }
      }

      // 3. Fallback: check job.candidateData if invited
      if (!record && job?.candidateData && Array.isArray(job.candidateData)) {
        const found = job.candidateData.find((c: any) => {
          if (isEmail && c.email && c.email.toLowerCase() === cleanEmail) return true;
          if (cleanDigits.length >= 7 && c.phone) {
            const p = String(c.phone).replace(/\D/g, '').slice(-10);
            if (p === cleanDigits) return true;
          }
          return false;
        });
        if (found) {
          record = { ...found };
        }
      }

      if (record) {
        setDumpFound(true);
        setDumpCandidate(record);
        if (record.name) setName(record.name);
        if (record.email) setEmail(record.email);
        if (record.phone) setPhone(record.phone);
        const candLocation = record.location || record.currentCity || record.city || '';
        if (candLocation) setCity(candLocation);

        const rUrl = record.resumeUrl || record.resumeURL || '';
        const rName = record.resumeFileName || record.fileName || (rUrl ? 'candidate-resume.pdf' : '');
        const rText = record.resumeText || record.summary || '';

        setExistingResumeUrl(rUrl);
        setExistingResumeFileName(rName);
        setExistingResumeText(rText);
      } else {
        setDumpFound(false);
        setDumpCandidate(null);
        if (isEmail) {
          setEmail(raw);
        } else if (cleanDigits.length >= 7) {
          setPhone(raw);
        }
      }
    } catch (err) {
      console.error('[LiveVoiceInterview] Lookup error:', err);
      setDumpFound(false);
    } finally {
      setIsSearchingDump(false);
    }
  };

  // Auto-search whenever contactInput is entered or pasted (debounced)
  useEffect(() => {
    const raw = contactInput.trim();
    if (!raw) {
      setDumpFound(null);
      setDumpCandidate(null);
      return;
    }

    const isEmail = raw.includes('@') && raw.includes('.');
    const cleanDigits = raw.replace(/\D/g, '');
    const isPhone = cleanDigits.length >= 10;

    if (isEmail || isPhone) {
      const timer = setTimeout(() => {
        searchResumeDump(raw);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [contactInput, job]);

  // Handle manual resume file upload
  const onResumeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingResume(true);
    setError('');
    try {
      const text = await readResumeText(file, file.name);
      setResume({ file, text });
      setExistingResumeFileName(file.name);
      setExistingResumeText(text);

      // Auto-extract candidate info from resume if not already filled
      try {
        const parsed = await analyzeResumeText(text, file.name, {
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        if (parsed.name && !name) setName(parsed.name);
        if (parsed.email && !email) setEmail(parsed.email);
        if (parsed.phone && !phone) setPhone(parsed.phone);
      } catch (parseErr) {
        console.warn('[LiveVoiceInterview] analyzeResumeText notice:', parseErr);
      }
    } catch {
      setError('Could not read that resume. Please upload a PDF, DOCX, or TXT file.');
    } finally {
      setIsParsingResume(false);
    }
  };

  const finish = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const transcript = linesRef.current;
    if (!transcript.some((l) => l.role === 'candidate')) {
      setError("The interview ended before you answered any questions, so nothing was submitted. You can reload this page to try again.");
      setPhase('error');
      return;
    }
    setPhase('saving');
    setSavingStage('Uploading high-definition video recording to secure cloud storage…');

    const rec = recorderRef.current;
    const recMime = rec?.mimeType || 'video/webm';
    let videoBlob: Blob | null = null;
    if (rec) {
      try {
        if (rec.rec.state === 'recording' || rec.rec.state === 'paused') {
          videoBlob = await new Promise<Blob>((done) => {
            rec.rec.onstop = () => done(new Blob(rec.chunks, { type: recMime }));
            try {
              if (typeof rec.rec.requestData === 'function') {
                rec.rec.requestData();
              }
              rec.rec.stop();
            } catch (stopErr) {
              console.warn('[LiveVoiceInterview] MediaRecorder stop error:', stopErr);
              done(new Blob(rec.chunks, { type: recMime }));
            }
          });
        } else if (rec.chunks && rec.chunks.length > 0) {
          videoBlob = new Blob(rec.chunks, { type: recMime });
        }
      } catch (err) {
        console.warn('[LiveVoiceInterview] Error assembling videoBlob:', err);
        if (rec.chunks && rec.chunks.length > 0) {
          videoBlob = new Blob(rec.chunks, { type: recMime });
        }
      }
    }
    rec?.ctx.close().catch(() => {});
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      roomRef.current?.disconnect();
    } catch (_) {}

    const sessionId = roomRef.current?.name || `vresp_${Date.now()}`;
    const [videoUrl, uploadedResumeUrl] = await Promise.all([
      videoBlob?.size ? uploadToS3(videoBlob, 'video', `voice_interview_video_${sessionId}.webm`).catch(async (err) => {
        console.warn('Video S3 upload error, trying Cloudinary fallback:', err);
        try {
          const { uploadToCloudinary } = await import('../services/api');
          return await uploadToCloudinary(videoBlob, 'video');
        } catch (cErr) {
          console.error('All video upload strategies failed:', cErr);
          return undefined;
        }
      }) : undefined,
      resume ? uploadToS3(resume.file, 'raw', `resumes/${Date.now()}_${resume.file.name.replace(/[^\w.-]/g, '_')}`).catch(() => undefined) : undefined,
    ]);

    const finalResumeUrl = uploadedResumeUrl || existingResumeUrl || '';
    const finalResumeFileName = resume?.file.name || existingResumeFileName || 'candidate-resume';
    const finalResumeText = resume?.text || existingResumeText || '';

    const ts = new Date().toISOString();
    const dialogueHistory: VoiceInterviewTurn[] = transcript.map((l) => ({ speaker: l.role === 'agent' ? 'ai' : 'candidate', text: l.text, timestamp: ts }));
    
    // Each interviewer line with the candidate's reply after it
    const answersSummary = transcript.flatMap((l, i) => {
      if (l.role !== 'agent') return [];
      const reply = [];
      for (let j = i + 1; j < transcript.length && transcript[j].role === 'candidate'; j++) reply.push(transcript[j].text);
      return reply.length ? [{ question: l.text, answer: reply.join(' ') }] : [];
    });
    
    const candidateInfo = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      currentCity: city.trim(),
      resumeText: finalResumeText.slice(0, 8000),
    };

    try {
      setSavingStage('Analyzing interview transcript & generating 10-parameter evaluation matrix…');
      const totalTabSwitches = tabSwitchCountRef.current;
      const screeningReport = await evaluateVoiceInterviewSession(job?.title || 'Job Screening', dialogueHistory, candidateInfo, {
        jobDescription: job?.description,
        location: job?.location,
        companyName: job?.companyName || job?.company,
      });

      if (totalTabSwitches > 0 && screeningReport) {
        if (!Array.isArray(screeningReport.concerns)) {
          screeningReport.concerns = [];
        }
        screeningReport.concerns.unshift(
          `Integrity Alert: Candidate switched tabs/windows ${totalTabSwitches} time${totalTabSwitches === 1 ? '' : 's'} during the session.`
        );
      }

      const response: VoiceInterviewResponse = {
        id: sessionId,
        voiceInterviewId: jobId,
        jobId,
        recruiterUID: job?.recruiterUID || 'SYSTEM',
        candidateInfo: { ...candidateInfo, resumeUrl: finalResumeUrl, resumeFileName: finalResumeFileName },
        candidateResumeUrl: finalResumeUrl,
        candidateResumeFileName: finalResumeFileName,
        dialogueHistory,
        answersSummary,
        screeningReport,
        callDurationSeconds: Math.round((Date.now() - startedAtRef.current) / 1000),
        audioRecordingUrl: videoUrl,
        videoUrl,
        candidateVideoUrl: videoUrl,
        videoRecordingUrl: videoUrl,
        fullSessionVideoUrl: videoUrl,
        speechAnalytics: { transcriptionEngine: 'LiveKit · AssemblyAI Universal-3.6 Pro' },
        tabSwitchCount: totalTabSwitches,
        status: screeningReport.recommendation === 'Shortlist' ? 'Shortlist' : 'Completed',
        submittedAt: new Date(),
      };
      
      // Save response
      setSavingStage('Securing and saving candidate submission in ATS database…');
      await saveVoiceInterviewResponse(JSON.parse(JSON.stringify(response)));

      // Save attempt under interviews/{jobId}/attempts/{sessionId} for recruiter dashboard
      const score = Math.round((screeningReport.overallScore || 0) * 10);
      const attempt = JSON.parse(JSON.stringify({
        interviewType: 'video',
        isAiVideoInterview: true,
        candidateInfo: response.candidateInfo,
        candidateResumeURL: finalResumeUrl,
        score: `${score}/100`,
        feedback: `**Overall Evaluation:** ${screeningReport.recommendation}: ${screeningReport.summary}`,
        screeningReport,
        dialogueHistory,
        answersSummary,
        fullSessionVideoUrl: videoUrl,
        audioRecordingUrl: videoUrl,
        videoRecordingUrl: videoUrl,
        candidateVideoUrl: videoUrl,
        videoUrl,
        videoURLs: videoUrl ? [videoUrl] : [],
        callDurationSeconds: response.callDurationSeconds,
        voiceResponseId: sessionId,
        responseId: sessionId,
        tabSwitchCount: totalTabSwitches,
        meta: {
          tabSwitchCount: totalTabSwitches
        },
        status: 'Completed',
        interviewId: jobId,
        jobId,
        interviewTitle: job?.title || 'AI Interview',
        title: job?.title || 'AI Interview',
        recruiterUID: job?.recruiterUID || null,
      }));
      await recordCandidateSubmission('interviews', doc(db, 'interviews', jobId, 'attempts', sessionId), { ...attempt, submittedAt: serverTimestamp() });

      try {
        await setDoc(doc(db, 'submissions', sessionId), {
          ...attempt,
          submittedAt: serverTimestamp()
        }, { merge: true });
      } catch (subErr) {
        console.warn('Submissions collection mirror fallback:', subErr);
      }

      // Save/update candidate profile in Resume Dump
      saveResumeDumpCandidate({
        recruiterUID: job?.recruiterUID || 'PUBLIC_JOB_SEEKER_POOL',
        profile: {
          name: candidateInfo.name,
          email: candidateInfo.email,
          phone: candidateInfo.phone,
          gender: dumpCandidate?.gender || '',
          location: candidateInfo.currentCity,
          currentTitle: dumpCandidate?.currentTitle || dumpCandidate?.designation || '',
          summary: dumpCandidate?.summary || '',
          totalExperienceYears: dumpCandidate?.totalExperienceYears || 0,
          skills: dumpCandidate?.skills || [],
          experience: dumpCandidate?.experience || [],
          education: dumpCandidate?.education || [],
          certifications: dumpCandidate?.certifications || [],
          languages: dumpCandidate?.languages || [],
          keywords: dumpCandidate?.keywords || [],
          linkedinUrl: dumpCandidate?.linkedinUrl || '',
          portfolioUrl: dumpCandidate?.portfolioUrl || '',
        } as ParsedResumeProfile,
        resumeText: finalResumeText,
        resumeUrl: finalResumeUrl,
        fileName: finalResumeFileName,
        mimeType: resume?.file.type || 'application/pdf',
        source: 'candidate_interview',
        sourceInterviewId: jobId,
        sourceJobTitle: job?.title || 'Voice Interview',
      }).catch((err) => console.warn('[LiveVoiceInterview] resume dump save warning:', err));

      setSubmittedSessionId(sessionId);
      setSavedVideoUrl(videoUrl);
      setPhase('done');
    } catch (err) {
      console.error('[LiveVoiceInterview] save failed', err);
      setError('Your interview finished but we could not submit it. Please contact the recruiter.');
      setPhase('error');
    }
  };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('Please provide your email or phone number.');
      return;
    }

    const effectiveResumeText = resume?.text || existingResumeText;
    const hasResume = Boolean(effectiveResumeText || existingResumeUrl || resume?.file);

    if (!hasResume) {
      setError('Please upload your resume so the AI interviewer can personalize questions for you.');
      return;
    }

    setPhase('connecting');
    setConnectingMsg('AI is generating personalized interview questions based on your resume & JD…');

    try {
      // 1. Check rate limits & previous attempts
      if (isRateLimitReached(await loadCompanyRateLimitStatus(), 'interviews')) {
        throw new Error(getCandidateRateLimitReachedMessage('interviews'));
      }
      if (email.trim()) {
        const previous = await getDocs(query(collection(db, 'interviews', jobId, 'attempts'), where('candidateInfo.email', '==', email.trim())));
        if (previous.docs.some((d) => !d.data().allowReattempt)) {
          throw new Error("You've already completed this interview. Contact the recruiter if you need another attempt.");
        }
      }

      // 2. Generate personalized questions tailored to this candidate's resume and the JD
      let customQuestions: string[] = [];
      const numQuestions = Number(job?.numQuestions) || 5;
      const candidateExpStr = dumpCandidate?.totalExperienceYears
        ? `${dumpCandidate.totalExperienceYears} years`
        : '0 years';

      try {
        customQuestions = await generateInterviewQuestions(
          job?.title || 'Voice Interview',
          job?.description || '',
          candidateExpStr,
          '',
          'text/plain',
          'en',
          numQuestions,
          effectiveResumeText || `Candidate Name: ${name}\nLocation: ${city}`,
          {
            name: name.trim(),
            designation: dumpCandidate?.designation || dumpCandidate?.currentTitle || '',
            currentCompany: dumpCandidate?.currentCompanyName || dumpCandidate?.currentCompany || '',
            qualification: dumpCandidate?.qualificationBasic || '',
            totalExperienceYears: String(dumpCandidate?.totalExperienceYears || '0'),
            skills: Array.isArray(dumpCandidate?.skills) ? dumpCandidate.skills : [],
          }
        );
      } catch (genErr) {
        console.warn('[LiveVoiceInterview] Personalized question generation notice:', genErr);
      }

      setConnectingMsg('Setting up camera & microphone…');

      // 3. Request camera & microphone
      let cameraStream: MediaStream | null = null;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24, max: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (camErr) {
        console.warn('[LiveVoiceInterview] Camera setup failed, falling back to audio only:', camErr);
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch (audErr) {
          console.error('[LiveVoiceInterview] Audio access failed:', audErr);
        }
      }
      cameraStreamRef.current = cameraStream;
      setActiveMediaStream(cameraStream);

      setConnectingMsg('Connecting to AI Interviewer…');

      // 4. Request LiveKit token with custom personalized questions & candidate resume context
      const res = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          name: name.trim(),
          city: city.trim(),
          questions: customQuestions.length > 0 ? customQuestions : undefined,
          resumeSummary: (effectiveResumeText || '').slice(0, 2500),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the interview.');

      // 5. Connect LiveKit room
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const mix = (track: MediaStreamTrack) => ctx.createMediaStreamSource(new MediaStream([track])).connect(dest);

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind !== Track.Kind.Audio) return;
          document.body.appendChild(track.attach());
          mix(track.mediaStreamTrack);
        })
        .on(RoomEvent.DataReceived, (payload, _p, _k, topic) => {
          if (topic !== 'transcript') return;
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (!msg.text) return;
          linesRef.current = [...linesRef.current, msg];
          setLines([...linesRef.current]);
        })
        .on(RoomEvent.ParticipantAttributesChanged, (attrs) => {
          if (attrs['lk.agent.state']) setAgentState(attrs['lk.agent.state']);
        })
        .on(RoomEvent.Disconnected, () => void finish());

      await ctx.resume();
      await room.connect(data.url, data.token);
      await room.localParticipant.setMicrophoneEnabled(true, { echoCancellation: true, noiseSuppression: true, autoGainControl: true });
      const mic = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
      if (mic) mix(mic);

      // 6. Build combined recording stream with video + mixed two-way audio
      const combinedTracks: MediaStreamTrack[] = [];
      const camVideoTrack = cameraStream?.getVideoTracks()[0];
      if (camVideoTrack) combinedTracks.push(camVideoTrack);
      const mixedAudioTrack = dest.stream.getAudioTracks()[0];
      if (mixedAudioTrack) combinedTracks.push(mixedAudioTrack);

      const recordingStream = new MediaStream(combinedTracks);

      let recordMime = 'video/webm;codecs=vp8,opus';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          recordMime = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          recordMime = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          recordMime = 'video/mp4';
        }
      }

      const rec = new MediaRecorder(recordingStream, {
        mimeType: recordMime,
        videoBitsPerSecond: 250_000, // Smooth 250kbps for minimal storage and zero stutter
        audioBitsPerSecond: 64_000,
      });

      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      rec.start(2000); // 2s chunk intervals
      recorderRef.current = { rec, chunks, ctx, dest, mimeType: recordMime };

      startedAtRef.current = Date.now();
      setLeft(data.seconds);
      setPhase('live');

      // Cold start watchdog
      setTimeout(() => {
        if (room.state === 'connected' && !room.remoteParticipants.size) {
          finishedRef.current = true;
          room.disconnect();
          setError('The AI interviewer could not join right now. Please try again in a few minutes.');
          setPhase('error');
        }
      }, 60_000);
    } catch (err: any) {
      roomRef.current?.disconnect();
      setError(err?.name === 'NotAllowedError' ? 'Microphone and camera access are needed for the interview. Please allow them in your browser.' : err?.message || 'Could not start the interview.');
      setPhase('form');
    }
  };

  const toggleMic = () => {
    const pub = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (pub?.track) {
      if (isMuted) {
        pub.track.unmute();
        setIsMuted(false);
      } else {
        pub.track.mute();
        setIsMuted(true);
      }
    }
  };

  const toggleVideo = () => {
    const videoTrack = cameraStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const company = job?.companyName || job?.company || '';
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const inputClass = 'w-full rounded-2xl border border-[#E4E7DC] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#111215] focus:ring-2 focus:ring-[#111215]/5';

  // Find the latest agent question from lines
  const latestQuestion = useMemo(() => {
    const agentLines = lines.filter((l) => l.role === 'agent');
    return agentLines.length > 0 ? agentLines[agentLines.length - 1].text : undefined;
  }, [lines]);

  const hasLoadedResume = Boolean(resume?.file || existingResumeUrl || existingResumeText);

  // -------------------------------------------------------------
  // PHASE: LIVE INTERVIEW (FULL-SCREEN CINEMATIC INTERVIEW ROOM)
  // -------------------------------------------------------------
  if (phase === 'live') {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-[#0A0B0E] text-white flex flex-col overflow-hidden select-none z-50">
        {/* TOP BAR */}
        <header className="h-16 px-4 sm:px-6 border-b border-white/10 bg-[#0F1116]/80 backdrop-blur-md flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 truncate">
            <HireXLogo isDark={true} />
            <div className="h-5 w-px bg-white/15 hidden sm:block" />
            <div className="truncate">
              <h2 className="text-sm font-bold text-white truncate flex items-center gap-2">
                <span>{job?.title || 'AI Interview'}</span>
                {company && <span className="text-xs text-neutral-400 font-normal hidden md:inline">· {company}</span>}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live State Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-semibold">
              <span className={`size-2.5 rounded-full ${
                agentState === 'speaking' ? 'bg-[#D4F82C] animate-pulse' : agentState === 'listening' ? 'bg-emerald-400 animate-ping' : 'bg-neutral-500'
              }`} />
              <span className="capitalize text-neutral-200">
                {agentState === 'speaking' ? 'Interviewer Speaking' : agentState === 'listening' ? 'Listening' : 'Thinking'}
              </span>
            </div>

            {/* Live Proctoring & Tab Switch Integrity Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold transition-all ${
                tabSwitchCount > 0
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
              title={
                tabSwitchCount > 0
                  ? `${tabSwitchCount} tab switch(es) detected and logged in audit report`
                  : 'Live Proctoring Active: Zero tab switches'
              }
            >
              {tabSwitchCount > 0 ? (
                <AlertTriangle size={13} className="text-amber-400 shrink-0" />
              ) : (
                <Shield size={13} className="text-emerald-400 shrink-0" />
              )}
              <span>{tabSwitchCount > 0 ? `${tabSwitchCount} Switch${tabSwitchCount === 1 ? '' : 'es'}` : 'Proctored'}</span>
            </div>

            {/* Countdown Clock */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-white/15 text-xs font-mono font-bold text-white">
              <Clock size={13} className="text-[#D4F82C]" />
              <span>{mmss}</span>
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </header>

        {/* MAIN STAGE (CINEMATIC DUAL TILES + TRANSCRIPT DRAWER) */}
        <main className="flex-1 p-3 sm:p-5 flex gap-4 overflow-hidden relative">
          {/* Strict Tab Switch Alert Banner */}
          {tabWarning && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92%] p-3.5 sm:p-4 rounded-2xl bg-amber-500 text-black font-extrabold text-xs sm:text-sm flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md border border-amber-300 animate-bounce">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={20} className="shrink-0 text-black" />
                <span className="leading-tight">{tabWarning}</span>
              </div>
              <span className="text-[11px] bg-black/25 text-black px-2.5 py-1 rounded-full font-mono shrink-0 font-black uppercase tracking-wider">
                Logged #{tabSwitchCount}
              </span>
            </div>
          )}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-hidden">
            {/* Candidate Live Mirrored Video Tile (Zero Flicker!) */}
            <CandidateCameraTile
              stream={activeMediaStream}
              candidateName={name}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
            />

            {/* AI Interviewer Persona / Acoustic Waveform Visualizer Tile */}
            <AiInterviewerTile
              company={company || 'Company'}
              agentState={agentState}
              currentQuestion={latestQuestion}
            />
          </div>

          {/* Collapsible Transcript Drawer */}
          {showTranscript && (
            <aside className="w-80 lg:w-96 rounded-3xl bg-[#0F1116] border border-white/10 flex flex-col overflow-hidden shadow-2xl transition-all duration-300">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-[#D4F82C]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-white">Live Transcript</span>
                </div>
                <button
                  onClick={() => setShowTranscript(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col-reverse text-xs">
                <div className="space-y-3">
                  {lines.length === 0 ? (
                    <p className="text-neutral-500 italic text-center py-8">
                      Conversation started. Questions and answers will appear here live…
                    </p>
                  ) : (
                    lines.map((l, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-2xl max-w-[90%] leading-relaxed ${
                          l.role === 'agent'
                            ? 'bg-white/5 border border-white/10 text-neutral-100 rounded-tl-sm mr-auto'
                            : 'bg-[#D4F82C] text-[#111215] font-semibold rounded-tr-sm ml-auto shadow-md'
                        }`}
                      >
                        <p className="text-[10px] font-mono uppercase opacity-60 mb-0.5">
                          {l.role === 'agent' ? 'AI Interviewer' : name || 'You'}
                        </p>
                        <p>{l.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          )}
        </main>

        {/* BOTTOM FLOATING CONTROLS DOCK */}
        <footer className="h-20 px-6 bg-[#0F1116]/90 border-t border-white/10 backdrop-blur-md flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-neutral-400 hidden sm:inline">
              Speaking with <span className="text-white font-bold">{company || 'Recruiter AI'}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mic Toggle */}
            <button
              onClick={toggleMic}
              className={`p-3 sm:px-4 sm:py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition ${
                isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
              }`}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              <span className="hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {/* Video Toggle */}
            <button
              onClick={toggleVideo}
              className={`p-3 sm:px-4 sm:py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition ${
                isVideoOff ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
              }`}
            >
              {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
              <span className="hidden sm:inline">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
            </button>

            {/* Transcript Drawer Toggle */}
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`p-3 sm:px-4 sm:py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition ${
                showTranscript ? 'bg-[#D4F82C] text-[#111215]' : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
              }`}
            >
              <MessageSquare size={18} />
              <span className="hidden sm:inline">Transcript</span>
            </button>

            {/* End Call Button */}
            <button
              onClick={() => void finish()}
              className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <PhoneOff size={18} />
              <span>End Interview</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-400">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Secure Stream</span>
          </div>
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PHASE: CONNECTING / GENERATING QUESTIONS (FULL-SCREEN IMMERSIVE)
  // -------------------------------------------------------------
  if (phase === 'connecting') {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-[#0A0B0E] text-white flex flex-col items-center justify-center p-6 z-50">
        <div className="max-w-md w-full bg-[#12141A] border border-white/10 rounded-3xl p-8 text-center shadow-2xl space-y-6">
          <div className="relative mx-auto size-20 rounded-full bg-[#D4F82C]/10 border border-[#D4F82C]/30 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#D4F82C]" size={36} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">Preparing Your AI Interview Room</h2>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              {connectingMsg}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-neutral-300 text-left flex items-center gap-3">
            <Shield size={18} className="text-[#D4F82C] shrink-0" />
            <span>High-definition video & dual-channel voice session is being encrypted.</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PHASE: SAVING / SUBMITTING
  // -------------------------------------------------------------
  if (phase === 'saving') {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-[#0A0B0E] text-white flex flex-col items-center justify-center p-4 sm:p-6 z-50">
        <div className="max-w-lg w-full bg-[#12141A] border border-white/10 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-6">
          {/* Animated Spinner with Lime Glow */}
          <div className="relative mx-auto size-20 rounded-full bg-[#D4F82C]/10 border border-[#D4F82C]/30 flex items-center justify-center shadow-lg shadow-[#D4F82C]/10">
            <Loader2 className="animate-spin text-[#D4F82C]" size={38} />
            <span className="absolute size-3 rounded-full bg-[#D4F82C] animate-ping top-1 right-1 opacity-75" />
          </div>

          {/* Heading and Subtitle */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Submitting Your Interview Video & Dossier
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed max-w-sm mx-auto">
              Please wait while your session recording and AI evaluation report are uploaded and stored securely.
            </p>
          </div>

          {/* High-Visibility DO NOT REFRESH Warning Callout Box */}
          <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 text-left flex items-start gap-3.5 shadow-xl shadow-amber-950/30">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle size={22} className="animate-bounce" />
            </div>
            <div className="space-y-1 flex-1">
              <p className="font-black text-amber-300 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
                Do Not Refresh Or Close This Tab
              </p>
              <p className="text-[12px] sm:text-xs text-amber-100/90 leading-relaxed font-medium">
                Your video interview is currently uploading to cloud storage and your evaluation is finalizing. Refreshing, closing, or navigating away from this tab will interrupt and invalidate your submission.
              </p>
            </div>
          </div>

          {/* Live Progress Stage Tracker */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300 font-medium flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#D4F82C] animate-ping" />
                {savingStage}
              </span>
              <span className="text-[#D4F82C] font-mono font-bold text-[11px]">In Progress</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-[#D4F82C] via-lime-400 to-emerald-400 h-full w-full animate-pulse rounded-full" />
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#D4F82C]" />
                10-Parameter Scoring & Dossier Compilation
              </span>
              <span className="text-neutral-400 font-mono text-[10px]">Auto-Redirecting Soon</span>
            </div>
          </div>

          {/* Footer note & Security Seal */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <p className="text-[11px] text-neutral-400 leading-normal">
              This process usually takes <strong className="text-neutral-300">10–25 seconds</strong>. You will automatically be redirected once submitted.
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] text-neutral-400 font-mono">
              <Shield size={12} className="text-[#D4F82C]" />
              <span>TLS 1.3 / 256-Bit Encrypted Interview Submission</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PHASE: DONE (COMPLETION SCREEN)
  // -------------------------------------------------------------
  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col items-center justify-center p-4">
        <HireXLogo isDark={false} />
        <div className="w-full max-w-xl mt-8 rounded-3xl border border-[#E4E7DC] bg-white p-8 text-center shadow-xl space-y-6">
          <div className="size-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
            <CheckCircle2 size={44} />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Assessment Successfully Completed
            </span>
            <h1 className="text-2xl font-black text-[#111215] mt-3">{job?.title || 'AI Interview'}</h1>
            <p className="text-sm text-[#575A51] mt-1">
              Thank you, <strong className="text-[#111215]">{name || 'Candidate'}</strong>! Your interview video has been submitted and stored securely.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 flex items-center justify-center gap-2">
            <Video size={16} className="text-emerald-600 shrink-0" />
            <span className="font-medium">Full interview video & dual-channel audio recorded and archived securely.</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-xs text-[#575A51] text-left space-y-2">
            <p className="font-bold text-[#111215]">Next Steps:</p>
            <p>1. Our AI recruiter synthesizes your answers and cross-references your resume.</p>
            <p>2. The hiring team reviews your executive assessment dossier & full video recording.</p>
            <p>3. You will receive an update regarding interview outcomes shortly.</p>
          </div>

          {submittedSessionId && (
            <div className="pt-2">
              <a
                href={`/voice-report/${submittedSessionId}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-6 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-bold hover:bg-black transition inline-flex items-center justify-center gap-2 shadow-lg"
              >
                <span>View Executive Report & Video Recording</span>
                <ChevronRight size={15} />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PHASE: ERROR
  // -------------------------------------------------------------
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col items-center justify-center p-4">
        <HireXLogo isDark={false} />
        <div className="w-full max-w-md mt-8 rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lg space-y-5">
          <div className="size-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-lg font-black text-[#111215]">Unable to Proceed</h2>
          <p className="text-sm text-[#575A51] leading-relaxed">{error}</p>
          <button
            onClick={() => {
              setError('');
              setPhase('form');
            }}
            className="w-full py-3 rounded-full bg-[#111215] text-[#D4F82C] text-sm font-bold shadow hover:bg-black transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PHASE: FORM / ONBOARDING (WIDE, BEAUTIFUL MODERN LAYOUT)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col items-center justify-center px-4 py-8">
      <HireXLogo isDark={false} />

      <div className="w-full max-w-4xl mt-6 rounded-3xl border border-[#E4E7DC] bg-white shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Hero Banner */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#111215] to-[#1F232B] text-white p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/10 text-[#D4F82C] border border-white/10">
              <Sparkles size={12} />
              AI Interview
            </div>

            <div>
              <h1 className="text-2xl font-black text-white leading-tight">{job?.title || 'Open Role'}</h1>
              {company && (
                <p className="text-sm text-neutral-400 mt-1 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-[#D4F82C]" />
                  {company}{job?.location ? ` · ${job.location}` : ''}
                </p>
              )}
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed pt-2">
              Welcome! You are taking an interactive assessment conducted by an autonomous AI interviewer. Questions are personalized directly to your background and the job requirements.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 space-y-2.5 text-xs text-neutral-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#D4F82C] shrink-0" />
              <span>Full-screen cinematic interview room</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#D4F82C] shrink-0" />
              <span>Personalized technical cross-questions</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#D4F82C] shrink-0" />
              <span>Full interview recording archived</span>
            </div>
          </div>
        </div>

        {/* Right Candidate Setup & Smart Autoload */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Step 1: Mobile Number or Email Lookup */}
            <div>
              <label className="block text-xs font-extrabold text-[#111215] mb-1.5 flex items-center justify-between">
                <span>Enter Mobile Number or Email</span>
                <span className="text-[11px] font-normal text-[#73766C]">
                  {isSearchingDump
                    ? '⚡ Checking talent pool…'
                    : dumpFound === true
                    ? '✓ Profile verified'
                    : 'Auto-loads profile & resume'}
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  className={`${inputClass} pr-11`}
                  placeholder="e.g. 9876543210 or yourname@gmail.com"
                  value={contactInput}
                  onChange={(e) => setContactInput(e.target.value)}
                  onBlur={() => {
                    if (contactInput.trim()) searchResumeDump(contactInput);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted.trim()) {
                      setContactInput(pasted.trim());
                      searchResumeDump(pasted.trim());
                    }
                  }}
                />
                <div className="absolute right-3.5 top-3.5 text-[#73766C] flex items-center pointer-events-none">
                  {isSearchingDump ? (
                    <Loader2 size={18} className="animate-spin text-emerald-600" />
                  ) : dumpFound === true ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <Search size={18} className="text-[#A0A39A]" />
                  )}
                </div>
              </div>
            </div>

            {/* Profile Status Banner */}
            {dumpFound === true && (
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Profile Auto-Loaded from Talent Pool</p>
                      <p className="text-[11px] text-emerald-700">Your profile and resume details were verified.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetails(!isEditingDetails)}
                    className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <Edit3 size={12} /> {isEditingDetails ? 'Hide' : 'Edit'}
                  </button>
                </div>

                {/* Candidate Overview Card */}
                <div className="mt-3 pt-3 border-t border-emerald-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-emerald-950">
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-emerald-700" />
                    <span className="font-semibold">{name || 'Candidate'}</span>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-emerald-700" />
                      <span>{phone}</span>
                    </div>
                  )}
                  {email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-emerald-700" />
                      <span className="truncate">{email}</span>
                    </div>
                  )}
                  {city && (
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-emerald-700" />
                      <span>{city}</span>
                    </div>
                  )}
                </div>

                {/* Resume Status in Dump */}
                <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-emerald-700" />
                    {hasLoadedResume ? (
                      <span className="font-medium text-emerald-900 truncate max-w-[240px]">
                        {existingResumeFileName || resume?.file.name || 'Resume Attached'}
                      </span>
                    ) : (
                      <span className="text-amber-800 font-medium">No resume attached in profile</span>
                    )}
                  </div>
                  <label className="text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer">
                    {hasLoadedResume ? 'Replace Resume' : 'Upload Resume'}
                    <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={onResumeFile} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {/* Profile Not Found Notice */}
            {dumpFound === false && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">No profile found for this contact</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Please upload your resume or enter your details below. The AI will personalize the interview questions to your background.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Resume Upload Box (If no resume loaded, or if not found in dump) */}
            {(!hasLoadedResume || dumpFound === false) && (
              <div className="rounded-2xl border-2 border-dashed border-[#E4E7DC] p-5 text-center bg-[#FAFAF8] hover:border-[#111215] transition">
                <UploadCloud size={28} className="mx-auto text-[#73766C]" />
                <p className="text-xs font-bold mt-2 text-[#111215]">
                  {isParsingResume ? 'Reading resume content…' : 'Upload Your Resume'}
                </p>
                <p className="text-[11px] text-[#73766C] mt-0.5">
                  Supports PDF, DOCX, or TXT. AI extracts details & personalizes questions.
                </p>
                <label className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111215] text-[#D4F82C] text-xs font-bold cursor-pointer hover:bg-black transition">
                  <FileText size={13} />
                  Choose File
                  <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={onResumeFile} className="hidden" />
                </label>
              </div>
            )}

            {/* Editable Fields (if not found in dump or candidate clicks edit) */}
            {(dumpFound === false || isEditingDetails || (!dumpFound && !dumpCandidate)) && (
              <form onSubmit={start} className="space-y-3 pt-1">
                <p className="text-xs font-bold text-[#111215]">Candidate Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className={inputClass}
                    placeholder="Full name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <input
                    className={inputClass}
                    type="email"
                    placeholder="Email address *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <input
                    className={inputClass}
                    type="tel"
                    placeholder="Phone number *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <input
                    className={inputClass}
                    placeholder="Current city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <div className="pt-2">
                  {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                  <button
                    type="submit"
                    disabled={!job || !name.trim()}
                    className="w-full mt-2 rounded-full bg-[#111215] text-[#D4F82C] py-3.5 text-sm font-black flex items-center justify-center gap-2 hover:bg-black disabled:opacity-50 transition shadow-lg"
                  >
                    <Mic size={16} /> Enter Full-Screen Interview Room
                  </button>
                </div>
              </form>
            )}

            {/* Quick Start for Autoloaded Profile */}
            {dumpFound === true && !isEditingDetails && (
              <div className="space-y-3 pt-2">
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="button"
                  onClick={start}
                  disabled={!job || !name.trim()}
                  className="w-full rounded-full bg-[#111215] text-[#D4F82C] py-4 text-sm font-black flex items-center justify-center gap-2.5 hover:bg-black disabled:opacity-50 shadow-xl transition transform active:scale-[0.99]"
                >
                  <Video size={18} />
                  <span>Start Live Interview (Full Screen)</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveVoiceInterview;
