/**
 * services/voiceCallRecorder.ts
 * Dual-Channel Web Audio Call Recorder for Voice Interviews
 * 
 * Mixes candidate microphone audio + AI question speech into a single, continuous
 * audio stream and records it using MediaRecorder from start to finish.
 * At call completion, exports the recorded Blob for upload to AWS S3.
 */

export class VoiceCallRecorder {
  private audioContext: AudioContext | null = null;
  private mixedDestination: MediaStreamAudioDestinationNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private activeAiSourceNode: AudioBufferSourceNode | null = null;
  private activeFallbackAudio: HTMLAudioElement | null = null;
  private mimeType: string = 'audio/webm';
  private isRecording = false;

  /**
   * Initialize AudioContext and mix candidate microphone stream
   */
  public async init(micStream: MediaStream, existingContext?: AudioContext): Promise<void> {
    if (existingContext && existingContext.state !== 'closed') {
      this.audioContext = existingContext;
    } else {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    // Create destination node where both mic + AI speech will be mixed
    this.mixedDestination = this.audioContext.createMediaStreamDestination();

    // Pipe candidate microphone into the recording destination ONLY (not to speakers to avoid echo)
    this.micSource = this.audioContext.createMediaStreamSource(micStream);
    this.micSource.connect(this.mixedDestination);

    // Pick best supported MIME type
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        this.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        this.mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        this.mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        this.mimeType = 'audio/ogg';
      }
    }
  }

  /**
   * Start recording the mixed call stream
   */
  public start(): void {
    if (!this.mixedDestination || this.isRecording) return;
    this.chunks = [];

    try {
      this.mediaRecorder = new MediaRecorder(this.mixedDestination.stream, {
        mimeType: this.mimeType
      });

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // 1-second chunks
      this.isRecording = true;
      console.info(`[Call Recorder] Started recording entire call (Format: ${this.mimeType})`);
    } catch (err) {
      console.warn('[Call Recorder] Failed to start MediaRecorder:', err);
    }
  }

  /**
   * Play AI speech through speakers AND inject it into the call recording stream.
   * Returns true if audio played successfully, false if caller should fall back to speech synthesis.
   */
  public async playAiAudioBlob(audioBlob: Blob, isMuted = false): Promise<boolean> {
    this.stopAiSpeech();

    // 1. Digital Mixing: Pipe AI audio directly into the mixed recording stream in background
    if (this.audioContext && this.mixedDestination) {
      try {
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
        audioBlob.arrayBuffer().then(async (ab) => {
          if (!this.audioContext || !this.mixedDestination) return;
          try {
            const audioBuffer = await this.audioContext.decodeAudioData(ab.slice(0));
            if (audioBuffer && this.audioContext && this.mixedDestination) {
              const recNode = this.audioContext.createBufferSource();
              recNode.buffer = audioBuffer;
              recNode.connect(this.mixedDestination);
              recNode.start(0);
            }
          } catch (_) {}
        }).catch(() => {});
      } catch (_) {}
    }

    // 2. Direct, Loud & Clear Physical Speaker Playback via HTML5 Audio
    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.volume = 1.0;
      this.activeFallbackAudio = audio;

      if (isMuted) {
        audio.muted = true;
      }

      return await new Promise<boolean>((resolve) => {
        let finished = false;
        const cleanup = () => {
          if (!finished) {
            finished = true;
            URL.revokeObjectURL(audioUrl);
            if (this.activeFallbackAudio === audio) {
              this.activeFallbackAudio = null;
            }
          }
        };

        // Safety timeout based on blob size or max 25s
        const estDurationMs = Math.max(3000, Math.min(25000, (audioBlob.size / 3200) * 1000 + 3000));
        const safetyTimer = setTimeout(() => {
          if (!finished) {
            cleanup();
            resolve(true);
          }
        }, estDurationMs);

        audio.onended = () => {
          clearTimeout(safetyTimer);
          cleanup();
          resolve(true);
        };

        audio.onerror = (err) => {
          console.warn('[Call Recorder] HTML5 audio error:', err);
          clearTimeout(safetyTimer);
          cleanup();
          resolve(false);
        };

        audio.play().then(() => {
          // Playing successfully through speakers
        }).catch((err) => {
          console.warn('[Call Recorder] HTML5 play rejected:', err);
          clearTimeout(safetyTimer);
          cleanup();
          resolve(false);
        });
      });
    } catch (err) {
      console.warn('[Call Recorder] Audio playback error:', err);
      return false;
    }
  }

  /**
   * Stop any currently playing AI audio node or fallback element (Immediate Barge-in)
   */
  public stopAiSpeech(): void {
    if (this.activeAiSourceNode) {
      try {
        this.activeAiSourceNode.stop();
        this.activeAiSourceNode.disconnect();
      } catch (_) {}
      this.activeAiSourceNode = null;
    }
    if (this.activeFallbackAudio) {
      try {
        this.activeFallbackAudio.pause();
        this.activeFallbackAudio.currentTime = 0;
        this.activeFallbackAudio.src = '';
      } catch (_) {}
      this.activeFallbackAudio = null;
    }
  }

  /**
   * Stop recording and return final combined call audio Blob
   */
  public async stop(): Promise<Blob | null> {
    this.isRecording = false;
    this.stopAiSpeech();

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      if (this.chunks.length > 0) {
        return new Blob(this.chunks, { type: this.mimeType });
      }
      return null;
    }

    return new Promise<Blob | null>((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const fullBlob = new Blob(this.chunks, { type: this.mimeType });
        console.info(`[Call Recorder] Call recording complete. Size: ${(fullBlob.size / 1024).toFixed(1)} KB`);
        resolve(fullBlob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (_) {
        const fullBlob = new Blob(this.chunks, { type: this.mimeType });
        resolve(fullBlob);
      }
    });
  }

  /**
   * Release audio context & stream handles
   */
  public destroy(): void {
    this.stopAiSpeech();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (_) {}
    }
    if (this.micSource) {
      try { this.micSource.disconnect(); } catch (_) {}
      this.micSource = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
