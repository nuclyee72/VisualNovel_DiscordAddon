'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { SOCKET_EVENTS } from '../../../../packages/shared/src/index';
import type { Socket } from 'socket.io-client';

interface STTControllerProps {
  socket: Socket | null;
  sessionId: string;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  onInterimTranscript: (text: string) => void;
}

// Web Speech API 타입 (브라우저 내장)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// VAD (Voice Activity Detection) — Web Audio API
const VAD_THRESHOLD = 15;     // RMS 임계값 (0~255)
const VAD_HOLD_MS = 800;      // 발언 종료 판정까지 대기 시간

export default function STTController({
  socket,
  sessionId,
  isEnabled,
  onToggle,
  onInterimTranscript,
}: STTControllerProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpeakingRef = useRef(false);
  const vadFrameRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // VAD 루프 — Web Audio API
  const startVAD = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      function detectVoice() {
        analyser.getByteFrequencyData(data);
        // RMS 계산
        const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);

        if (rms > VAD_THRESHOLD) {
          // 발언 시작
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            socket?.emit(SOCKET_EVENTS.VOICE_SPEAKING, { sessionId, isSpeaking: true });
          }
          // 타이머 리셋 (계속 발언 중이면 종료 판정 연기)
          if (vadTimerRef.current) clearTimeout(vadTimerRef.current);
          vadTimerRef.current = setTimeout(() => {
            isSpeakingRef.current = false;
            socket?.emit(SOCKET_EVENTS.VOICE_SPEAKING, { sessionId, isSpeaking: false });
          }, VAD_HOLD_MS);
        }

        vadFrameRef.current = requestAnimationFrame(detectVoice);
      }

      detectVoice();
    } catch (e) {
      setError('마이크 접근 권한이 필요합니다.');
      onToggle(false);
    }
  }, [socket, sessionId, onToggle]);

  const stopVAD = useCallback(() => {
    if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
    if (vadTimerRef.current) clearTimeout(vadTimerRef.current);
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    isSpeakingRef.current = false;
    socket?.emit(SOCKET_EVENTS.VOICE_SPEAKING, { sessionId, isSpeaking: false });
  }, [socket, sessionId]);

  // STT (Web Speech API)
  const startSTT = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해주세요.');
      return;
    }

    const recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = e.results.length - 1; i >= 0; i--) {
        const result = e.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;

        if (result.isFinal) {
          // 최종 결과 → 서버로 전송
          socket?.emit(SOCKET_EVENTS.STT_TRANSCRIPT, {
            sessionId,
            text,
            isFinal: true,
          });
          onInterimTranscript('');
        } else {
          // 중간 결과 → 로컬 자막 표시
          onInterimTranscript(text);
        }
        break;
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech') {
        setError(`음성 인식 오류: ${e.error}`);
      }
    };

    recognition.onend = () => {
      // 자동 재시작 (isEnabled가 유지되는 한)
      if (isEnabled && recognitionRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    try { recognition.start(); } catch {}
  }, [socket, sessionId, isEnabled, onInterimTranscript]);

  const stopSTT = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    onInterimTranscript('');
  }, [onInterimTranscript]);

  // isEnabled 변경에 따라 시작/중지
  useEffect(() => {
    if (isEnabled) {
      startVAD();
      startSTT();
    } else {
      stopVAD();
      stopSTT();
    }

    return () => {
      stopVAD();
      stopSTT();
    };
  }, [isEnabled]);

  return (
    <>
      {error && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(var(--dialogue-height) + 50px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(224, 85, 85, 0.9)',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: 'white',
          zIndex: 'var(--z-toast)' as never,
        }}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '8px', color: 'white', background: 'none', cursor: 'pointer', border: 'none' }}>✕</button>
        </div>
      )}
    </>
  );
}
