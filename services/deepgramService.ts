/**
 * services/deepgramService.ts
 * Deepgram Voice AI & Conversational Speech Engine for InterviewXpert
 *
 * Provides:
 * 1. Deepgram Real-Time STT (Nova-3 streaming WebSocket with VAD & Barge-in)
 * 2. Deepgram Text-to-Speech (Aura conversational voice models)
 * 3. Unified turn-taking, pause, resume, and audio playback control
 */

export const getDeepgramApiKey = (): string => {
  return (
    (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_DEEPGRAM_API_KEY || (import.meta.env as any)?.DEEPGRAM_API_KEY)) ||
    ''
  );
};

export type DeepgramAuraVoice =
  | 'aura-asteria-en' // Warm, professional female (Default)
  | 'aura-luna-en'    // Calm, clear female
  | 'aura-stella-en'  // Expressive, engaging female
  | 'aura-arcas-en'   // Grounded, natural male
  | 'aura-zeus-en'    // Deep, authoritative male
  | 'aura-angus-en';  // Conversational, friendly male

export interface DeepgramStreamCallbacks {
  onTranscript: (
    text: string,
    isFinal: boolean,
    isSpeechFinal: boolean,
    meta?: { confidence?: number; words?: any[]; fillerWords?: string[] }
  ) => void;
  onSpeechStarted?: () => void;
  onUtteranceEnd?: () => void;
  onError?: (err: any) => void;
  onStateChange?: (state: 'connecting' | 'listening' | 'paused' | 'closed' | 'error') => void;
}

export interface DeepgramSynthesizeOptions {
  voice?: DeepgramAuraVoice;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

let activeDeepgramAudio: HTMLAudioElement | null = null;

let activeDeepgramPlaySequence = 0;

/**
 * Stop any currently playing Deepgram Aura audio stream (Immediate Barge-in)
 */
export const stopDeepgramAudio = (): void => {
  activeDeepgramPlaySequence++;
  if (activeDeepgramAudio) {
    try {
      activeDeepgramAudio.pause();
      activeDeepgramAudio.currentTime = 0;
      activeDeepgramAudio.src = '';
    } catch (_) {}
    activeDeepgramAudio = null;
  }
};

/**
 * Fetch Deepgram Aura synthesized audio Blob for a given text
 */
export const fetchDeepgramAudioBlob = async (
  text: string,
  voice: DeepgramAuraVoice = 'aura-asteria-en'
): Promise<Blob | null> => {
  if (!text || !text.trim()) return null;

  // Clean text intelligently: keep natural punctuation (. , ? ! :) for expressive cadence
  const cleanText = text
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

  if (!cleanText) return null;

  // 1. Primary: Secure Serverless Backend Proxy — 100% Leakproof, zero client keys needed
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const proxyRes = await fetch('/api/deepgram?action=speak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: cleanText, voice }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (proxyRes.ok) {
      return await proxyRes.blob();
    }
  } catch (proxyErr) {
    console.warn('[Deepgram TTS] Server proxy notice (trying direct fallback):', proxyErr);
  }

  // 2. Direct client fallback (if direct key is provided in dev)
  const apiKey = getDeepgramApiKey();
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout guard

    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: cleanText }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Deepgram TTS] HTTP ${response.status}:`, await response.text().catch(() => ''));
      return null;
    }

    return await response.blob();
  } catch (err) {
    console.warn('[Deepgram TTS] Fetch notice (fallback will trigger):', err);
    return null;
  }
};

/**
 * Synthesize and play speech directly using Deepgram Aura Voice
 */
export const synthesizeWithDeepgram = async (
  text: string,
  options?: DeepgramSynthesizeOptions
): Promise<boolean> => {
  stopDeepgramAudio();
  const sequenceId = activeDeepgramPlaySequence;

  const blob = await fetchDeepgramAudioBlob(text, options?.voice || 'aura-asteria-en');
  // Discard blob if stopped or superseded by another speech request during fetch
  if (activeDeepgramPlaySequence !== sequenceId) {
    return false;
  }
  if (!blob || blob.size === 0) return false;

  return new Promise((resolve) => {
    let finished = false;
    let url = '';

    const cleanup = () => {
      if (!finished) {
        finished = true;
        if (url) URL.revokeObjectURL(url);
        if (activeDeepgramAudio === audio) {
          activeDeepgramAudio = null;
        }
      }
    };

    let audio: HTMLAudioElement;
    try {
      if (activeDeepgramPlaySequence !== sequenceId) {
        resolve(false);
        return;
      }
      url = URL.createObjectURL(blob);
      audio = new Audio(url);
      activeDeepgramAudio = audio;

      if (options?.rate && options.rate > 0.5 && options.rate < 2.0) {
        audio.playbackRate = options.rate;
      }

      // Safety timeout: estimated duration from blob size or default 15s
      const estimatedMs = Math.max(4000, Math.min(30000, (blob.size / 3200) * 1000 + 4000));
      const safetyTimer = setTimeout(() => {
        if (!finished) {
          cleanup();
          options?.onEnd?.();
          resolve(true);
        }
      }, estimatedMs);

      audio.onplay = () => {
        options?.onStart?.();
      };

      audio.onended = () => {
        clearTimeout(safetyTimer);
        cleanup();
        options?.onEnd?.();
        resolve(true);
      };

      audio.onerror = (e) => {
        clearTimeout(safetyTimer);
        cleanup();
        options?.onError?.(e);
        resolve(false);
      };

      try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err) => {
            console.warn('[Deepgram TTS] Direct audio playback prevented:', err);
            clearTimeout(safetyTimer);
            cleanup();
            options?.onError?.(err);
            resolve(false);
          });
        }
      } catch (err) {
        console.warn('[Deepgram TTS] Direct audio playback error:', err);
        clearTimeout(safetyTimer);
        cleanup();
        options?.onError?.(err);
        resolve(false);
      }
    } catch (err) {
      cleanup();
      options?.onError?.(err);
      resolve(false);
    }
  });
};

export interface DeepgramTranscriptionResult {
  transcript: string;
  confidence: number;
  words: any[];
  fillerWordsCount: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  detectedLanguage?: string;
  paragraphs?: string;
  diarizedSegments?: Array<{
    speaker: number;
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Transcribe pre-recorded audio Blob with Deepgram Nova-3 REST API using full Deepgram Intelligence services:
 * - Smart formatting & punctuation
 * - Diarization (speaker separation)
 * - Sentiment analysis
 * - Filler words detection ("um", "uh", "like")
 * - Language detection
 */
export const transcribeAudioBlobWithDeepgram = async (
  audioBlob: Blob,
  options?: {
    model?: string;
    smartFormat?: boolean;
    punctuate?: boolean;
    diarize?: boolean;
    sentiment?: boolean;
    fillerWords?: boolean;
  }
): Promise<DeepgramTranscriptionResult | null> => {
  if (!audioBlob || audioBlob.size === 0) return null;

  // 1. Primary: Secure Serverless Backend Proxy (/api/deepgram) — 100% Leakproof
  try {
    const proxyRes = await fetch('/api/deepgram?action=transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': audioBlob.type || 'audio/webm',
      },
      body: audioBlob,
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.success && json.data) {
        return parseDeepgramData(json.data);
      }
    }
  } catch (proxyErr) {
    console.warn('[Deepgram STT REST] Server proxy notice (trying direct fallback):', proxyErr);
  }

  // 2. Direct client fallback (if direct key is provided in dev)
  const apiKey = getDeepgramApiKey();
  if (!apiKey) return null;

  try {
    const model = options?.model || 'nova-3';
    const smartFormat = options?.smartFormat !== false;
    const punctuate = options?.punctuate !== false;
    const diarize = options?.diarize !== false;
    const sentiment = options?.sentiment !== false;
    const fillerWords = options?.fillerWords !== false;

    const queryParams = new URLSearchParams({
      model,
      smart_format: String(smartFormat),
      punctuate: String(punctuate),
      paragraphs: 'true',
      numerals: 'true',
      diarize: String(diarize),
      sentiment: String(sentiment),
      filler_words: String(fillerWords),
      detect_language: 'true',
    });

    const url = `https://api.deepgram.com/v1/listen?${queryParams.toString()}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': audioBlob.type || 'audio/webm',
      },
      body: audioBlob,
    });

    if (!response.ok) {
      console.warn(`[Deepgram STT REST] HTTP ${response.status}:`, await response.text().catch(() => ''));
      return null;
    }

    const data = await response.json();
    return parseDeepgramData(data);
  } catch (err) {
    console.warn('[Deepgram STT REST] Transcribe notice:', err);
    return null;
  }
};

function parseDeepgramData(data: any): DeepgramTranscriptionResult | null {
  const alternative = data?.results?.channels?.[0]?.alternatives?.[0];
  if (!alternative) return null;

  const words = alternative.words || [];
  const fillerWordsCount = words.filter((w: any) => 
    w.filler_word === true || /^(um|uh|erm|ah|like|you know)$/i.test(w.word || '')
  ).length;

  let sentimentLabel: 'positive' | 'neutral' | 'negative' = 'neutral';
  const sentiments = data.results?.sentiments?.segments || [];
  if (sentiments.length > 0) {
    const avgScore = sentiments.reduce((acc: number, s: any) => acc + (s.sentiment_score || 0), 0) / sentiments.length;
    if (avgScore > 0.15) sentimentLabel = 'positive';
    else if (avgScore < -0.15) sentimentLabel = 'negative';
    else sentimentLabel = 'neutral';
  }

  const diarizedSegments: Array<{ speaker: number; start: number; end: number; text: string }> = [];
  const paragraphs = data.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];
  for (const p of paragraphs) {
    diarizedSegments.push({
      speaker: p.speaker ?? 0,
      start: p.start ?? 0,
      end: p.end ?? 0,
      text: p.sentences?.map((s: any) => s.text).join(' ') || '',
    });
  }

  return {
    transcript: alternative.transcript || '',
    confidence: alternative.confidence ?? 0.95,
    words,
    fillerWordsCount,
    sentiment: sentimentLabel,
    detectedLanguage: data.results?.channels?.[0]?.detected_language || 'en',
    paragraphs: alternative.paragraphs?.transcript || alternative.transcript || '',
    diarizedSegments: diarizedSegments.length > 0 ? diarizedSegments : undefined,
  };
}


export interface DeepgramRealtimeOptions {
  keywords?: string[];
  language?: string;
  endpointing?: number;
  utteranceEndMs?: number;
  fillerWords?: boolean;
  numerals?: boolean;
  smartFormat?: boolean;
}

/**
 * Deepgram Realtime Session (Live Nova-3 WebSocket Streaming)
 * Uses high-velocity subprotocol auth, VAD events, filler word tracking, and continuous sentence accumulation
 */
export class DeepgramRealtimeSession {
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private muteGainNode: GainNode | null = null;
  private isStreaming = false;
  private isPaused = false;
  private callbacks: DeepgramStreamCallbacks;
  private options: DeepgramRealtimeOptions;
  private keepAliveInterval: any = null;
  private finalizedTranscript = '';
  private currentInterim = '';

  constructor(callbacks: DeepgramStreamCallbacks, options?: DeepgramRealtimeOptions) {
    this.callbacks = callbacks;
    this.options = options || {};
  }

  public async start(existingStream?: MediaStream): Promise<void> {
    if (this.isStreaming && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.isPaused = false;
      this.callbacks.onStateChange?.('listening');
      return;
    }

    const apiKey = getDeepgramApiKey();

    this.callbacks.onStateChange?.('connecting');

    // 1. Initialize AudioContext first to detect exact native hardware sample rate (e.g. 48000Hz on Mac, 44100Hz on PC)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContextClass();
    }
    const sampleRate = this.audioContext.sampleRate || 16000;

    // 2. Use existing stream if provided, or request microphone access with professional speech enhancements
    if (existingStream) {
      this.mediaStream = existingStream;
    } else {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    }

    // 3. Build full Deepgram Live WebSocket URL with Nova-3 Linear16 PCM, Smart Formatting, VAD, Filler Words & Keyterms
    const baseKeywords = [
      'relocation',
      'notice period',
      'salary',
      'CTC',
      'experience',
      'skills',
      'immediate',
      'joining',
      'resume',
      'background',
      'leadership',
      'project',
      'architecture',
      'responsibilities',
      'fullstack',
      'frontend',
      'backend',
      'developer',
      'engineer',
      'production',
      'database',
      'cloud',
      'repeat question',
      'skip question'
    ];

    // Combine default interview terms with any custom role/skills terms passed in options
    // NOTE: Deepgram Nova-3 uses `keyterm` parameter without weights for ultra-accurate speech recognition
    const customKeywords = (this.options.keywords || []).map(k => k.replace(/:\d+(\.\d+)?$/, '').trim()).filter(Boolean);
    const allKeywords = Array.from(new Set([...baseKeywords, ...customKeywords]));
    const keytermParam = allKeywords.map(k => `&keyterm=${encodeURIComponent(k)}`).join('');

    const endpointing = this.options.endpointing ?? 150;
    const fillerWords = this.options.fillerWords !== false;
    const numerals = this.options.numerals !== false;
    const smartFormat = this.options.smartFormat !== false;
    const lang = this.options.language || 'en';

    // Use Linear16 PCM matching exact native hardware sample rate for zero-distortion, sub-100ms ultra-accurate transcription
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=${sampleRate}&channels=1&language=${lang}&smart_format=${smartFormat}&punctuate=true&interim_results=true&endpointing=${endpointing}&vad_events=true&filler_words=${fillerWords}&numerals=${numerals}&profanity_filter=false${keytermParam}`;

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const timeoutTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          console.warn('[Deepgram WebSocket] Connection timed out after 6s');
          reject(new Error('Deepgram WebSocket connection timed out'));
        }
      }, 6000);

      try {
        if (apiKey) {
          this.ws = new WebSocket(wsUrl, ['token', apiKey]);
        } else {
          const proto = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
          const host = typeof window !== 'undefined' && window.location.host ? window.location.host : 'localhost:3000';
          const proxyWsUrl = `${proto}//${host}/deepgram-ws?model=nova-3&encoding=linear16&sample_rate=${sampleRate}&channels=1&language=${lang}&smart_format=${smartFormat}&punctuate=true&interim_results=true&endpointing=${endpointing}&vad_events=true&filler_words=${fillerWords}&numerals=${numerals}&profanity_filter=false${keytermParam}`;
          this.ws = new WebSocket(proxyWsUrl);
        }
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timeoutTimer);

          this.isStreaming = true;
          this.isPaused = false;
          this.callbacks.onStateChange?.('listening');

          // KeepAlive heartbeat every 8s to prevent timeout during long candidate pauses
          this.keepAliveInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
            }
          }, 8000);

          // Start Web Audio API Linear16 PCM streaming
          this.startAudioCapture();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (err) => {
          console.warn('[Deepgram WebSocket] Notice:', err);
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutTimer);
            reject(err);
          }
          this.callbacks.onError?.(err);
          this.callbacks.onStateChange?.('error');
        };

        this.ws.onclose = (event) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutTimer);
            reject(new Error(`Deepgram WebSocket closed before connect: code ${event.code}`));
          }
          this.isStreaming = false;
          if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
          this.callbacks.onStateChange?.('closed');
        };
      } catch (err) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeoutTimer);
          reject(err);
        }
      }
    });
  }

  /**
   * Capture microphone audio and stream as raw 16-bit Linear PCM (16kHz)
   * Pure samples: zero container corruption, instant response, zero latency
   */
  private startAudioCapture(): void {
    if (!this.mediaStream) return;

    try {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          const res = this.audioContext.resume();
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
        } catch (_) {}
      }

      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }

      this.micSourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      // 2048 buffer size gives ~42ms slices at 48kHz for sub-100ms real-time responsiveness
      this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);

      this.processorNode.onaudioprocess = (e) => {
        if (this.isPaused || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const input = e.inputBuffer.getChannelData(0);
        // Convert Float32Array [-1.0, 1.0] to 16-bit signed Linear PCM
        const pcmBuffer = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        try {
          this.ws.send(pcmBuffer.buffer);
        } catch (_) {}
      };

      // Mute gain node prevents candidate from hearing their own microphone through speakers
      this.muteGainNode = this.audioContext.createGain();
      this.muteGainNode.gain.value = 0;

      this.micSourceNode.connect(this.processorNode);
      this.processorNode.connect(this.muteGainNode);
      this.muteGainNode.connect(this.audioContext.destination);
    } catch (err) {
      console.warn('[Deepgram Audio Capture] Web Audio PCM capture notice:', err);
      this.callbacks.onError?.(err);
    }
  }

  private async handleMessage(data: any): Promise<void> {
    try {
      let rawText = '';
      if (typeof data === 'string') {
        rawText = data;
      } else if (data instanceof ArrayBuffer) {
        rawText = new TextDecoder().decode(data);
      } else if (data && typeof (data as any).text === 'function') {
        rawText = await (data as any).text();
      } else if (data && typeof (data as any).arrayBuffer === 'function') {
        const ab = await (data as any).arrayBuffer();
        rawText = new TextDecoder().decode(ab);
      }
      if (!rawText) return;

      const parsed = JSON.parse(rawText);

      // Deepgram Voice Activity Detection (VAD): Candidate started speaking
      if (parsed.type === 'SpeechStarted') {
        if (!this.isPaused) {
          // Trigger instant AI barge-in / interruption
          stopDeepgramAudio();
          this.callbacks.onSpeechStarted?.();
        }
        return;
      }

      // Deepgram UtteranceEnd event: Candidate paused after an utterance
      if (parsed.type === 'UtteranceEnd') {
        if (!this.isPaused) {
          this.callbacks.onUtteranceEnd?.();
        }
        return;
      }

      // Transcripts from Nova-3 model
      if (parsed.type === 'Results' && parsed.channel?.alternatives?.[0]) {
        if (this.isPaused) return;

        const alt = parsed.channel.alternatives[0];
        const transcriptSlice = (alt.transcript || '').trim();
        const isFinal = Boolean(parsed.is_final);
        const speechFinal = Boolean(parsed.speech_final);
        const words = alt.words || [];
        const fillerWords = words
          .filter((w: any) => w.filler_word === true || /^(um|uh|erm|ah|like|you know)$/i.test(w.word || ''))
          .map((w: any) => w.word);

        if (transcriptSlice) {
          if (isFinal) {
            // Append finalized clause to permanent answer buffer
            this.finalizedTranscript = this.finalizedTranscript
              ? `${this.finalizedTranscript} ${transcriptSlice}`
              : transcriptSlice;
            this.currentInterim = '';
          } else {
            this.currentInterim = transcriptSlice;
          }

          // Full combined text of all completed sentences + current live words
          const combined = (this.finalizedTranscript + (this.currentInterim ? ` ${this.currentInterim}` : '')).trim();

          if (combined) {
            this.callbacks.onTranscript(combined, isFinal, speechFinal, {
              confidence: alt.confidence,
              words,
              fillerWords,
            });
          }
        }
      }
    } catch (_) {
      // Ignore unparseable frames
    }
  }

  public getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  public pause(): void {
    this.isPaused = true;
    this.callbacks.onStateChange?.('paused');
  }

  public clearTranscript(): void {
    this.finalizedTranscript = '';
    this.currentInterim = '';
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'Finalize' }));
      } catch (_) {}
    }
  }

  public setTranscript(text: string): void {
    this.finalizedTranscript = (text || '').trim();
    this.currentInterim = '';
  }

  public getTranscript(): string {
    return (this.finalizedTranscript + (this.currentInterim ? ` ${this.currentInterim}` : '')).trim();
  }

  public resume(): void {
    this.isPaused = false;
    this.finalizedTranscript = '';
    this.currentInterim = '';
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        const res = this.audioContext.resume();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (_) {}
    }
    this.callbacks.onStateChange?.('listening');
  }

  public async stop(): Promise<void> {
    this.isStreaming = false;
    this.isPaused = false;
    this.finalizedTranscript = '';
    this.currentInterim = '';

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
        this.processorNode.onaudioprocess = null;
      } catch (_) {}
      this.processorNode = null;
    }

    if (this.micSourceNode) {
      try { this.micSourceNode.disconnect(); } catch (_) {}
      this.micSourceNode = null;
    }

    if (this.muteGainNode) {
      try { this.muteGainNode.disconnect(); } catch (_) {}
      this.muteGainNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch (_) {}
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          // Tell Deepgram we are closing stream
          this.ws.send(JSON.stringify({ type: 'CloseStream' }));
        }
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    this.callbacks.onStateChange?.('closed');
  }
}
