import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, Track, VideoPresets } from 'livekit-client';

export interface UseLiveKitInterviewProps {
  jobId?: string;
  jobTitle?: string;
  candidateName?: string;
  candidateEmail?: string;
  questions?: string[];
  enabled?: boolean;
  onComplete?: (data: { summary?: string }) => void;
  onQuestionChange?: (index: number, text: string, isCrossQuestion?: boolean) => void;
  onCompliment?: (text: string) => void;
}

export interface LiveKitInterviewState {
  isConnected: boolean;
  isConnecting: boolean;
  agentConnected: boolean;
  isAgentSpeaking: boolean;
  isCandidateSpeaking: boolean;
  isCrossQuestioning: boolean;
  currentQuestionText: string;
  currentQuestionIndex: number;
  lastCompliment: string | null;
  isCompleted: boolean;
  transcript: Array<{ speaker: 'ai' | 'candidate'; text: string; timestamp: number; isCrossQuestion?: boolean }>;
  error: string | null;
  roomName: string | null;
}

export function useLiveKitInterview({
  jobId,
  jobTitle,
  candidateName,
  candidateEmail,
  questions = [],
  enabled = false,
  onComplete,
  onQuestionChange,
  onCompliment,
}: UseLiveKitInterviewProps) {
  const [state, setState] = useState<LiveKitInterviewState>({
    isConnected: false,
    isConnecting: false,
    agentConnected: false,
    isAgentSpeaking: false,
    isCandidateSpeaking: false,
    isCrossQuestioning: false,
    currentQuestionText: '',
    currentQuestionIndex: 0,
    lastCompliment: null,
    isCompleted: false,
    transcript: [],
    error: null,
    roomName: null,
  });

  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const onCompleteRef = useRef(onComplete);
  const onQuestionChangeRef = useRef(onQuestionChange);
  const onComplimentRef = useRef(onCompliment);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onQuestionChangeRef.current = onQuestionChange;
  }, [onQuestionChange]);

  useEffect(() => {
    onComplimentRef.current = onCompliment;
  }, [onCompliment]);

  const connect = useCallback(async () => {
    if (roomRef.current) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // 1. Fetch Room Token from our serverless endpoint
      const res = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: jobId || 'job-general',
          jobTitle: jobTitle || 'Candidate Interview',
          participantName: candidateName || 'Candidate',
          email: candidateEmail || '',
          questions: questions || [],
        }),
      });

      const data = await res.json();
      if (!data.success || !data.token) {
        throw new Error(data.error || 'Failed to acquire LiveKit room access token');
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      roomRef.current = room;

      // 2. Set up Room Event Listeners
      room.on(RoomEvent.Connected, () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          roomName: data.roomName,
        }));
      });

      room.on(RoomEvent.Disconnected, () => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          agentConnected: false,
        }));
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        const pName = participant.name?.toLowerCase() || '';
        const pIdentity = participant.identity.toLowerCase();
        if (pIdentity.includes('agent') || pName.includes('agent') || pName.includes('alex') || pIdentity.includes('alex')) {
          setState(prev => ({ ...prev, agentConnected: true }));
        }
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.autoplay = true;
          document.body.appendChild(audioElement);
          audioElementsRef.current.push(audioElement);
        }
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const isCandidateActive = speakers.some(s => s.identity === room.localParticipant.identity);
        const isAgentActive = speakers.some(s => s.identity !== room.localParticipant.identity);

        setState(prev => ({
          ...prev,
          isCandidateSpeaking: isCandidateActive,
          isAgentSpeaking: isAgentActive,
        }));
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const str = new TextDecoder().decode(payload);
          const event = JSON.parse(str);

          if (event.type === 'core_question') {
            const nextIdx = typeof event.index === 'number' ? event.index : 0;
            const nextText = event.text || '';
            setState(prev => ({
              ...prev,
              isCrossQuestioning: false,
              currentQuestionIndex: nextIdx,
              currentQuestionText: nextText || prev.currentQuestionText,
              transcript: [
                ...prev.transcript,
                { speaker: 'ai', text: nextText, timestamp: Date.now(), isCrossQuestion: false }
              ]
            }));
            if (onQuestionChangeRef.current) {
              onQuestionChangeRef.current(nextIdx, nextText, false);
            }
          } else if (event.type === 'cross_question') {
            const crossText = event.text || '';
            setState(prev => ({
              ...prev,
              isCrossQuestioning: true,
              currentQuestionText: crossText,
              transcript: [
                ...prev.transcript,
                { speaker: 'ai', text: crossText, timestamp: Date.now(), isCrossQuestion: true }
              ]
            }));
            if (onQuestionChangeRef.current) {
              onQuestionChangeRef.current(state.currentQuestionIndex, crossText, true);
            }
          } else if (event.type === 'compliment') {
            setState(prev => ({ ...prev, lastCompliment: event.text || '' }));
            if (onComplimentRef.current) {
              onComplimentRef.current(event.text || '');
            }
          } else if (event.type === 'repeat_question') {
            // Keep question state active and indicate repeated
            if (event.text) {
              setState(prev => ({ ...prev, currentQuestionText: event.text }));
            }
          } else if (event.type === 'interview_completed') {
            setState(prev => ({ ...prev, isCompleted: true }));
            if (onCompleteRef.current) {
              onCompleteRef.current({ summary: event.summary });
            }
          }
        } catch {
          // ignore non-json data
        }
      });

      // 3. Connect to LiveKit Cloud Room
      await room.connect(data.url, data.token);

      // 4. Publish Local Microphone & Camera tracks
      await room.localParticipant.enableCameraAndMicrophone();

      // Check if any agent is already in room
      const hasAgent = Array.from(room.remoteParticipants.values()).some(
        p => p.identity.includes('agent') || p.name?.toLowerCase().includes('agent') || p.name?.toLowerCase().includes('alex')
      );
      if (hasAgent) {
        setState(prev => ({ ...prev, agentConnected: true }));
      }
    } catch (err: any) {
      console.error('[LiveKit Connect Error]:', err);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        error: err.message || 'LiveKit connection failed',
      }));
    }
  }, [jobId, jobTitle, candidateName, candidateEmail, questions, state.currentQuestionIndex]);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    // Clean up audio elements attached to the body
    audioElementsRef.current.forEach(el => {
      try {
        el.pause();
        el.remove();
      } catch {}
    });
    audioElementsRef.current = [];

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      agentConnected: false,
      isAgentSpeaking: false,
      isCandidateSpeaking: false,
      isCrossQuestioning: false,
    }));
  }, []);

  useEffect(() => {
    if (enabled && !state.isConnected && !state.isConnecting) {
      connect();
    }
    return () => {
      if (roomRef.current) {
        disconnect();
      }
    };
  }, [enabled, connect, disconnect, state.isConnected, state.isConnecting]);

  return {
    ...state,
    connect,
    disconnect,
    room: roomRef.current,
  };
}
