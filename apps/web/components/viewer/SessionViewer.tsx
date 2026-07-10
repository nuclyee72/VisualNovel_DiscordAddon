'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import '../viewer.css';

import BackgroundLayer from '@/components/viewer/BackgroundLayer';
import CharacterLayer, { CharacterState } from '@/components/viewer/CharacterLayer';
import DialogueBox from '@/components/viewer/DialogueBox';
import BGMPlayer from '@/components/viewer/BGMPlayer';
import STTController from '@/components/viewer/STTController';

import {
  SOCKET_EVENTS,
  calcAutoDelay,
  type DialoguePayload,
  type DicePayload,
  type BGMPayload,
  type StatusUpdatePayload,
  type SystemMessagePayload,
  type SpeakerPayload,
  type ExpressionPayload,
  type ParticipantPayload,
} from '../../../../packages/shared/src/index';

// ── 상태 타입들 ──────────────────────────────────────────────
interface Toast {
  id: number;
  text: string;
  level: 'info' | 'warning' | 'error';
}

// (PlayerStats 인터페이스는 TRPG 기능 보류로 인해 삭제)

interface DictionaryEntry {
  word: string;
  description: string;
}

export default function SessionViewer({ sessionId }: { sessionId: string }) {
  // ── 연결 상태 ─────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // ── 씬 상태 ──────────────────────────────────────────────
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [bgmPayload, setBgmPayload] = useState<BGMPayload | null>(null);
  const [characters, setCharacters] = useState<CharacterState[]>([]);
  const [speakerDiscordId, setSpeakerDiscordId] = useState<string | null>(null);

  // ── 대사창 상태 ──────────────────────────────────────────
  const [currentSpeakerName, setCurrentSpeakerName] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const dialogueQueueRef = useRef<DialoguePayload[]>([]);
  const isProcessingRef = useRef(false);

  // ── 로그 창 상태 ─────────────────────────────────────────
  const [historyLog, setHistoryLog] = useState<DialoguePayload[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const logContentRef = useRef<HTMLDivElement>(null);

  // ── 오토모드 ─────────────────────────────────────────────
  const [autoMode, setAutoMode] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(1.0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 사전 ─────────────────────────────────────────────────
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);

  // ── UI 상태 ───────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sttEnabled, setSttEnabled] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [volume, setVolume] = useState(0.5);
  const toastIdRef = useRef(0);

  // ── 토스트 추가 헬퍼 ─────────────────────────────────────
  const addToast = useCallback((text: string, level: 'info' | 'warning' | 'error' = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text, level }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // ── 대사 큐 처리 ─────────────────────────────────────────
  const processNextDialogue = useCallback(() => {
    const next = dialogueQueueRef.current.shift();
    setQueueLength(dialogueQueueRef.current.length);
    if (!next) {
      isProcessingRef.current = false;
      return;
    }
    isProcessingRef.current = true;

    setHistoryLog((prev) => {
      const updated = [...prev, next];
      return updated.length > 20 ? updated.slice(updated.length - 20) : updated;
    });

    setCurrentSpeakerName(next.speakerName);
    setCurrentText(next.text);
    setIsTypingDone(false);
  }, []);

  // 타이핑 완료 → 오토모드 타이머 or 대기
  const handleTypingComplete = useCallback(() => {
    setIsTypingDone(true);
    if (autoMode) {
      const delay = calcAutoDelay(currentText, autoSpeed);
      autoTimerRef.current = setTimeout(() => {
        processNextDialogue();
      }, delay);
    }
  }, [autoMode, autoSpeed, currentText, processNextDialogue]);

  // 클릭 → 다음 대사
  const handleDialogueClick = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    processNextDialogue();
  }, [processNextDialogue]);

  // ── 키보드 및 휠 이벤트 ────────────────────────────────────
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // UI 요소 위에서의 스크롤 방지
      const target = e.target as HTMLElement;
      if (target.closest('.vn-controls') || target.closest('.vn-return-btn') || target.closest('.vn-log-overlay')) return;

      if (e.deltaY < 0 && !logOpen) {
        setLogOpen(true);
        setTimeout(() => {
          if (logContentRef.current) {
            logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
          }
        }, 10);
      } else if (e.deltaY > 0) {
        if (!logOpen) {
          handleDialogueClick();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'ArrowDown', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        if (logOpen) setLogOpen(false);
        else handleDialogueClick();
      }
      if (e.code === 'KeyA') setAutoMode((p) => !p);
      if (e.code === 'KeyF') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.getElementById('vn-viewer')?.requestFullscreen();
      }
      if (e.code === 'Escape') {
        if (logOpen) setLogOpen(false);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [logOpen, handleDialogueClick]);

  // ── Socket.IO 초기화 ──────────────────────────────────────
  useEffect(() => {
    const token = document.cookie
      .split(';')
      .find((c) => c.trim().startsWith('vn_token='))
      ?.split('=')[1];

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      auth: { token },
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit(SOCKET_EVENTS.CLIENT_JOIN_SESSION, { sessionId });
    });

    socket.on('disconnect', () => setIsConnected(false));

    // ── 이벤트 핸들러 ─────────────────────────────────────

    socket.on(SOCKET_EVENTS.VN_BACKGROUND, (payload: { url: string }) => {
      setBackgroundUrl(payload.url);
    });

    socket.on(SOCKET_EVENTS.VN_BGM, (payload: BGMPayload) => {
      setBgmPayload(payload);
    });

    socket.on(SOCKET_EVENTS.VN_SPEAKER, (payload: SpeakerPayload) => {
      setSpeakerDiscordId(payload.discordId);
      // 캐릭터 하이라이트 업데이트
      setCharacters((prev) =>
        prev.map((c) => ({ ...c, isSpeaking: c.discordId === payload.discordId }))
      );
    });

    socket.on(SOCKET_EVENTS.VN_DIALOGUE, (payload: DialoguePayload) => {
      dialogueQueueRef.current.push(payload);
      setQueueLength(dialogueQueueRef.current.length);
      if (!isProcessingRef.current) {
        processNextDialogue();
      }
    });

    socket.on(SOCKET_EVENTS.VN_EXPRESSION, (payload: ExpressionPayload) => {
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.discordId !== payload.discordId) return c;
          // 해당 태그의 이미지 URL 찾기는 캐릭터 데이터에서 처리
          return { ...c, currentTag: payload.tag };
        })
      );
    });

    // TRPG 주사위 및 상태 업데이트 이벤트 수신은 현재 마일스톤에서 보류됨

    socket.on(SOCKET_EVENTS.VN_SYSTEM_MESSAGE, (payload: SystemMessagePayload) => {
      addToast(payload.text, payload.level);
    });

    socket.on(SOCKET_EVENTS.VN_PARTICIPANT_JOIN, (payload: ParticipantPayload) => {
      addToast(`${payload.userName}님이 입장했습니다.`);
      // TRPG 관련 상태(players) 관리는 보류
      // 캐릭터 레이어에도 추가
      setCharacters((prev) => {
        if (prev.some((c) => c.discordId === payload.discordId)) return prev;
        const pos = prev.length % 5;
        return [...prev, {
          discordId: payload.discordId,
          name: payload.userName,
          avatarUrl: payload.avatarUrl,
          standingImageUrl: null,
          baseImageUrl: null,
          faceImageUrl: null,
          isSpeaking: false,
          position: pos,
        }];
      });
    });

    socket.on('error', (data: { message: string }) => {
      addToast(data.message, 'error');
    });

    // 사전 로드
    fetchDictionary();

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  async function fetchDictionary() {
    try {
      const guildId = new URLSearchParams(window.location.search).get('guildId') || '';
      if (!guildId) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/dictionary?guildId=${guildId}`,
        { credentials: 'include' }
      );
      const data = await res.json() as Array<{ word: string; description: string }>;
      setDictionary(data);
    } catch {}
  }

  async function handleDownloadLog(format: 'txt' | 'json') {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/logs/${sessionId}/download/${format}`;
    window.open(url, '_blank');
  }

  return (
    <main className="vn-viewer" id="vn-viewer">
      {/* Layer 0: 배경 */}
      <BackgroundLayer backgroundUrl={backgroundUrl} />

      {/* Layer 1: 캐릭터 스탠딩 */}
      <CharacterLayer characters={characters} />

      {/* Layer 2: 대사창 */}
      <DialogueBox
        speakerName={currentSpeakerName}
        fullText={currentText}
        isTyping={!isTypingDone}
        autoMode={autoMode}
        autoSpeed={autoSpeed}
        onTypingComplete={handleTypingComplete}
        onClick={handleDialogueClick}
        dictionary={dictionary}
      />

      {/* STT 중간 자막 */}
      {interimText && (
        <div className="vn-stt-caption" aria-live="polite">
          🎙 {interimText}...
        </div>
      )}

      {/* 주사위 오버레이 및 상태창 컴포넌트는 보류 */}

      {/* BGM 플레이어 */}
      <BGMPlayer
        bgmPayload={bgmPayload}
        volume={volume}
        onVolumeChange={setVolume}
      />

      {/* STT 컨트롤러 */}
      <STTController
        socket={socketRef.current}
        sessionId={sessionId}
        isEnabled={sttEnabled}
        onToggle={(v) => setSttEnabled(v)}
        onInterimTranscript={setInterimText}
      />

      {/* 상단 컨트롤 바 */}
      <div className="vn-controls">
        {/* 연결 상태 */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isConnected ? 'var(--color-success)' : 'var(--color-danger)',
          boxShadow: `0 0 6px ${isConnected ? 'var(--color-success)' : 'var(--color-danger)'}`,
          flexShrink: 0
        }} title={isConnected ? '연결됨' : '연결 끊김'} />

        {/* 큐 배지 */}
        <div className="vn-queue-badge" title="대기 중인 대사 수">큐: {queueLength}</div>

        {/* 마이크 (VAD + STT) */}
        <button
          id="btn-mic"
          className={`vn-ctrl-btn ${sttEnabled ? 'mic-active' : ''}`}
          onClick={() => setSttEnabled((p) => !p)}
          title={sttEnabled ? '마이크 끄기' : '마이크 켜기 (음성 인식)'}
          aria-label="마이크 토글"
        >
          🎙
        </button>

        {/* 오토모드 */}
        <button
          id="btn-auto"
          className={`vn-ctrl-btn ${autoMode ? 'active' : ''}`}
          onClick={() => setAutoMode((p) => !p)}
          title="오토 모드"
          aria-label="오토모드 토글"
        >
          ▶
        </button>

        {/* 배속 */}
        <button
          id="btn-speed"
          className="vn-speed-badge"
          onClick={() => setAutoSpeed((s) => s === 1.0 ? 1.5 : s === 1.5 ? 2.0 : 1.0)}
          title="재생 속도"
          aria-label="재생 속도 변경"
        >
          {autoSpeed}x
        </button>

        {/* 전체화면 */}
        <button
          id="btn-fullscreen"
          className="vn-ctrl-btn"
          onClick={() => document.fullscreenElement
            ? document.exitFullscreen()
            : document.getElementById('vn-viewer')?.requestFullscreen()
          }
          title="전체화면"
          aria-label="전체화면 토글"
        >
          ⛶
        </button>
      </div>

      {/* 랜딩 복귀 버튼 */}
      <Link href="/dashboard" className="vn-return-btn glass">
        <span className="material-icons" style={{ fontSize: '1.2rem' }}>logout</span>
        나가기
      </Link>

      {/* 토스트 메시지 */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.level}`}>
            {t.text}
          </div>
        ))}
      </div>

      {/* 대화 로그 오버레이 */}
      {logOpen && (
        <div className="vn-log-overlay" onClick={() => setLogOpen(false)}>
          <div className="vn-log-header" onClick={e => e.stopPropagation()}>
            📜 지난 대화 로그
            <button className="vn-log-close-btn" onClick={() => setLogOpen(false)}>✕</button>
          </div>
          <div
            className="vn-log-content"
            ref={logContentRef}
            onClick={e => e.stopPropagation()}
            onWheel={(e) => {
              // 로그창 최하단에서 휠을 아래로 굴리면 닫기
              const content = e.currentTarget;
              if (e.deltaY > 0 && content.scrollTop + content.clientHeight >= content.scrollHeight - 5) {
                setLogOpen(false);
              }
            }}
          >
            {historyLog.map((log, i) => (
              <div key={i} className="vn-log-entry">
                <div className="vn-log-speaker">{log.speakerName}</div>
                <div className="vn-log-text">
                  {log.text.split('\n').map((line, idx) => <span key={idx}>{line}<br /></span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
