import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { Mic, PhoneOff, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { resolveJobOrInterviewDocument } from '../services/jobResolutionService';
import { evaluateVoiceInterviewSession, saveVoiceInterviewResponse } from '../services/voiceInterviewService';
import { readResumeText } from '../services/resumeService';
import { uploadToS3 } from '../services/s3Service';
import { getCandidateRateLimitReachedMessage, isRateLimitReached, loadCompanyRateLimitStatus, recordCandidateSubmission } from '../services/rateLimitService';
import { saveResumeDumpCandidate, ParsedResumeProfile } from '../services/resumeService';
import { db } from '../services/firebase';
import { collection, doc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { VoiceInterviewResponse, VoiceInterviewTurn } from '../types';
import HireXLogo from '../components/HireXLogo';

type Phase = 'form' | 'connecting' | 'live' | 'saving' | 'done' | 'error';
type Line = { role: 'agent' | 'candidate'; text: string };

/**
 * AI voice interview over LiveKit: two-way, real-time conversation with the livekit-interviewer agent.
 * The agent streams transcript lines on the `transcript` data topic; when the call ends this page grades the
 * transcript (Bedrock, via evaluateVoiceInterviewSession) and saves it to voiceInterviewResponses.
 */
export const LiveVoiceInterview: React.FC = () => {
  const { jobId = '' } = useParams<{ jobId: string }>();
  const [params] = useSearchParams();
  const [job, setJob] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  const [name, setName] = useState(params.get('name') || '');
  const [email, setEmail] = useState(params.get('email') || '');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [resume, setResume] = useState<{ file: File; text: string } | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [agentState, setAgentState] = useState('connecting');
  const [left, setLeft] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const linesRef = useRef<Line[]>([]);
  const startedAtRef = useRef(0);
  const recorderRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    resolveJobOrInterviewDocument(jobId).then((r) => (r ? setJob(r.data) : (setError('This interview link is not valid.'), setPhase('error'))));
  }, [jobId]);

  useEffect(() => () => void roomRef.current?.disconnect(), []);

  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const onResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setResume({ file, text: await readResumeText(file, file.name) });
    } catch {
      setError('Could not read that resume. Please upload a PDF, DOCX or TXT file.');
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

    const rec = recorderRef.current;
    const audio = rec && rec.rec.state !== 'inactive'
      ? await new Promise<Blob>((done) => {
          rec.rec.onstop = () => done(new Blob(rec.chunks, { type: 'audio/webm' }));
          rec.rec.stop();
        })
      : null;
    rec?.ctx.close().catch(() => {});

    const sessionId = roomRef.current?.name || `vresp_${Date.now()}`;
    const [audioUrl, resumeUrl] = await Promise.all([
      audio?.size ? uploadToS3(audio, 'auto', `voice_call_${sessionId}.webm`).catch(() => undefined) : undefined,
      resume ? uploadToS3(resume.file, 'raw', `resumes/${Date.now()}_${resume.file.name.replace(/[^\w.-]/g, '_')}`).catch(() => undefined) : undefined,
    ]);

    const ts = new Date().toISOString();
    const dialogueHistory: VoiceInterviewTurn[] = transcript.map((l) => ({ speaker: l.role === 'agent' ? 'ai' : 'candidate', text: l.text, timestamp: ts }));
    // Each interviewer line with the candidate's reply after it
    const answersSummary = transcript.flatMap((l, i) => {
      if (l.role !== 'agent') return [];
      const reply = [];
      for (let j = i + 1; j < transcript.length && transcript[j].role === 'candidate'; j++) reply.push(transcript[j].text);
      return reply.length ? [{ question: l.text, answer: reply.join(' ') }] : [];
    });
    const candidateInfo = { name: name.trim(), email: email.trim(), phone: phone.trim(), currentCity: city.trim(), resumeText: resume?.text.slice(0, 8000) };

    try {
      const screeningReport = await evaluateVoiceInterviewSession(job?.title || 'Job Screening', dialogueHistory, candidateInfo, {
        jobDescription: job?.description, location: job?.location, companyName: job?.companyName || job?.company,
      });
      const response: VoiceInterviewResponse = {
        id: sessionId,
        voiceInterviewId: jobId,
        jobId,
        recruiterUID: job?.recruiterUID || 'SYSTEM',
        candidateInfo: { ...candidateInfo, resumeUrl, resumeFileName: resume?.file.name },
        candidateResumeUrl: resumeUrl,
        candidateResumeFileName: resume?.file.name,
        dialogueHistory,
        answersSummary,
        screeningReport,
        callDurationSeconds: Math.round((Date.now() - startedAtRef.current) / 1000),
        audioRecordingUrl: audioUrl,
        speechAnalytics: { transcriptionEngine: 'LiveKit · AssemblyAI Universal-3.6 Pro' },
        status: screeningReport.recommendation === 'Shortlist' ? 'Shortlist' : 'Completed',
        submittedAt: new Date(),
      };
      // Firestore rejects undefined fields
      await saveVoiceInterviewResponse(JSON.parse(JSON.stringify(response)));

      // The job's Responses section, pipeline and dashboards read interviews/{jobId}/attempts, like a video attempt.
      // /report/{jobId}/{id} sends interviewType 'voice' attempts to the voice report (App.tsx VoiceReportGuard).
      const score = Math.round((screeningReport.overallScore || 0) * 10);
      const attempt = JSON.parse(JSON.stringify({
        interviewType: 'voice',
        candidateInfo: response.candidateInfo,
        candidateResumeURL: resumeUrl,
        score: `${score}/100`,
        feedback: `**Overall Evaluation:** ${screeningReport.recommendation}: ${screeningReport.summary}`,
        screeningReport,
        dialogueHistory,
        answersSummary,
        audioRecordingUrl: audioUrl,
        callDurationSeconds: response.callDurationSeconds,
        voiceResponseId: sessionId,
        status: 'Completed',
        interviewId: jobId,
        jobId,
        interviewTitle: job?.title || 'Voice Interview',
        title: job?.title || 'Voice Interview',
        recruiterUID: job?.recruiterUID || null,
      }));
      await recordCandidateSubmission('interviews', doc(db, 'interviews', jobId, 'attempts', sessionId), { ...attempt, submittedAt: serverTimestamp() });

      // Add the candidate to the recruiter's talent pool, as the video interview does
      saveResumeDumpCandidate({
        recruiterUID: job?.recruiterUID || 'PUBLIC_JOB_SEEKER_POOL',
        profile: {
          name: candidateInfo.name, email: candidateInfo.email, phone: candidateInfo.phone, gender: '', location: candidateInfo.currentCity,
          currentTitle: '', summary: '', totalExperienceYears: 0, skills: [], experience: [], education: [], certifications: [],
          languages: [], keywords: [], linkedinUrl: '', portfolioUrl: '',
        } as ParsedResumeProfile,
        resumeText: resume?.text || '',
        resumeUrl: resumeUrl || '',
        fileName: resume?.file.name || 'candidate-resume',
        mimeType: resume?.file.type || 'application/pdf',
        source: 'candidate_interview',
        sourceInterviewId: jobId,
        sourceJobTitle: job?.title || 'Voice Interview',
      }).catch((err) => console.warn('[LiveVoiceInterview] resume dump save warning:', err));

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
    setPhase('connecting');
    try {
      // Same gates as the video interview: company submission limit, and one attempt per email unless the recruiter allows a reattempt
      if (isRateLimitReached(await loadCompanyRateLimitStatus(), 'interviews')) throw new Error(getCandidateRateLimitReachedMessage('interviews'));
      const previous = await getDocs(query(collection(db, 'interviews', jobId, 'attempts'), where('candidateInfo.email', '==', email.trim())));
      if (previous.docs.some((d) => !d.data().allowReattempt)) throw new Error("You've already completed this interview. Contact the recruiter if you need another attempt.");

      const res = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, name: name.trim(), city: city.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the interview.');

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
          setLines(linesRef.current);
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
      const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      rec.start(1000);
      recorderRef.current = { rec, chunks, ctx, dest };

      startedAtRef.current = Date.now();
      setLeft(data.seconds);
      setPhase('live');

      // The agent cold-starts in ~10-20 s; if it never arrives, don't leave the candidate talking to nobody
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
      setError(err?.name === 'NotAllowedError' ? 'Microphone access is needed for the voice interview. Allow it in your browser and try again.' : err?.message || 'Could not start the interview.');
      setPhase('form');
    }
  };

  const company = job?.companyName || job?.company || '';
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const input = 'w-full rounded-xl border border-[#E4E7DC] bg-white px-4 py-3 text-sm outline-none focus:border-[#111215]';
  const status = agentState === 'speaking' ? 'Interviewer is speaking' : agentState === 'thinking' ? 'Thinking…' : agentState === 'listening' ? 'Listening — go ahead' : 'Waiting for the interviewer to join…';

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col items-center px-4 py-8">
      <HireXLogo />
      <div className="w-full max-w-xl mt-8 rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-8 shadow-xs">
        <p className="text-[11px] font-black uppercase tracking-wider text-[#73766C]">AI Voice Interview</p>
        <h1 className="text-xl font-black mt-1">{job?.title || 'Loading…'}</h1>
        {company && <p className="text-sm text-[#575A51]">{company}{job?.location ? ` · ${job.location}` : ''}</p>}

        {phase === 'form' && (
          <form onSubmit={start} className="mt-6 space-y-3">
            <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className={input} type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <input className={input} placeholder="Current city" value={city} onChange={(e) => setCity(e.target.value)} />
            <label className="block text-xs text-[#575A51]">
              Resume (optional, helps the evaluation)
              <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={onResume} className="mt-1 block w-full text-xs" />
            </label>
            <p className="text-xs text-[#73766C]">
              You'll have a short, real-time conversation with an AI interviewer. Find a quiet place and use Chrome, Edge or Safari. Speak naturally; you can interrupt or ask it to repeat a question.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={!job} className="w-full rounded-full bg-[#111215] text-[#D4F82C] py-3 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50">
              <Mic size={16} /> Start voice interview
            </button>
          </form>
        )}

        {phase === 'connecting' && (
          <div className="mt-8 flex flex-col items-center gap-3 text-sm text-[#575A51]">
            <Loader2 className="animate-spin" /> Connecting your microphone…
          </div>
        )}

        {phase === 'live' && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className={`size-2.5 rounded-full ${agentState === 'speaking' ? 'bg-[#8FB305] animate-pulse' : agentState === 'listening' ? 'bg-emerald-500 animate-ping' : 'bg-[#C9CCC1]'}`} />
                {status}
              </span>
              <span className="font-mono text-sm">{mmss}</span>
            </div>
            <div className="mt-4 h-72 overflow-y-auto space-y-2 rounded-2xl bg-[#F8F9F5] p-4 flex flex-col-reverse">
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <p key={i} className={`text-sm rounded-2xl px-3 py-2 max-w-[85%] ${l.role === 'agent' ? 'bg-white border border-[#E4E7DC]' : 'bg-[#111215] text-white ml-auto'}`}>{l.text}</p>
                ))}
              </div>
            </div>
            <button onClick={() => roomRef.current?.disconnect()} className="mt-4 w-full rounded-full border border-red-200 text-red-600 py-3 text-sm font-bold flex items-center justify-center gap-2">
              <PhoneOff size={16} /> End interview
            </button>
          </div>
        )}

        {phase === 'saving' && (
          <div className="mt-8 flex flex-col items-center gap-3 text-sm text-[#575A51]">
            <Loader2 className="animate-spin" /> Submitting your interview…
          </div>
        )}

        {phase === 'done' && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="text-emerald-600" size={40} />
            <p className="font-bold">Thank you, your interview has been submitted.</p>
            <p className="text-sm text-[#575A51]">The hiring team will review it and get in touch.</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="text-amber-500" size={36} />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveVoiceInterview;
