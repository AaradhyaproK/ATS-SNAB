/**
 * services/videoSessionRecorder.ts
 * Dual-Channel Video & Audio Full-Session Recorder for AI Video Interviews
 * 
 * Mixes candidate webcam video + microphone audio + AI Deepgram interviewer voice
 * into a single continuous high-definition video stream from start to finish.
 * Automatically tracks chapter bookmarks for every question & clarification cross-question,
 * patches WebM duration metadata for scrubbing, and exports for AWS S3 upload.
 */

import fixWebmDuration from 'fix-webm-duration';

export interface VideoBookmark {
  type: 'question' | 'cross_question' | 'wrapup';
  questionIndex: number;
  title: string;
  timestampSec: number;
  formattedTime: string;
}

export interface VideoSessionResult {
  blob: Blob;
  durationSeconds: number;
  bookmarks: VideoBookmark[];
}

export class VideoSessionRecorder {
  private audioContext: AudioContext | null = null;
  private mixedAudioDestination: MediaStreamAudioDestinationNode | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private activeAiAudioElement: HTMLAudioElement | null = null;
  private activeAiSourceNode: AudioBufferSourceNode | null = null;
  private mimeType: string = 'video/webm';
  private startTime: number = 0;
  private isRecording: boolean = false;
  private bookmarks: VideoBookmark[] = [];
  private playSequenceId: number = 0;

  /**
   * Initialize recorder with candidate camera video track and microphone track
   */
  public async init(
    cameraStream: MediaStream,
    micStream: MediaStream,
    existingContext?: AudioContext
  ): Promise<void> {
    if (existingContext && existingContext.state !== 'closed') {
      this.audioContext = existingContext;
    } else {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === 'suspended') {
      try {
        const res = this.audioContext.resume();
        if (res && typeof res.catch === 'function') {
          await res.catch(() => {});
        }
      } catch (_) {}
    }

    // 1. Create mixed audio destination node for the video recorder
    this.mixedAudioDestination = this.audioContext.createMediaStreamDestination();

    // 2. Pipe candidate microphone into recording destination ONLY (not speakers, to prevent feedback loop)
    const audioTrack = micStream.getAudioTracks()[0] || cameraStream.getAudioTracks()[0];
    if (audioTrack) {
      const singleMicStream = new MediaStream([audioTrack]);
      this.micSourceNode = this.audioContext.createMediaStreamSource(singleMicStream);
      this.micSourceNode.connect(this.mixedAudioDestination);
    }

    // 3. Assemble combined stream: Candidate Video Track + Mixed Audio Track
    const videoTrack = cameraStream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track found on camera stream');
    }

    const mixedAudioTrack = this.mixedAudioDestination.stream.getAudioTracks()[0];
    const combinedStream = new MediaStream(
      mixedAudioTrack ? [videoTrack, mixedAudioTrack] : [videoTrack]
    );

    // 4. Select best supported Video MIME type
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        this.mimeType = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        this.mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        this.mimeType = 'video/webm';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        this.mimeType = 'video/mp4';
      }
    }

    // High fidelity bitrate for clear candidate face & legible screen/audio
    const options: MediaRecorderOptions = {
      mimeType: this.mimeType,
      videoBitsPerSecond: 650_000,
      audioBitsPerSecond: 96_000,
    };

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch (_) {
      this.mediaRecorder = new MediaRecorder(combinedStream);
    }

    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };
  }

  /**
   * Start continuous full-session video recording
   */
  public start(): void {
    if (!this.mediaRecorder || this.isRecording) return;
    this.chunks = [];
    this.bookmarks = [];
    this.startTime = Date.now();
    this.isRecording = true;

    try {
      // 1000ms chunk slices ensure continuous buffers
      this.mediaRecorder.start(1000);
      console.log('[VideoSessionRecorder] Continuous recording started. MIME:', this.mimeType);
    } catch (err) {
      console.error('[VideoSessionRecorder] Failed to start MediaRecorder:', err);
      this.isRecording = false;
    }
  }

  /**
   * Add a question bookmark to the video timeline
   */
  public bookmarkQuestion(
    questionIndex: number,
    questionText: string,
    isCrossQuestion: boolean = false
  ): VideoBookmark {
    const elapsedSec = this.startTime > 0 ? Math.max(0, Math.floor((Date.now() - this.startTime) / 1000)) : 0;
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const formattedTime = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    const bookmark: VideoBookmark = {
      type: isCrossQuestion ? 'cross_question' : 'question',
      questionIndex,
      title: questionText,
      timestampSec: elapsedSec,
      formattedTime,
    };

    this.bookmarks.push(bookmark);
    return bookmark;
  }

  /**
   * Play AI interviewer speech through candidate speakers AND mix into video recording
   */
  public async playAiAudioBlob(blob: Blob, isMuted: boolean = false): Promise<boolean> {
    this.stopAiAudio();
    if (!blob || blob.size === 0) return false;
    const playId = ++this.playSequenceId;

    return new Promise(async (resolve) => {
      let isResolved = false;
      const safeResolve = (val: boolean) => {
        if (!isResolved) {
          isResolved = true;
          resolve(val);
        }
      };

      try {
        if (this.audioContext && this.audioContext.state === 'suspended') {
          try {
            const res = this.audioContext.resume();
            if (res && typeof res.catch === 'function') {
              await res.catch(() => {});
            }
          } catch (_) {}
        }

        if (this.playSequenceId !== playId) {
          safeResolve(false);
          return;
        }

        const audioUrl = URL.createObjectURL(blob);
        const audioElement = new Audio(audioUrl);
        audioElement.volume = isMuted ? 0 : 1.0;
        this.activeAiAudioElement = audioElement;

        // Route AI voice into the video recorder's mixed destination
        if (this.audioContext && this.mixedAudioDestination) {
          try {
            const arrayBuffer = await blob.arrayBuffer();
            if (this.playSequenceId !== playId) {
              URL.revokeObjectURL(audioUrl);
              safeResolve(false);
              return;
            }
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            if (this.playSequenceId !== playId) {
              URL.revokeObjectURL(audioUrl);
              safeResolve(false);
              return;
            }
            const sourceNode = this.audioContext.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(this.mixedAudioDestination);
            this.activeAiSourceNode = sourceNode;
            sourceNode.start(0);
          } catch (mixErr) {
            console.warn('[VideoSessionRecorder] WebAudio buffer mix notice:', mixErr);
          }
        }

        if (this.playSequenceId !== playId) {
          URL.revokeObjectURL(audioUrl);
          safeResolve(false);
          return;
        }

        audioElement.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (this.activeAiAudioElement === audioElement) {
            this.activeAiAudioElement = null;
          }
          safeResolve(true);
        };

        audioElement.onerror = (err) => {
          console.warn('[VideoSessionRecorder] HTML5 audio error:', err);
          URL.revokeObjectURL(audioUrl);
          if (this.activeAiAudioElement === audioElement) {
            this.activeAiAudioElement = null;
          }
          safeResolve(false);
        };

        await audioElement.play();
      } catch (playErr) {
        console.warn('[VideoSessionRecorder] Playback notice:', playErr);
        safeResolve(false);
      }
    });
  }

  /**
   * Immediately halt any currently playing AI voice (Instant Barge-in)
   */
  public stopAiAudio(): void {
    this.playSequenceId++;
    if (this.activeAiAudioElement) {
      try {
        this.activeAiAudioElement.pause();
        this.activeAiAudioElement.currentTime = 0;
        this.activeAiAudioElement.src = '';
      } catch (_) {}
      this.activeAiAudioElement = null;
    }

    if (this.activeAiSourceNode) {
      try {
        this.activeAiSourceNode.stop();
        this.activeAiSourceNode.disconnect();
      } catch (_) {}
      this.activeAiSourceNode = null;
    }
  }

  /**
   * Stop recording and export the full continuous video with patched duration
   */
  public async stop(): Promise<VideoSessionResult | null> {
    if (!this.mediaRecorder || !this.isRecording) return null;
    this.stopAiAudio();
    this.isRecording = false;

    const totalDurationMs = this.startTime > 0 ? Math.max(1000, Date.now() - this.startTime) : 1000;
    const durationSeconds = Math.round(totalDurationMs / 1000);

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const rawBlob = new Blob(this.chunks, { type: this.mimeType || 'video/webm' });
          this.chunks = [];

          let finalBlob = rawBlob;
          // Patch EBML duration header so video scrubbing works seamlessly
          if ((this.mimeType || 'video/webm').includes('webm') && totalDurationMs > 0) {
            try {
              finalBlob = await fixWebmDuration(rawBlob, totalDurationMs);
            } catch (patchErr) {
              console.warn('[VideoSessionRecorder] Could not patch WebM duration header:', patchErr);
            }
          }

          console.log('[VideoSessionRecorder] Exported full video. Size:', finalBlob.size, 'Duration:', durationSeconds, 's');
          resolve({
            blob: finalBlob,
            durationSeconds,
            bookmarks: this.bookmarks,
          });
        } catch (err) {
          console.error('[VideoSessionRecorder] Export failed:', err);
          resolve(null);
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.warn('[VideoSessionRecorder] MediaRecorder stop error:', err);
        resolve(null);
      }
    });
  }

  /**
   * Clean up WebAudio nodes and streams
   */
  public destroy(): void {
    this.stopAiAudio();
    if (this.micSourceNode) {
      try { this.micSourceNode.disconnect(); } catch (_) {}
      this.micSourceNode = null;
    }
    if (this.mixedAudioDestination) {
      try { this.mixedAudioDestination.disconnect(); } catch (_) {}
      this.mixedAudioDestination = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (_) {}
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
