import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, RotateCcw, FastForward, 
  Sparkles, CheckCircle2, AlertCircle, Clock, Shield, MapPin, Briefcase, FileText, ArrowRight,
  UploadCloud, FileCheck, Trash2
} from 'lucide-react';
import { 
  getVoiceInterview, 
  detectCandidateVoiceIntent, 
  generateCrossQuestionOrAcknowledge, 
  evaluateVoiceInterviewSession, 
  saveVoiceInterviewResponse,
  DEFAULT_SCREENING_QUESTIONS,
  specializeQuestions
} from '../services/voiceInterviewService';
import { resolveJobOrInterviewDocument } from '../services/jobResolutionService';
import { speak, unlockTTSAudio } from '../lib/tts';
import { VoiceInterview, VoiceInterviewQuestion, VoiceInterviewTurn, VoiceInterviewResponse } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { 
  DeepgramRealtimeSession, 
  fetchDeepgramAudioBlob, 
  stopDeepgramAudio,
  transcribeAudioBlobWithDeepgram,
  synthesizeWithDeepgram
} from '../services/deepgramService';
import { VoiceCallRecorder } from '../services/voiceCallRecorder';
import { uploadToS3 } from '../services/s3Service';
import { readResumeText } from '../services/resumeService';
import HireXLogo, { HireXMark } from '../components/HireXLogo';

export const CandidateVoiceInterview: React.FC = () => {
  const { voiceInterviewId } = useParams<{ voiceInterviewId: string }>();

  // Data states
  const [voiceInterview, setVoiceInterview] = useState<VoiceInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Candidate Details state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [dumpFoundNotice, setDumpFoundNotice] = useState<string | null>(null);

  // Resume Upload State
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeSuccessMsg, setResumeSuccessMsg] = useState<string | null>(null);

  // Call states: 'details' | 'ready' | 'calling' | 'completed'
  const [callState, setCallState] = useState<'details' | 'ready' | 'calling' | 'completed'>('details');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [candidateListening, setCandidateListening] = useState(false);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [activeCrossQuestion, setActiveCrossQuestion] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [dialogueHistory, setDialogueHistory] = useState<VoiceInterviewTurn[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [savingReport, setSavingReport] = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [remainingWaitSeconds, setRemainingWaitSeconds] = useState<number | null>(null);
  const [completedResponse, setCompletedResponse] = useState<VoiceInterviewResponse | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');

  // Always-fresh refs to prevent stale closure bugs in Web Speech API & timeouts
  const callStateRef = useRef<'details' | 'ready' | 'calling' | 'completed'>('details');
  const isMicMutedRef = useRef(false);
  const isAudioMutedRef = useRef(false);
  const aiSpeakingRef = useRef(false);
  const isProcessingAnswerRef = useRef(false);
  const currentQuestionIndexRef = useRef(0);
  const activeCrossQuestionRef = useRef<string | null>(null);
  const accumulatedAnswerRef = useRef<string>('');
  const liveTranscriptRef = useRef<string>('');
  const voiceInterviewRef = useRef<VoiceInterview | null>(null);

  const deepgramSessionRef = useRef<DeepgramRealtimeSession | null>(null);
  const callRecorderRef = useRef<VoiceCallRecorder | null>(null);
  const noReplyTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const isSpeechActiveRef = useRef(false);
  const callTimerRef = useRef<any>(null);
  const dialogueHistoryRef = useRef<VoiceInterviewTurn[]>([]);
  const answersSummaryRef = useRef<Array<{ question: string; answer: string; crossQuestions?: Array<{ question: string; answer: string }> }>>([]);
  const silenceTimerRef = useRef<any>(null);
  const webSpeechNetworkFailuresRef = useRef<number>(0);

  // Keep refs in sync with state
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { isMicMutedRef.current = isMicMuted; }, [isMicMuted]);
  useEffect(() => { isAudioMutedRef.current = isAudioMuted; }, [isAudioMuted]);
  useEffect(() => { aiSpeakingRef.current = aiSpeaking; }, [aiSpeaking]);
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);
  useEffect(() => { activeCrossQuestionRef.current = activeCrossQuestion; }, [activeCrossQuestion]);
  useEffect(() => { voiceInterviewRef.current = voiceInterview; }, [voiceInterview]);

  const updateLiveTranscript = (text: string) => {
    liveTranscriptRef.current = text;
    setLiveTranscript(text);
  };

  // Load Voice Interview or Job Document
  useEffect(() => {
    if (!voiceInterviewId) {
      setErrorMsg('Invalid voice interview link.');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        // 1. Try finding in voiceInterviews collection
        try {
          const existingVoice = await getVoiceInterview(voiceInterviewId);
          if (existingVoice) {
            setVoiceInterview(existingVoice);
            setLoading(false);
            return;
          }
        } catch (voiceErr) {
          console.warn('[Voice Interview] Note: voiceInterviews query caught error, trying job resolver fallback:', voiceErr);
        }

        // 2. Try resolving as standard job / interview ID
        const resolvedJob = await resolveJobOrInterviewDocument(voiceInterviewId);
        if (resolvedJob && resolvedJob.data) {
          const jd = resolvedJob.data as any;
          const questions = (jd.questions && jd.questions.length > 0)
            ? jd.questions.map((q: any, i: number) => ({
                id: `q_${i}`,
                question: typeof q === 'string' ? q : (q.text || q.question || 'Describe your experience.'),
                category: 'skills'
              }))
            : DEFAULT_SCREENING_QUESTIONS;

          setVoiceInterview({
            id: voiceInterviewId,
            jobId: resolvedJob.id,
            interviewId: resolvedJob.id,
            title: jd.title || jd.jobTitle || 'Phone Screening Call',
            jobTitle: jd.title || jd.jobTitle || 'Role',
            jobDescription: jd.description || jd.jobDescription || '',
            companyName: jd.company || jd.companyName || 'Hiring Team',
            location: jd.location || '',
            recruiterUID: jd.recruiterUID || jd.recruiterId || '',
            questions,
            status: 'active',
            createdAt: new Date()
          });
          setLoading(false);
          return;
        }

        setErrorMsg('Voice interview not found or has expired.');
      } catch (err: any) {
        console.error('[Voice Interview] Load error:', err);
        setErrorMsg('Failed to load voice interview details.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [voiceInterviewId]);

  // Lookup Candidate in Resume Dump when email is typed
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) return;

    const timer = setTimeout(async () => {
      try {
        let snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('email', '==', trimmed), limit(1)));
        if (snap.empty) {
          snap = await getDocs(query(collection(db, 'resumeDumpCandidates'), where('profile.email', '==', trimmed), limit(1)));
        }
        if (snap.empty) {
          snap = await getDocs(query(collection(db, 'resumeDump'), where('email', '==', trimmed), limit(1)));
        }

        if (!snap.empty) {
          const raw = snap.docs[0].data();
          const p = (raw.profile && typeof raw.profile === 'object') ? raw.profile : raw;
          if (p.name && !name) setName(p.name);
          if (p.phone && !phone) setPhone(p.phone);
          if ((p.location || p.city) && !currentCity) setCurrentCity(p.location || p.city);
          setDumpFoundNotice('Found your profile in candidate database! Information auto-filled.');
        }
      } catch (_) {}
    }, 400);

    return () => clearTimeout(timer);
  }, [email]);

  // Handle Resume Upload & Auto-Fill
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingResume(true);
    setResumeSuccessMsg(null);
    setErrorMsg(null);

    try {
      // 1. Extract raw text from PDF/DOCX/TXT
      const extractedText = await readResumeText(file, file.name);
      setResumeFile(file);
      setResumeFileName(file.name);
      setResumeText(extractedText);

      // 2. Intelligent regex extraction to auto-fill candidate inputs
      const emailMatch = extractedText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (emailMatch && (!email || !email.trim())) {
        setEmail(emailMatch[1].trim().toLowerCase());
      }

      const phoneMatch = extractedText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?91[-.\s]?[6-9]\d{9}/);
      if (phoneMatch && (!phone || !phone.trim())) {
        setPhone(phoneMatch[0].trim());
      }

      // Check for candidate's current city in resume
      const popularCities = ['Nashik', 'Pune', 'Mumbai', 'Bengaluru', 'Bangalore', 'Hyderabad', 'Delhi', 'Noida', 'Gurugram', 'Gurgaon', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Indore', 'Nagpur', 'Chandigarh'];
      for (const city of popularCities) {
        if (new RegExp(`\\b${city}\\b`, 'i').test(extractedText)) {
          if (!currentCity || !currentCity.trim()) {
            setCurrentCity(city);
          }
          break;
        }
      }

      // 3. Upload to AWS S3 bucket
      const s3Name = `resumes/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      uploadToS3(file, 'raw', s3Name)
        .then(uploadedUrl => {
          setResumeUrl(uploadedUrl);
        })
        .catch(err => {
          console.warn('[Voice Interview] Resume upload warning:', err);
        });

      setResumeSuccessMsg(`Resume "${file.name}" uploaded! Candidate details auto-filled.`);
    } catch (err: any) {
      console.error('[Voice Interview] Error parsing resume:', err);
      setErrorMsg('Could not read resume file. Please upload a valid PDF, DOCX, or TXT file.');
    } finally {
      setParsingResume(false);
    }
  };

  const handleRemoveResume = () => {
    setResumeFile(null);
    setResumeFileName('');
    setResumeUrl('');
    setResumeText('');
    setResumeSuccessMsg(null);
  };

  // Call duration counter
  useEffect(() => {
    if (callState === 'calling') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Setup Web Speech Recognition with accumulated transcript and silence detection
  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this browser.');
      return null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    const preferredLang = navigator.language || 'en-IN';
    rec.lang = preferredLang.startsWith('en') ? preferredLang : 'en-US';

    rec.onstart = () => {
      isSpeechActiveRef.current = true;
      setCandidateListening(true);
    };

    rec.onresult = (event: any) => {
      // If AI is speaking or an answer is currently being processed, ignore mic feedback
      if (aiSpeakingRef.current || isProcessingAnswerRef.current) return;

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalTranscript += res[0].transcript + ' ';
        } else {
          interimTranscript += res[0].transcript + ' ';
        }
      }

      const cleanTranscript = (finalTranscript + interimTranscript).trim();

      if (cleanTranscript) {
        accumulatedAnswerRef.current = cleanTranscript;
        updateLiveTranscript(cleanTranscript);
        setCandidateListening(true);

        // Reset silence detection timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // Natural pause detection: when candidate stops speaking for 1.7s, submit the answer automatically!
        silenceTimerRef.current = setTimeout(() => {
          if (
            !aiSpeakingRef.current &&
            !isProcessingAnswerRef.current &&
            accumulatedAnswerRef.current.trim().length > 1
          ) {
            submitCandidateAnswer();
          }
        }, 1700);
      }
    };

    rec.onerror = (e: any) => {
      const err = e.error || 'unknown';
      console.warn('[Speech Recognition] Notice:', err);

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setErrorMsg('Microphone access was denied. Please allow microphone permissions in your browser to proceed.');
        return;
      }

      if (err === 'network') {
        webSpeechNetworkFailuresRef.current += 1;
        isSpeechActiveRef.current = false;
        recognitionRef.current = null;

        if (webSpeechNetworkFailuresRef.current <= 2) {
          console.info(`[Speech Recognition] Network notice. Retrying speech engine (attempt ${webSpeechNetworkFailuresRef.current}/2)...`);
          setTimeout(() => {
            if (callStateRef.current === 'calling' && !aiSpeakingRef.current && !isMicMutedRef.current) {
              startListening();
            }
          }, 800);
        } else {
          console.warn('[Speech Recognition] Web Speech service unavailable on this network. Using AssemblyAI/typed fallback.');
        }
        return;
      }

      if (err === 'no-speech' || err === 'aborted') {
        return;
      }
    };

    rec.onend = () => {
      isSpeechActiveRef.current = false;

      // If candidate finished speaking their answer and the browser ended recognition, process answer immediately!
      if (
        callStateRef.current === 'calling' &&
        !aiSpeakingRef.current &&
        !isProcessingAnswerRef.current &&
        accumulatedAnswerRef.current.trim().length > 1
      ) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        submitCandidateAnswer();
        return;
      }

      // Automatically keep recognition running during the call if not muted and not speaking
      if (callStateRef.current === 'calling' && !isMicMutedRef.current && !aiSpeakingRef.current) {
        try {
          rec.start();
          isSpeechActiveRef.current = true;
          setCandidateListening(true);
        } catch (_) {}
      } else {
        setCandidateListening(false);
      }
    };

    return rec;
  };

  // Web Speech API Secondary Fallback
  const startWebSpeechFallback = () => {
    try {
      if (!recognitionRef.current) {
        recognitionRef.current = initSpeechRecognition();
      }
      if (recognitionRef.current && !isSpeechActiveRef.current) {
        recognitionRef.current.start();
        isSpeechActiveRef.current = true;
        setCandidateListening(true);
      }
    } catch (err: any) {
      console.warn('[Speech Fallback] Notice:', err);
    }
  };

  // Clear 8-second no-reply countdown timer
  const clearNoReplyTimer = () => {
    if (noReplyTimerRef.current) {
      clearTimeout(noReplyTimerRef.current);
      noReplyTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setRemainingWaitSeconds(null);
  };

  // Natural human interview response timer: gives candidate 25s of comfortable thinking time
  const startNoReplyCountdown = () => {
    clearNoReplyTimer();
    setRemainingWaitSeconds(25);

    let secondsLeft = 25;
    countdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft >= 0) {
        setRemainingWaitSeconds(secondsLeft);
      } else {
        clearNoReplyTimer();
      }
    }, 1000);

    noReplyTimerRef.current = setTimeout(async () => {
      clearNoReplyTimer();
      // If candidate has not replied after 25s, offer a gentle verbal check-in instead of abruptly cutting them off
      if (
        callStateRef.current === 'calling' &&
        !aiSpeakingRef.current &&
        !isProcessingAnswerRef.current &&
        accumulatedAnswerRef.current.trim().length === 0
      ) {
        console.info('[Voice Interview] No reply after 25s. Providing gentle conversational reminder...');
        const reminderText = "Take your time. Whenever you're ready, please share your thoughts, or let me know if you would like me to repeat the question.";
        await speakAiResponse(reminderText).catch(() => {});
      }
    }, 25000);
  };

  // Pause candidate mic during AI speech (keeps audio capture and WebSocket warm)
  const pauseListening = () => {
    clearNoReplyTimer();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (deepgramSessionRef.current) {
      deepgramSessionRef.current.pause();
    }
    if (recognitionRef.current && isSpeechActiveRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }
    isSpeechActiveRef.current = false;
    setCandidateListening(false);
  };

  // Resume candidate mic with ZERO delay
  const resumeListening = () => {
    if (aiSpeakingRef.current || isMicMutedRef.current || callStateRef.current !== 'calling') return;
    accumulatedAnswerRef.current = '';
    updateLiveTranscript('');

    if (deepgramSessionRef.current) {
      deepgramSessionRef.current.resume();
      isSpeechActiveRef.current = true;
      setCandidateListening(true);
    } else {
      startListening();
    }
  };

  // Primary Start Listening: Powered by Deepgram Nova-3 Real-Time Streaming Engine
  const startListening = async () => {
    if (aiSpeakingRef.current || isProcessingAnswerRef.current || isMicMutedRef.current) return;

    try {
      if (!deepgramSessionRef.current) {
        // Collect job-specific technical keywords to boost Deepgram speech recognition
        const dynamicKeywords: string[] = [];
        if (voiceInterview?.jobTitle) dynamicKeywords.push(`${voiceInterview.jobTitle}:2`);
        if (voiceInterview?.companyName) dynamicKeywords.push(`${voiceInterview.companyName}:2`);
        if (voiceInterview?.requiredSkills && Array.isArray(voiceInterview.requiredSkills)) {
          voiceInterview.requiredSkills.forEach(skill => {
            if (skill && typeof skill === 'string') dynamicKeywords.push(`${skill.trim()}:2`);
          });
        }

        deepgramSessionRef.current = new DeepgramRealtimeSession({
          onTranscript: (text: string, isFinal: boolean, isSpeechFinal: boolean) => {
            if (aiSpeakingRef.current || isProcessingAnswerRef.current) return;
            console.log(`[Deepgram Nova-3 STT] Candidate voice detected (final=${isFinal}): "${text}"`);
            // Candidate has replied: clear the no-reply countdown
            clearNoReplyTimer();

            accumulatedAnswerRef.current = text;
            updateLiveTranscript(text);
            setCandidateListening(true);

            // Natural pause detection: when candidate finishes sentence or pauses, submit answer
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            const silenceTimeout = isSpeechFinal ? 1500 : 3200;
            silenceTimerRef.current = setTimeout(() => {
              if (
                !aiSpeakingRef.current &&
                !isProcessingAnswerRef.current &&
                accumulatedAnswerRef.current.trim().length > 1
              ) {
                submitCandidateAnswer();
              }
            }, silenceTimeout);
          },
          onSpeechStarted: () => {
            // Conversational Barge-In: If candidate starts speaking while AI was answering, interrupt AI immediately!
            if (aiSpeakingRef.current) {
              console.log('[Deepgram Voice Agent] Barge-in: Candidate started speaking, interrupting AI voice.');
              stopDeepgramAudio();
              if (callRecorderRef.current) {
                callRecorderRef.current.stopAiSpeech();
              }
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                try { window.speechSynthesis.cancel(); } catch (_) {}
              }
              setAiSpeaking(false);
              aiSpeakingRef.current = false;
            }
          },
          onUtteranceEnd: () => {
            // Deepgram VAD UtteranceEnd event: candidate finished speaking their sentence
            if (
              !aiSpeakingRef.current &&
              !isProcessingAnswerRef.current &&
              accumulatedAnswerRef.current.trim().length > 3
            ) {
              // Accelerate submission: candidate stopped talking, respond in 900ms
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = setTimeout(() => {
                if (
                  !aiSpeakingRef.current &&
                  !isProcessingAnswerRef.current &&
                  accumulatedAnswerRef.current.trim().length > 3
                ) {
                  submitCandidateAnswer();
                }
              }, 900);
            }
          },
          onError: (err) => {
            console.warn('[Deepgram Stream] Engine notice:', err);
            if (webSpeechNetworkFailuresRef.current < 2) {
              startWebSpeechFallback();
            }
          }
        }, {
          keywords: dynamicKeywords,
          endpointing: 300,
          utteranceEndMs: 1000,
          fillerWords: true,
          numerals: true,
          smartFormat: true,
        });
      }

      await deepgramSessionRef.current.start();
      isSpeechActiveRef.current = true;
      setCandidateListening(true);
      webSpeechNetworkFailuresRef.current = 0;
    } catch (deepgramErr) {
      console.warn('[Deepgram Stream] Primary start failed, checking fallback:', deepgramErr);
      if (webSpeechNetworkFailuresRef.current < 2) {
        startWebSpeechFallback();
      }
    }
  };

  // Full teardown at end of call or unmount
  const stopListening = () => {
    clearNoReplyTimer();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    // Stop any ongoing speech immediately
    stopDeepgramAudio();
    if (callRecorderRef.current) {
      callRecorderRef.current.stopAiSpeech();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }

    // Stop Deepgram session
    if (deepgramSessionRef.current) {
      try {
        deepgramSessionRef.current.stop();
      } catch (_) {}
      deepgramSessionRef.current = null;
    }

    // Stop Web Speech fallback if running
    if (recognitionRef.current && isSpeechActiveRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }

    isSpeechActiveRef.current = false;
    setCandidateListening(false);
  };

  // Speak AI audio (returns Promise that resolves when audio finishes speaking)
  const speakAiResponse = async (text: string): Promise<void> => {
    pauseListening();
    clearNoReplyTimer();
    setAiSpeaking(true);
    aiSpeakingRef.current = true;

    const finishSpeaking = () => {
      setAiSpeaking(false);
      aiSpeakingRef.current = false;
      if (callStateRef.current === 'calling' && !isMicMutedRef.current) {
        resumeListening();
        // Start 8-second countdown waiting for candidate reply
        startNoReplyCountdown();
      }
    };

    if (isAudioMutedRef.current) {
      await new Promise(r => setTimeout(r, 1200));
      finishSpeaking();
      return;
    }

    // Clean text: strip markdown symbols, URLs, asterisks, brackets so speech is human-accurate
    const cleanSpeech = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/https?:\/\/\S+/gi, ' link ')
      .replace(/(\*\*|__|[*_])([^*_]+)\1/g, '$2')
      .replace(/#{1,6}\s+/g, '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[-*•▪♦▶►]\s+/g, '. ')
      .replace(/&/g, ' and ')
      .replace(/@/g, ' at ')
      .replace(/\//g, ' or ')
      .replace(/[#*^_{}\[\]|\\<>+=~`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 1. Digital call stream injection: fetch Deepgram Aura audio blob and play directly through Call Recorder
    try {
      const deepgramBlob = await fetchDeepgramAudioBlob(cleanSpeech, 'aura-asteria-en');
      if (deepgramBlob && deepgramBlob.size > 0) {
        if (callRecorderRef.current) {
          const played = await callRecorderRef.current.playAiAudioBlob(deepgramBlob, isAudioMutedRef.current);
          if (played) {
            finishSpeaking();
            return;
          }
        } else {
          const played = await synthesizeWithDeepgram(cleanSpeech, {
            voice: 'aura-asteria-en',
            rate: 1.0,
          });
          if (played) {
            finishSpeaking();
            return;
          }
        }
      }
    } catch (deepgramErr) {
      console.warn('[Call Recorder] Deepgram Aura speech notice, triggering native fallback:', deepgramErr);
    }

    // 2. High-Fidelity Fallback using Browser SpeechSynthesis
    return new Promise((resolve) => {
      try {
        unlockTTSAudio();
        speak(cleanSpeech, {
          lang: 'en-US',
          rate: 0.98,
          onEnd: () => {
            finishSpeaking();
            resolve();
          },
          onError: () => {
            finishSpeaking();
            resolve();
          }
        });
      } catch (err) {
        console.warn('[Voice AI] TTS fallback error:', err);
        finishSpeaking();
        resolve();
      }
    });
  };

  // Start Call Handler
  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setErrorMsg('Please enter your Name, Email, and Phone number to begin the screening call.');
      return;
    }

    setErrorMsg(null);
    setCallState('calling');
    callStateRef.current = 'calling';

    // 1. Synchronously pre-warm audio permissions within the user click gesture
    unlockTTSAudio();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    let prewarmedAudioCtx: AudioContext | null = null;
    if (AudioContextClass) {
      try {
        prewarmedAudioCtx = new AudioContextClass();
        if (prewarmedAudioCtx.state === 'suspended') {
          prewarmedAudioCtx.resume().catch(() => {});
        }
      } catch (_) {}
    }

    // 2. Pre-warm the streaming audio session
    try {
      await startListening();
    } catch (_) {}
    pauseListening();

    // 3. Start recording the ENTIRE call (AI question audio + candidate microphone audio)
    try {
      const micStream = deepgramSessionRef.current?.getMediaStream() || 
        await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const recorder = new VoiceCallRecorder();
      await recorder.init(micStream, prewarmedAudioCtx || undefined);
      recorder.start();
      callRecorderRef.current = recorder;
    } catch (recErr) {
      console.warn('[Call Recorder] Failed to initialize recorder:', recErr);
    }

    // Specialize interview questions with exact location (e.g. Nashik) and candidate context/resume
    const baseQuestions = voiceInterviewRef.current?.questions && voiceInterviewRef.current.questions.length > 0 
      ? voiceInterviewRef.current.questions 
      : DEFAULT_SCREENING_QUESTIONS;

    const specializedQuestions = specializeQuestions(
      baseQuestions,
      {
        title: voiceInterviewRef.current?.jobTitle || voiceInterviewRef.current?.title,
        location: voiceInterviewRef.current?.location,
        description: voiceInterviewRef.current?.jobDescription,
        companyName: voiceInterviewRef.current?.companyName
      },
      {
        name: name.trim(),
        currentCity: currentCity.trim(),
        resumeText: resumeText
      }
    );

    if (voiceInterviewRef.current) {
      voiceInterviewRef.current.questions = specializedQuestions;
    }
    setVoiceInterview(prev => prev ? { ...prev, questions: specializedQuestions } : null);

    const firstQuestion = specializedQuestions[0]?.question || 'Please tell me about your background.';
    const greeting = `Hello ${name.trim()}! Thank you for joining this phone screening call for the ${voiceInterviewRef.current?.title || 'position'}. I will ask you a few quick screening questions. You can speak naturally. If you need me to repeat a question at any time, simply say 'repeat question', or say 'skip' to move to the next. Let us start with our first question: ${firstQuestion}`;

    const turn: VoiceInterviewTurn = {
      speaker: 'ai',
      text: greeting,
      timestamp: new Date().toLocaleTimeString(),
      questionId: questions[0].id
    };

    setDialogueHistory([turn]);
    dialogueHistoryRef.current = [turn];

    await speakAiResponse(greeting);
  };

  // Submit Candidate Answer (called on silence timeout, recognition end, 'Done' button, or typed fallback)
  const submitCandidateAnswer = async (overrideText?: string) => {
    if (isProcessingAnswerRef.current || aiSpeakingRef.current) return;

    clearNoReplyTimer();
    const spokenText = (overrideText || accumulatedAnswerRef.current || liveTranscriptRef.current).trim();
    if (!spokenText || spokenText.length < 1) return;

    isProcessingAnswerRef.current = true;
    setIsProcessingAnswer(true);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    // Pause candidate mic so AI response doesn't record itself
    pauseListening();

    try {
      await handleCandidateUtterance(spokenText);
    } finally {
      isProcessingAnswerRef.current = false;
      setIsProcessingAnswer(false);
      // Automatically resume listening for the next question as soon as AI completes speaking!
      if (callStateRef.current === 'calling' && !aiSpeakingRef.current && !isMicMutedRef.current) {
        resumeListening();
        startNoReplyCountdown();
      }
    }
  };

  // Candidate Spoken Utterance Handler (with Intent Detection, Contextual Acknowledgment & Next Question)
  const handleCandidateUtterance = async (candidateText: string) => {
    const questions = voiceInterviewRef.current?.questions && voiceInterviewRef.current.questions.length > 0 
      ? voiceInterviewRef.current.questions 
      : DEFAULT_SCREENING_QUESTIONS;

    const currentIdx = currentQuestionIndexRef.current;
    const currentQ = questions[currentIdx] || questions[0];

    // 1. Log Candidate Turn
    const candTurn: VoiceInterviewTurn = {
      speaker: 'candidate',
      text: candidateText,
      timestamp: new Date().toLocaleTimeString(),
      questionId: currentQ?.id
    };

    const updatedHistory = [...dialogueHistoryRef.current, candTurn];
    setDialogueHistory(updatedHistory);
    dialogueHistoryRef.current = updatedHistory;

    // Clear transcript for next turn
    accumulatedAnswerRef.current = '';
    updateLiveTranscript('');

    // 2. Intent Recognition: Did candidate ask to Repeat or Skip?
    const { intent } = detectCandidateVoiceIntent(candidateText);

    // CASE A: REPEAT INTENT
    if (intent === 'repeat') {
      const activeText = activeCrossQuestionRef.current || currentQ.question;
      const repeatSpeech = `Certainly! Let me repeat that for you: ${activeText}`;
      
      const aiTurn: VoiceInterviewTurn = {
        speaker: 'ai',
        text: repeatSpeech,
        timestamp: new Date().toLocaleTimeString(),
        intent: 'repeat',
        questionId: currentQ.id
      };
      const histWithRepeat = [...updatedHistory, aiTurn];
      setDialogueHistory(histWithRepeat);
      dialogueHistoryRef.current = histWithRepeat;

      await speakAiResponse(repeatSpeech);
      return;
    }

    // CASE B: SKIP INTENT
    if (intent === 'skip') {
      const isLast = currentIdx >= questions.length - 1;
      if (isLast) {
        const finishSpeech = "Understood. That covers all of our questions today. Thank you for your time!";
        const aiTurn: VoiceInterviewTurn = {
          speaker: 'ai',
          text: finishSpeech,
          timestamp: new Date().toLocaleTimeString(),
          intent: 'skip',
          questionId: currentQ.id
        };
        const histWithSkip = [...updatedHistory, aiTurn];
        setDialogueHistory(histWithSkip);
        dialogueHistoryRef.current = histWithSkip;
        await speakAiResponse(finishSpeech);
        await finishAndSaveCall();
        return;
      }

      const nextIdx = currentIdx + 1;
      const nextQ = questions[nextIdx];
      currentQuestionIndexRef.current = nextIdx;
      setCurrentQuestionIndex(nextIdx);
      activeCrossQuestionRef.current = null;
      setActiveCrossQuestion(null);

      const skipSpeech = `No problem, let us move to the next question: ${nextQ.question}`;
      const aiTurn: VoiceInterviewTurn = {
        speaker: 'ai',
        text: skipSpeech,
        timestamp: new Date().toLocaleTimeString(),
        intent: 'skip',
        questionId: nextQ.id
      };
      const histWithSkip = [...updatedHistory, aiTurn];
      setDialogueHistory(histWithSkip);
      dialogueHistoryRef.current = histWithSkip;

      await speakAiResponse(skipSpeech);
      return;
    }

    // CASE C: CANDIDATE ANSWERED
    // If currently answering a cross-question:
    if (activeCrossQuestionRef.current) {
      answersSummaryRef.current.push({
        question: activeCrossQuestionRef.current,
        answer: candidateText
      });
      activeCrossQuestionRef.current = null;
      setActiveCrossQuestion(null);

      // Advance to next main question or finish
      const isLast = currentIdx >= questions.length - 1;
      if (isLast) {
        const closingSpeech = "Got it, thank you for providing that detail! That concludes all our screening questions today. Thank you so much for your time.";
        const aiTurn: VoiceInterviewTurn = {
          speaker: 'ai',
          text: closingSpeech,
          timestamp: new Date().toLocaleTimeString(),
          questionId: currentQ.id
        };
        const finalHist = [...updatedHistory, aiTurn];
        setDialogueHistory(finalHist);
        dialogueHistoryRef.current = finalHist;

        await speakAiResponse(closingSpeech);
        await finishAndSaveCall();
        return;
      }

      const nextIdx = currentIdx + 1;
      const nextQ = questions[nextIdx];
      currentQuestionIndexRef.current = nextIdx;
      setCurrentQuestionIndex(nextIdx);

      const aiSpeech = `Got it, thank you. Let us move to the next question: ${nextQ.question}`;
      const aiTurn: VoiceInterviewTurn = {
        speaker: 'ai',
        text: aiSpeech,
        timestamp: new Date().toLocaleTimeString(),
        questionId: nextQ.id
      };
      const nextHist = [...updatedHistory, aiTurn];
      setDialogueHistory(nextHist);
      dialogueHistoryRef.current = nextHist;

      await speakAiResponse(aiSpeech);
      return;
    }

    // Main Question answered:
    answersSummaryRef.current.push({
      question: currentQ.question,
      answer: candidateText
    });

    // Smart contextual acknowledgment based on screening category
    let acknowledgment = "Got it, thank you.";
    const cat = (currentQ.category || '').toLowerCase();
    if (cat.includes('relocation') || cat.includes('location')) {
      acknowledgment = "Got it, thank you for confirming your relocation and location preference.";
    } else if (cat.includes('notice') || cat.includes('availab')) {
      acknowledgment = "Understood, thank you for sharing your availability and notice period.";
    } else if (cat.includes('salary') || cat.includes('ctc') || cat.includes('compensat')) {
      acknowledgment = "Noted on your compensation expectations, thank you.";
    } else if (cat.includes('skill') || cat.includes('tech')) {
      acknowledgment = "Great, thank you for explaining your core skills.";
    } else if (cat.includes('motivat') || cat.includes('general')) {
      acknowledgment = "Thank you for explaining your background and interest in this role.";
    }

    // Dynamic AI Cross-Questioning Evaluation
    // Check if candidate answer warrants a targeted technical or situational follow-up
    if (!activeCrossQuestionRef.current && candidateText.trim().split(/\s+/).length >= 2) {
      try {
        const crossCheck = await generateCrossQuestionOrAcknowledge(
          currentQ.question,
          candidateText,
          voiceInterviewRef.current?.jobTitle || 'Role'
        );

        if (crossCheck && crossCheck.shouldCrossQuestion && crossCheck.responseText) {
          const followUp = crossCheck.responseText.trim();
          activeCrossQuestionRef.current = followUp;
          setActiveCrossQuestion(followUp);

          const aiTurn: VoiceInterviewTurn = {
            speaker: 'ai',
            text: followUp,
            timestamp: new Date().toLocaleTimeString(),
            isCrossQuestion: true,
            questionId: currentQ.id
          };
          const crossHist = [...updatedHistory, aiTurn];
          setDialogueHistory(crossHist);
          dialogueHistoryRef.current = crossHist;

          await speakAiResponse(followUp);
          return;
        } else if (crossCheck && crossCheck.responseText) {
          acknowledgment = crossCheck.responseText;
        }
      } catch (crossErr) {
        console.warn('[AI Agent] Cross-question decision notice:', crossErr);
      }
    }

    // Advance to next question or conclude
    const isLast = currentIdx >= questions.length - 1;
    if (isLast) {
      const closingSpeech = `${acknowledgment} That concludes all of our screening questions today! Thank you so much for your time.`;
      const aiTurn: VoiceInterviewTurn = {
        speaker: 'ai',
        text: closingSpeech,
        timestamp: new Date().toLocaleTimeString(),
        questionId: currentQ.id
      };
      const finalHist = [...updatedHistory, aiTurn];
      setDialogueHistory(finalHist);
      dialogueHistoryRef.current = finalHist;

      await speakAiResponse(closingSpeech);
      await finishAndSaveCall();
      return;
    }

    const nextIdx = currentIdx + 1;
    const nextQ = questions[nextIdx];
    currentQuestionIndexRef.current = nextIdx;
    setCurrentQuestionIndex(nextIdx);

    const transitionSpeech = `${acknowledgment} Let us move to the next question: ${nextQ.question}`;
    const aiTurn: VoiceInterviewTurn = {
      speaker: 'ai',
      text: transitionSpeech,
      timestamp: new Date().toLocaleTimeString(),
      questionId: nextQ.id
    };
    const nextHist = [...updatedHistory, aiTurn];
    setDialogueHistory(nextHist);
    dialogueHistoryRef.current = nextHist;

    await speakAiResponse(transitionSpeech);
  };

  // Button actions for candidate convenience
  const handleManualRepeat = () => {
    submitCandidateAnswer();
    handleCandidateUtterance('can you please repeat the question');
  };

  const handleManualSkip = () => {
    handleCandidateUtterance('skip this question');
  };

  // End Call & Generate Report
  const finishAndSaveCall = async () => {
    stopListening();
    clearNoReplyTimer();
    setCallState('completed');
    setSavingReport(true);
    setUploadingRecording(true);

    const endMsg = 'Thank you very much for completing this phone screening call. We have recorded your responses, and our hiring team will review your screening report and be in touch soon. Have a great day!';
    speakAiResponse(endMsg).catch(() => {});

    // 1. Stop call recorder, analyze with Deepgram Speech Intelligence, and upload full recording to AWS S3
    let audioRecordingUrl = '';
    let speechAnalytics: VoiceInterviewResponse['speechAnalytics'] = undefined;
    if (callRecorderRef.current) {
      try {
        const audioBlob = await callRecorderRef.current.stop();
        if (audioBlob && audioBlob.size > 0) {
          // Deepgram Speech-to-Text intelligence services: sentiment, filler words, confidence
          try {
            const dgAnalysis = await transcribeAudioBlobWithDeepgram(audioBlob, {
              sentiment: true,
              fillerWords: true,
              diarize: true,
            });
            if (dgAnalysis) {
              speechAnalytics = {
                transcriptionEngine: 'Deepgram Nova-3 Speech AI',
                averageConfidence: Math.round(dgAnalysis.confidence * 100),
                fillerWordsDetected: dgAnalysis.fillerWordsCount,
                sentiment: dgAnalysis.sentiment,
                detectedLanguage: dgAnalysis.detectedLanguage,
              };
              console.info('[Voice Interview] Deepgram speech intelligence extracted:', speechAnalytics);
            }
          } catch (dgErr) {
            console.warn('[Voice Interview] Deepgram post-call speech analysis notice:', dgErr);
          }

          console.info(`[Voice Interview] Uploading call audio to AWS S3 (${(audioBlob.size / 1024).toFixed(1)} KB)...`);
          const fileName = `voice_call_${voiceInterviewId || 'screening'}_${Date.now()}.webm`;
          audioRecordingUrl = await uploadToS3(audioBlob, 'auto', fileName);
          console.info(`[Voice Interview] Uploaded successfully to AWS S3:`, audioRecordingUrl);
          setRecordedAudioUrl(audioRecordingUrl);
        }
      } catch (uploadErr) {
        console.warn('[Voice Interview] S3 call recording upload warning:', uploadErr);
      } finally {
        callRecorderRef.current.destroy();
        callRecorderRef.current = null;
      }
    }
    setUploadingRecording(false);

    try {
      const screeningReport = await evaluateVoiceInterviewSession(
        voiceInterview?.jobTitle || voiceInterview?.title || 'Job Screening',
        dialogueHistoryRef.current,
        { 
          name: name.trim(), 
          email: email.trim(), 
          phone: phone.trim(),
          currentCity: currentCity.trim(),
          resumeText: resumeText || ''
        },
        {
          jobDescription: voiceInterview?.jobDescription,
          location: voiceInterview?.location,
          companyName: voiceInterview?.companyName
        }
      );

      const responsePayload: VoiceInterviewResponse = {
        id: `vresp_${Date.now()}`,
        voiceInterviewId: voiceInterview?.id || voiceInterviewId || 'voice_default',
        jobId: voiceInterview?.jobId || voiceInterview?.interviewId,
        recruiterUID: voiceInterview?.recruiterUID || 'SYSTEM',
        candidateInfo: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          currentCity: currentCity.trim(),
          resumeUrl: resumeUrl || undefined,
          resumeFileName: resumeFileName || undefined,
          resumeText: resumeText || undefined
        },
        candidateResumeUrl: resumeUrl || undefined,
        candidateResumeFileName: resumeFileName || undefined,
        dialogueHistory: dialogueHistoryRef.current,
        answersSummary: answersSummaryRef.current,
        screeningReport,
        callDurationSeconds: callDuration,
        audioRecordingUrl: audioRecordingUrl || undefined,
        speechAnalytics,
        status: screeningReport.recommendation === 'Shortlist' ? 'Shortlist' : 'Completed',
        submittedAt: new Date()
      };

      await saveVoiceInterviewResponse(responsePayload);
      setCompletedResponse(responsePayload);
    } catch (err) {
      console.error('[Voice Interview] Evaluation error:', err);
    } finally {
      setSavingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col items-center justify-center p-4">
        <div className="h-10 w-10 border-3 border-[#E4E7DC] border-t-[#111215] rounded-full animate-spin mb-4" />
        <p className="geist-caption text-[#575A51] font-medium">Connecting to Voice Interview Screener...</p>
      </div>
    );
  }

  if (errorMsg && callState !== 'calling' && callState !== 'completed') {
    return (
      <div className="min-h-screen bg-[#F8F9F5] text-[#111215] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
          <div className="h-12 w-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-500 mx-auto">
            <AlertCircle size={26} />
          </div>
          <h2 className="geist-heading text-xl font-bold text-[#111215]">Voice Interview Unavailable</h2>
          <p className="geist-caption text-red-600 text-sm">{errorMsg}</p>
          <Link
            to="/jobs"
            className="geist-small inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111215] text-white font-bold hover:bg-black transition-all mt-2"
          >
            Explore Other Jobs
          </Link>
        </div>
      </div>
    );
  }

  const questions = voiceInterview?.questions && voiceInterview.questions.length > 0 
    ? voiceInterview.questions 
    : DEFAULT_SCREENING_QUESTIONS;

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#111215] font-sans selection:bg-[#D4F82C] selection:text-[#111215] flex flex-col justify-between relative overflow-x-hidden">
      {/* Background Organic Glow & Curve elements (Landing Page signature) */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#D4F82C]/10 rounded-full blur-3xl pointer-events-none -mr-40 -mt-40 select-none z-0" />
      <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-[#A4D804]/8 rounded-full blur-3xl pointer-events-none -ml-40 -mb-40 select-none z-0" />

      {/* Top Header (Matching Landing Page Header) */}
      <header className="sticky top-0 z-50 bg-[#F8F9F5]/90 backdrop-blur-md border-b border-[#E4E7DC] px-4 py-3.5 sm:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="group inline-flex items-center" title="hireX - AI Recruitment Platform">
              <HireXLogo size="sm" variant="full" />
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-[#E4E7DC] text-[11px] font-medium text-[#73766C]">
              <span>by</span>
              <span className="font-bold text-[#111215]">SNAB</span>
            </div>
            <div className="flex items-center gap-1.5 pl-2 text-xs font-semibold">
              <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full bg-[#D4F82C]/30 text-[#111215] border border-[#D4F82C]/50 font-bold text-[11px]">
                AI Voice Screener
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-[#111215] leading-tight">
                {voiceInterview?.title || 'Screening Call'}
              </div>
              <div className="text-[11px] text-[#73766C] leading-tight">
                {voiceInterview?.companyName || 'SNAB hireX'}
              </div>
            </div>

            {callState === 'calling' && (
              <div className="flex items-center gap-2 bg-[#111215] text-[#D4F82C] px-3.5 py-1.5 rounded-full font-mono text-xs font-bold shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#D4F82C] animate-pulse" />
                <span>{formatTime(callDuration)}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 sm:py-10 flex flex-col justify-center relative z-10">
        {/* STEP 1: Candidate Verification & Call Intro */}
        {callState === 'details' && (
          <div className="w-full rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-[#D4F82C] text-[#111215] items-center justify-center shadow-md shadow-[#D4F82C]/30 mb-2">
                <Mic size={24} className="text-[#111215]" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111215] tracking-tight">
                {voiceInterview?.title}
              </h1>
              <p className="text-[#575A51] text-sm max-w-lg mx-auto leading-relaxed">
                No video camera required. You will have a quick, conversational phone screening with our AI recruiter to discuss your experience, relocation, notice period, and skills.
              </p>
            </div>

            {dumpFoundNotice && (
              <div className="rounded-xl bg-[#F0F4E8] border border-[#C5DC8A] p-3.5 flex items-center gap-2.5 text-xs font-semibold text-[#245903]">
                <CheckCircle2 size={16} className="shrink-0 text-[#245903]" />
                <span>{dumpFoundNotice}</span>
              </div>
            )}

            <form onSubmit={handleStartCall} className="space-y-4">
              {/* Resume Upload Input */}
              <div className="rounded-2xl border-2 border-dashed border-[#D5D9CC] bg-[#F8F9F5] p-5 text-center hover:bg-[#F0F2EB] hover:border-[#111215] transition-all">
                <input
                  type="file"
                  id="voice-resume-file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleResumeUpload}
                  disabled={parsingResume}
                />
                {resumeFileName ? (
                  <div className="flex items-center justify-between bg-white border border-[#E4E7DC] rounded-xl p-3.5 shadow-sm">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-2 rounded-lg bg-[#D4F82C]/30 text-[#111215]">
                        <FileCheck size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-[#111215] text-sm">
                          {resumeFileName}
                        </div>
                        <span className="text-[#575A51] text-xs">
                          Resume parsed • Screening questions customized to your profile
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveResume}
                      className="p-1.5 text-[#73766C] hover:text-red-600 transition-colors cursor-pointer"
                      title="Remove resume"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <label htmlFor="voice-resume-file" className="cursor-pointer block space-y-2 py-1">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-white border border-[#E4E7DC] flex items-center justify-center text-[#111215] shadow-sm">
                      {parsingResume ? (
                        <div className="w-5 h-5 border-2 border-[#111215] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <UploadCloud size={24} className="text-[#111215]" />
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-[#111215] text-sm hover:underline">
                        {parsingResume ? 'Reading and analyzing resume...' : 'Upload Resume (PDF / DOCX / TXT)'}
                      </span>
                      <p className="text-[#73766C] text-xs mt-0.5">
                        Optional: Auto-fills your details & tailors conversational screening questions
                      </p>
                    </div>
                  </label>
                )}
              </div>

              {resumeSuccessMsg && (
                <div className="rounded-xl bg-[#F0F4E8] border border-[#C5DC8A] p-3 flex items-center gap-2.5 text-xs font-semibold text-[#245903]">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{resumeSuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#111215] mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[#E4E7DC] bg-white px-4 py-2.5 text-[#111215] placeholder-[#9ca3af] focus:border-[#111215] focus:ring-2 focus:ring-[#111215]/5 outline-none transition-all text-sm font-medium shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#111215] mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. rahul@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#E4E7DC] bg-white px-4 py-2.5 text-[#111215] placeholder-[#9ca3af] focus:border-[#111215] focus:ring-2 focus:ring-[#111215]/5 outline-none transition-all text-sm font-medium shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#111215] mb-1.5">
                    Phone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#E4E7DC] bg-white px-4 py-2.5 text-[#111215] placeholder-[#9ca3af] focus:border-[#111215] focus:ring-2 focus:ring-[#111215]/5 outline-none transition-all text-sm font-medium shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#111215] mb-1.5">
                  Current City / Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai, Maharashtra"
                  value={currentCity}
                  onChange={(e) => setCurrentCity(e.target.value)}
                  className="w-full rounded-xl border border-[#E4E7DC] bg-white px-4 py-2.5 text-[#111215] placeholder-[#9ca3af] focus:border-[#111215] focus:ring-2 focus:ring-[#111215]/5 outline-none transition-all text-sm font-medium shadow-sm"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] text-xs text-[#575A51] space-y-1.5 leading-relaxed">
                <div className="font-bold text-[#111215] flex items-center gap-1.5">
                  <Shield size={14} className="text-[#111215]" /> Screening Tips:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[#73766C]">
                  <li>Ensure your microphone and speaker volume are turned on.</li>
                  <li>Speak clearly at your normal conversational speaking speed.</li>
                  <li>You can say <strong>"repeat question"</strong> or <strong>"skip"</strong> at any time.</li>
                </ul>
              </div>

              <button
                type="submit"
                className="w-full h-13 rounded-xl bg-[#111215] hover:bg-black text-white font-extrabold flex items-center justify-center gap-2.5 shadow-xl shadow-black/10 hover:shadow-black/20 hover:scale-[1.005] active:scale-[0.99] transition-all text-sm cursor-pointer"
              >
                <Phone size={17} className="text-[#D4F82C]" />
                <span>Start Voice Screening Call</span>
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: ACTIVE CALLER SCREEN */}
        {callState === 'calling' && (
          <div className="w-full rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.06)] flex flex-col items-center text-center space-y-7 relative overflow-hidden">
            {/* Subtle Landing Page Ambient Glow */}
            <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#D4F82C]/15 blur-3xl pointer-events-none" />

            {/* Caller Header & Active Question Banner */}
            <div className="w-full max-w-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4F82C] border border-[#BCE804] text-[#111215] font-black uppercase tracking-wider text-[11px] shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-[#111215] animate-pulse" />
                  Live Phone Screening
                </span>
                <span className="text-[#111215] font-mono font-bold text-xs bg-[#F0F2EB] px-3 py-1 rounded-full border border-[#E4E7DC]">
                  {formatTime(callDuration)}
                </span>
              </div>

              {/* Current Question Display Card */}
              <div className="rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] p-5 text-left space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#73766C]">
                  <span className="font-extrabold text-[#111215] uppercase tracking-wider text-[11px] bg-[#D4F82C]/40 px-2 py-0.5 rounded border border-[#D4F82C]">
                    {activeCrossQuestion ? 'Clarification Follow-Up' : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
                  </span>
                  <span className="text-[#73766C] font-medium text-[11px]">
                    {voiceInterview?.title}
                  </span>
                </div>
                <h3 className="text-[#111215] text-base sm:text-lg font-bold leading-relaxed tracking-tight pt-1">
                  {activeCrossQuestion || questions[currentQuestionIndex]?.question || 'Loading question...'}
                </h3>
              </div>
            </div>

            {/* Visual Equalizer / Avatar */}
            <div className="relative flex items-center justify-center my-1">
              {/* Pulsing Outer Rings */}
              <div className={`absolute w-36 h-36 rounded-full border transition-all duration-700 ${
                aiSpeaking 
                  ? 'border-[#111215]/20 animate-ping' 
                  : candidateListening 
                    ? 'border-[#D4F82C] animate-ping' 
                    : 'border-[#E4E7DC]'
              }`} />
              <div className={`h-28 w-28 rounded-full border-4 flex items-center justify-center shadow-xl relative z-10 transition-all ${
                aiSpeaking 
                  ? 'bg-[#111215] text-[#D4F82C] border-[#111215] shadow-black/20' 
                  : 'bg-[#D4F82C] text-[#111215] border-[#111215] shadow-[#D4F82C]/30'
              }`}>
                {aiSpeaking ? (
                  <Volume2 size={40} className="text-[#D4F82C] animate-pulse" />
                ) : (
                  <Mic size={40} className={`text-[#111215] ${candidateListening ? 'animate-bounce' : ''}`} />
                )}
              </div>
            </div>

            {/* Realtime Live Spoken Transcript Teleprompter */}
            <div className="w-full max-w-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                  {aiSpeaking ? (
                    <span className="text-[#111215] bg-[#D4F82C]/30 border border-[#D4F82C] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#111215] animate-ping" />
                      AI Recruiter Speaking
                    </span>
                  ) : isProcessingAnswer ? (
                    <span className="text-[#111215] bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 border-2 border-[#111215]/40 border-t-[#111215] rounded-full animate-spin" />
                      Processing Response...
                    </span>
                  ) : candidateListening ? (
                    <span className="text-[#111215] bg-[#F0F2EB] border border-[#E4E7DC] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <Mic size={13} className="text-[#111215] animate-pulse" />
                      Listening to You (Speak Now)
                    </span>
                  ) : (
                    <span className="text-[#73766C] flex items-center gap-1.5">
                      <Mic size={13} />
                      Microphone Ready
                    </span>
                  )}
                </span>

                {remainingWaitSeconds !== null && !aiSpeaking && !isProcessingAnswer && (
                  remainingWaitSeconds <= 10 ? (
                    <span className="text-xs font-mono flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-bold bg-amber-50 text-amber-800 border-amber-200 animate-pulse">
                      <Clock size={12} />
                      <span>{liveTranscript ? `Submitting in ${remainingWaitSeconds}s` : `Checking in (${remainingWaitSeconds}s)`}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-[#73766C] flex items-center gap-1.5 bg-[#F0F2EB] px-2.5 py-0.5 rounded-full border border-[#E4E7DC]">
                      <Clock size={12} />
                      <span>Take your time to think</span>
                    </span>
                  )
                )}

                {liveTranscript && (
                  <span className="text-xs text-[#111215] font-mono font-bold flex items-center gap-1 bg-[#D4F82C]/40 px-2.5 py-0.5 rounded-full border border-[#D4F82C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#111215] animate-ping" />
                    Audio Captured
                  </span>
                )}
              </div>

              {/* Dedicated Realtime Transcript Box */}
              <div className={`min-h-[96px] p-4 sm:p-5 rounded-2xl border-2 transition-all text-left flex flex-col justify-center relative overflow-hidden ${
                liveTranscript 
                  ? 'bg-white border-[#111215] shadow-lg shadow-black/5' 
                  : 'bg-[#F8F9F5] border-[#E4E7DC]'
              }`}>
                {liveTranscript ? (
                  <div className="space-y-1.5">
                    <p className="text-[#111215] text-base sm:text-lg font-bold leading-relaxed">
                      "{liveTranscript}"
                      <span className="inline-block w-2 h-4 ml-1 bg-[#111215] animate-pulse align-middle" />
                    </p>
                    <p className="text-xs text-[#575A51] font-mono flex items-center justify-between pt-0.5">
                      <span className="font-bold text-[#111215]">✓ Live speech recorded</span>
                      <span>Pause or tap 'I am Done Answering' ➔</span>
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-2 space-y-1.5">
                    <p className="text-[#575A51] text-sm font-medium">
                      {aiSpeaking 
                        ? 'AI recruiter is asking the question. Listen carefully...' 
                        : isProcessingAnswer 
                          ? 'Evaluating your response and preparing the next question...' 
                          : 'Speak your answer naturally when you are ready. Your words will appear here in real time.'}
                    </p>
                    {!aiSpeaking && !isProcessingAnswer && (
                      <div className="flex items-center justify-center gap-1 pt-1">
                        <span className="h-3 w-1 bg-[#111215]/30 rounded-full animate-pulse" />
                        <span className="h-6 w-1 bg-[#111215]/60 rounded-full animate-pulse delay-75" />
                        <span className="h-8 w-1 bg-[#111215] rounded-full animate-pulse delay-150" />
                        <span className="h-5 w-1 bg-[#111215]/60 rounded-full animate-pulse delay-200" />
                        <span className="h-2 w-1 bg-[#111215]/30 rounded-full animate-pulse delay-300" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Optional Inline Text Input for 100% Reliability */}
              {!aiSpeaking && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-[#73766C]">💡 Speak at a comfortable pace. Tap 'Done Answering' when finished.</span>
                  <button
                    type="button"
                    onClick={() => setShowTextInput(!showTextInput)}
                    className="text-xs text-[#575A51] hover:text-[#111215] font-semibold underline transition-colors cursor-pointer"
                  >
                    {showTextInput ? 'Hide text fallback' : 'Microphone issue? Type answer instead'}
                  </button>
                </div>
              )}

              {showTextInput && !aiSpeaking && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (typedAnswer.trim()) {
                      submitCandidateAnswer(typedAnswer.trim());
                      setTypedAnswer('');
                      setShowTextInput(false);
                    }
                  }}
                  className="flex gap-2 pt-1"
                >
                  <input
                    type="text"
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    placeholder="Type your response here..."
                    className="flex-1 rounded-xl bg-white border border-[#E4E7DC] px-4 py-2.5 text-sm text-[#111215] placeholder-[#9ca3af] focus:border-[#111215] focus:outline-none shadow-sm"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#111215] hover:bg-black text-white font-extrabold text-sm transition-all cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              )}
            </div>

            {/* Primary Action Button: Done Speaking / Ask Next Question */}
            {!aiSpeaking && (
              <div className="w-full max-w-sm pt-1">
                <button
                  type="button"
                  onClick={() => submitCandidateAnswer()}
                  disabled={isProcessingAnswer}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#111215] hover:bg-black active:scale-[0.98] text-white font-extrabold text-sm shadow-xl shadow-black/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>{liveTranscript ? 'Done Speaking (Ask Next Question)' : 'I am Done Answering (Next)'}</span>
                  <ArrowRight size={17} className="text-[#D4F82C]" />
                </button>
              </div>
            )}

            {/* Secondary Call Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pt-1">
              <button
                type="button"
                onClick={handleManualRepeat}
                disabled={aiSpeaking || isProcessingAnswer}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] hover:bg-[#EAECE3] text-[#111215] font-semibold text-xs transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
                title="Repeat the question"
              >
                <RotateCcw size={14} />
                <span>Repeat Question</span>
              </button>

              <button
                type="button"
                onClick={handleManualSkip}
                disabled={aiSpeaking || isProcessingAnswer}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E7DC] bg-[#F8F9F5] hover:bg-[#EAECE3] text-[#111215] font-semibold text-xs transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
                title="Skip this question"
              >
                <FastForward size={14} />
                <span>Skip Question</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextMute = !isMicMuted;
                  setIsMicMuted(nextMute);
                  if (nextMute) pauseListening();
                  else resumeListening();
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-colors text-xs font-semibold cursor-pointer shadow-sm ${
                  isMicMuted 
                    ? 'border-red-200 bg-red-50 text-red-600' 
                    : 'border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] hover:bg-[#EAECE3]'
                }`}
              >
                {isMicMuted ? <MicOff size={14} /> : <Mic size={14} />}
                <span>{isMicMuted ? 'Mic Muted' : 'Mute Mic'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextAudioMute = !isAudioMuted;
                  setIsAudioMuted(nextAudioMute);
                  if (nextAudioMute) {
                    stopDeepgramAudio();
                    if (callRecorderRef.current) callRecorderRef.current.stopAiSpeech();
                    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                      try { window.speechSynthesis.cancel(); } catch (_) {}
                    }
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-colors text-xs font-semibold cursor-pointer shadow-sm ${
                  isAudioMuted 
                    ? 'border-amber-200 bg-amber-50 text-amber-700' 
                    : 'border-[#E4E7DC] bg-[#F8F9F5] text-[#111215] hover:bg-[#EAECE3]'
                }`}
                title="Mute or unmute AI speech voice output"
              >
                {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>{isAudioMuted ? 'Voice Muted' : 'Mute Voice'}</span>
              </button>

              <button
                type="button"
                onClick={finishAndSaveCall}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-md shadow-red-600/20 cursor-pointer"
              >
                <PhoneOff size={15} />
                <span>End Call</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CALL COMPLETED SCREEN */}
        {callState === 'completed' && (
          <div className="w-full rounded-3xl border border-[#E4E7DC] bg-white p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] text-center space-y-6">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-[#D4F82C] border-2 border-[#A4D804] items-center justify-center text-[#111215] shadow-lg shadow-[#D4F82C]/30">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#111215] tracking-tight">
                Screening Call Completed!
              </h2>
              <p className="text-[#575A51] mt-2 max-w-md mx-auto text-sm leading-relaxed">
                Thank you, <span className="text-[#111215] font-bold">{name}</span>. Your screening conversation has been recorded and evaluated for the hiring team.
              </p>
            </div>

            {savingReport ? (
              <div className="p-5 rounded-2xl bg-[#F8F9F5] border border-[#E4E7DC] flex items-center justify-center gap-3 text-sm font-semibold text-[#111215]">
                <span className="h-4 w-4 border-2 border-[#111215]/30 border-t-[#111215] rounded-full animate-spin" />
                <span>Finalizing your screening evaluation report...</span>
              </div>
            ) : completedResponse ? (
              <div className="rounded-2xl border border-[#E4E7DC] bg-[#F8F9F5] p-5 sm:p-6 text-left space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E7DC] pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Screening Call Score</span>
                    <div className="text-3xl font-black text-[#111215] mt-0.5">
                      {completedResponse.screeningReport.overallScore} <span className="text-base font-bold text-[#73766C]">/ 10</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#73766C]">Call Duration</span>
                    <div className="font-mono font-bold text-lg text-[#111215] mt-0.5">
                      {formatTime(completedResponse.callDurationSeconds)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-white border border-[#E4E7DC]">
                    <div className="text-xs font-bold text-[#73766C] uppercase tracking-wider">Relocation Readiness</div>
                    <div className="font-bold text-[#111215] text-sm mt-0.5">
                      {completedResponse.screeningReport.relocationStatus}
                    </div>
                    {completedResponse.screeningReport.relocationDetails && (
                      <div className="text-xs text-[#575A51] mt-1 leading-normal">
                        {completedResponse.screeningReport.relocationDetails}
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E4E7DC]">
                    <div className="text-xs font-bold text-[#73766C] uppercase tracking-wider">Notice Period & Salary</div>
                    <div className="font-bold text-[#111215] text-sm mt-0.5">
                      {completedResponse.screeningReport.noticePeriod || 'Not specified'}
                    </div>
                    {completedResponse.screeningReport.salaryExpectation && (
                      <div className="text-xs text-[#575A51] mt-1 leading-normal">
                        CTC: {completedResponse.screeningReport.salaryExpectation}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-sm text-[#575A51] italic leading-relaxed pt-1">
                  "{completedResponse.screeningReport.summary}"
                </p>

                {(completedResponse.audioRecordingUrl || recordedAudioUrl) && (
                  <div className="rounded-xl border border-[#E4E7DC] bg-white p-4 space-y-2 pt-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#111215] flex items-center gap-1.5 uppercase tracking-wide">
                        <Volume2 size={15} /> Full Call Audio Recording (AWS S3)
                      </span>
                      <a
                        href={completedResponse.audioRecordingUrl || recordedAudioUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#111215] hover:underline font-mono text-[11px] font-bold"
                      >
                        Download Audio ↗
                      </a>
                    </div>
                    <audio 
                      controls 
                      src={completedResponse.audioRecordingUrl || recordedAudioUrl || ''} 
                      className="w-full h-10 mt-1 rounded-lg" 
                    />
                  </div>
                )}
              </div>
            ) : null}

            {completedResponse ? (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to={`/voice-report/${completedResponse.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#111215] hover:bg-black text-white font-extrabold text-sm transition-all shadow-lg shadow-black/10 cursor-pointer"
                >
                  <FileText size={16} className="text-[#D4F82C]" />
                  <span>View Full Screening Report ↗</span>
                </Link>
                <Link
                  to="/jobs"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-[#F8F9F5] text-[#111215] font-bold text-sm transition-all border border-[#E4E7DC] shadow-sm"
                >
                  <span>Explore Other Open Jobs</span>
                  <Briefcase size={15} />
                </Link>
              </div>
            ) : (
              <div className="pt-2">
                <Link
                  to="/jobs"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#111215] hover:bg-black text-white font-extrabold text-sm transition-all shadow-lg shadow-black/10"
                >
                  <span>Explore Other Open Jobs</span>
                  <Briefcase size={15} />
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer (Matching Landing Page Footer) */}
      <footer className="border-t border-[#E4E7DC] py-4 text-center text-xs font-medium text-[#73766C] bg-[#F8F9F5] relative z-10">
        Powered by SNAB hireX AI Voice Screener • Secure & Audio-Encrypted
      </footer>
    </div>
  );
};

export default CandidateVoiceInterview;
