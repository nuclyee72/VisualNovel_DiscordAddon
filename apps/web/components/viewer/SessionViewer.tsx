'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Link from 'next/link';
import '../../app/session/viewer.css';

import BackgroundLayer from '@/components/viewer/BackgroundLayer';
import CharacterLayer, { CharacterState } from '@/components/viewer/CharacterLayer';
import DialogueBox from '@/components/viewer/DialogueBox';
import BGMPlayer from '@/components/viewer/BGMPlayer';
import STTController from '@/components/viewer/STTController';
import DiceOverlay from '@/components/viewer/DiceOverlay';
import StatusPanel, { type PlayerStats } from '@/components/viewer/StatusPanel';

import {
  SOCKET_EVENTS,
  calcAutoDelay,
  MAX_SESSION_PARTICIPANTS,
  MAX_MERGED_DIALOGUE_LINES,
  type DialoguePayload,
  type DicePayload,
  type BGMPayload,
  type StatusUpdatePayload,
  type SystemMessagePayload,
  type SpeakerPayload,
  type ExpressionPayload,
  type ParticipantPayload,
} from '@vn-trpg/shared';

// ── 상태 타입들 ──────────────────────────────────────────────
interface Toast {
  id: number;
  text: string;
  level: 'info' | 'warning' | 'error';
}

interface DictionaryEntry {
  word: string;
  description: string;
}

export default function SessionViewer({ sessionId }: { sessionId: string }) {
  // ── 연결 상태 ─────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // 세션이 유효하지 않거나(존재하지 않음/종료됨) 참가자가 아니어서 서버가
  // 'error'를 emit한 경우 — 이 상태가 세팅되면 뷰어 대신 .vn-no-session 화면을 보여준다.
  const [sessionError, setSessionError] = useState<string | null>(null);

  // ── 씬 상태 ──────────────────────────────────────────────
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [bgmPayload, setBgmPayload] = useState<BGMPayload | null>(null);
  const [characters, setCharacters] = useState<CharacterState[]>([]);
  const [speakerDiscordId, setSpeakerDiscordId] = useState<string | null>(null);

  // ── 주사위 / 상태창 ──────────────────────────────────────
  const [dicePayload, setDicePayload] = useState<DicePayload | null>(null);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  // 사이드바 제목 — 세션의 실제 이름을 불러오기 전까지는 sessionId를 그대로 보여준다.
  const [sessionDisplayName, setSessionDisplayName] = useState(sessionId);

  // ── 대사창 상태 ──────────────────────────────────────────
  const [currentSpeakerName, setCurrentSpeakerName] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const dialogueQueueRef = useRef<DialoguePayload[]>([]);
  const isProcessingRef = useRef(false);
  // 소켓 핸들러는 마운트 시점에 한 번만 설정되어 state를 직접 읽으면 값이 고정되므로
  // (stale closure), 현재 표시 중인 대사의 최신 값을 ref로도 함께 들고 있는다.
  const currentTextRef = useRef('');
  const currentSpeakerDiscordIdRef = useRef<string | null>(null);

  // ── 로그 창 상태 ─────────────────────────────────────────
  const [historyLog, setHistoryLog] = useState<DialoguePayload[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const logContentRef = useRef<HTMLDivElement>(null);

  // ── 오토모드 ─────────────────────────────────────────────
  const [autoMode, setAutoMode] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(1.0);
  // 크롬은 백그라운드 탭의 setTimeout을 최대 분당 1회까지 스로틀링한다.
  // 오토모드 다음 대사 타이머는 스로틀링 영향을 덜 받는 Web Worker에서 돌린다.
  const autoTimerIdRef = useRef(0);
  const autoWorkerRef = useRef<Worker | null>(null);

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

    currentSpeakerDiscordIdRef.current = next.speakerDiscordId;
    currentTextRef.current = next.text;
    setCurrentSpeakerName(next.speakerName);
    setCurrentText(next.text);
    setIsTypingDone(false);
  }, []);

  // 같은 화자가 연속으로 말하면 새 대사창을 큐에 쌓는 대신, 아직 표시되지 않은
  // 대기열 마지막 항목(또는 큐가 비어 지금 화면에 표시 중인 대사)에 줄바꿈으로
  // 이어붙인다. 합친 줄 수가 최대치를 넘으면 병합하지 않고 새 대사로 분리한다.
  const tryMergeConsecutiveDialogue = useCallback((payload: DialoguePayload): boolean => {
    const queue = dialogueQueueRef.current;
    const queueTail = queue[queue.length - 1];

    if (queueTail && queueTail.speakerDiscordId === payload.speakerDiscordId) {
      const merged = `${queueTail.text}\n${payload.text}`;
      if (merged.split('\n').length > MAX_MERGED_DIALOGUE_LINES) return false;
      queueTail.text = merged;
      queueTail.timestamp = payload.timestamp;
      return true;
    }

    if (
      queue.length === 0 &&
      isProcessingRef.current &&
      currentSpeakerDiscordIdRef.current === payload.speakerDiscordId
    ) {
      const merged = `${currentTextRef.current}\n${payload.text}`;
      if (merged.split('\n').length > MAX_MERGED_DIALOGUE_LINES) return false;

      currentTextRef.current = merged;
      setCurrentText(merged);
      setIsTypingDone(false);
      // 이미 예약된 오토모드 다음-대사 타이머가 있다면 무효화한다 — 그 타이머는
      // 병합 전의 짧은 텍스트 기준으로 계산된 지연 시간이라, 그대로 두면 방금
      // 이어붙인 내용이 다 타이핑되기도 전에 다음 대사로 넘어가 버린다. 새로
      // 늘어난 텍스트가 다 타이핑되면 handleTypingComplete가 다시 예약한다.
      autoTimerIdRef.current += 1;
      setHistoryLog((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], text: merged, timestamp: payload.timestamp };
        return updated;
      });
      return true;
    }

    return false;
  }, []);

  // 오토모드 타이머 워커 초기화 (백그라운드 탭에서도 정확히 동작)
  useEffect(() => {
    const workerCode = `
      self.onmessage = (e) => {
        const { id, delay } = e.data;
        setTimeout(() => { self.postMessage({ id }); }, delay);
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    worker.onmessage = (e: MessageEvent<{ id: number }>) => {
      if (e.data.id === autoTimerIdRef.current) {
        processNextDialogue();
      }
    };
    autoWorkerRef.current = worker;
    return () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, [processNextDialogue]);

  // 타이핑 완료 → 오토모드 타이머 or 대기
  const handleTypingComplete = useCallback(() => {
    setIsTypingDone(true);
    if (autoMode) {
      const delay = calcAutoDelay(currentText, autoSpeed);
      autoTimerIdRef.current += 1;
      autoWorkerRef.current?.postMessage({ id: autoTimerIdRef.current, delay });
    }
  }, [autoMode, autoSpeed, currentText]);

  // 클릭 → 다음 대사
  const handleDialogueClick = useCallback(() => {
    autoTimerIdRef.current += 1; // 대기 중인 오토모드 타이머 무효화
    processNextDialogue();
  }, [processNextDialogue]);

  // 오토모드 켜기/끄기 — 타이머 스케줄링 상태와 동기화되도록 함께 처리한다.
  // - 끌 때: 이미 예약되어 있던 워커 타이머를 무효화한다 (안 그러면 끈 직후에도
  //   한 번 더 원치 않는 자동 진행이 발생함).
  // - 켤 때: 이미 타이핑이 끝나 대기 중인(idle) 상태라면, handleTypingComplete와
  //   동일한 방식으로 즉시 타이머를 예약한다 (안 그러면 다음 사용자 클릭까지
  //   그 줄에서 멈춰버림).
  const toggleAutoMode = useCallback(() => {
    setAutoMode((prev) => {
      const next = !prev;
      if (!next) {
        autoTimerIdRef.current += 1;
      } else if (isTypingDone) {
        const delay = calcAutoDelay(currentText, autoSpeed);
        autoTimerIdRef.current += 1;
        autoWorkerRef.current?.postMessage({ id: autoTimerIdRef.current, delay });
      }
      return next;
    });
  }, [isTypingDone, currentText, autoSpeed]);

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
      if (e.code === 'KeyA') toggleAutoMode();
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
  }, [logOpen, handleDialogueClick, toggleAutoMode]);

  // ── Socket.IO 초기화 ──────────────────────────────────────
  useEffect(() => {
    // vn_token은 httpOnly 쿠키라 JS에서 못 읽는다 — withCredentials로 핸드셰이크
    // 요청에 쿠키를 자동으로 실어 보내고, 서버에서 직접 파싱해 인증한다.
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit(SOCKET_EVENTS.CLIENT_JOIN_SESSION, { sessionId });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      addToast(`연결 실패: ${err.message}`, 'error');
    });

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
      if (tryMergeConsecutiveDialogue(payload)) return;

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
          return { ...c, currentTag: payload.tag };
        })
      );
    });

    socket.on(SOCKET_EVENTS.VN_DICE, (payload: DicePayload) => {
      setDicePayload(payload);
    });

    socket.on(SOCKET_EVENTS.VN_STATUS_UPDATE, (payload: StatusUpdatePayload) => {
      // 상태창 UI는 hp/mp 바만 지원 — custom 필드는 표시 대상이 아니므로 무시
      if (payload.field !== 'hp' && payload.field !== 'mp') return;
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.discordId !== payload.discordId) return p;
          const updatedStat = { current: payload.currentValue, max: payload.maxValue };
          return payload.field === 'hp' ? { ...p, hp: updatedStat } : { ...p, mp: updatedStat };
        })
      );
    });

    socket.on(SOCKET_EVENTS.VN_SYSTEM_MESSAGE, (payload: SystemMessagePayload) => {
      addToast(payload.text, payload.level);
    });

    socket.on(SOCKET_EVENTS.VN_PARTICIPANT_JOIN, (payload: ParticipantPayload & {
      baseImageUrl?: string | null;
      anchorX?: number;
      anchorY?: number;
      images?: Array<{ tag: string; url: string }>;
    }) => {
      addToast(`${payload.userName}님이 입장했습니다.`);
      setCharacters((prev) => {
        if (prev.some((c) => c.discordId === payload.discordId)) return prev;
        // % 5 모듈로 연산은 참가자가 5명을 넘으면 슬롯이 겹쳐(예: 6번째가 1번째와
        // 같은 자리) 스탠딩 이미지가 서로 포개어 그려지는 문제가 있었다.
        // MAX_SESSION_PARTICIPANTS(10)에 맞춰 CSS 슬롯도 10개로 늘렸으므로,
        // 캡을 씌워 그 범위를 절대 벗어나지 않게 한다.
        const pos = Math.min(prev.length, MAX_SESSION_PARTICIPANTS - 1);
        return [...prev, {
          discordId: payload.discordId,
          name: payload.userName,
          avatarUrl: payload.avatarUrl,
          standingImageUrl: null,
          baseImageUrl: payload.baseImageUrl || null,
          faceImageUrl: null,
          anchorX: payload.anchorX ?? 50,
          anchorY: payload.anchorY ?? 10,
          currentTag: '#Neutral',
          images: payload.images || [],
          isSpeaking: false,
          position: pos,
        }];
      });
      setPlayers((prev) => {
        if (prev.some((p) => p.discordId === payload.discordId)) return prev;
        return [...prev, {
          discordId: payload.discordId,
          name: payload.userName,
          avatarUrl: payload.avatarUrl,
          role: payload.role || 'player',
          hp: { current: 0, max: 0 },
          mp: { current: 0, max: 0 },
        }];
      });
    });

    socket.on(SOCKET_EVENTS.VN_PARTICIPANT_LEAVE, (payload: { sessionId: string; discordId: string }) => {
      // 퇴장한 참가자의 스탠딩을 무대에서 내리고, 상태창 목록에서도 제거하며,
      // 혹시 그 사람이 발언 중이던 상태였다면 하이라이트도 함께 해제한다.
      setCharacters((prev) => prev.filter((c) => c.discordId !== payload.discordId));
      setPlayers((prev) => prev.filter((p) => p.discordId !== payload.discordId));
      setSpeakerDiscordId((prev) => (prev === payload.discordId ? null : prev));
    });

    socket.on('error', (data: { message: string }) => {
      // 세션이 유효하지 않거나(존재하지 않음/종료됨) 참가자가 아닌 경우 서버가
      // 보내는 치명적 오류 — 뷰어 화면 대신 "세션 없음" 상태로 전환한다.
      setSessionError(data.message || '세션에 연결할 수 없습니다.');
    });

    // 사전 로드
    fetchDictionary();
    // 세션 표시 이름 로드 (사이드바 제목용 — 못 불러오면 sessionId로 대체)
    fetchSessionName();
    // 계정에 저장된 뷰어 기본 설정(오토모드/배속) 로드 — 못 불러오면 기본값 유지
    fetchViewerSettings();

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  async function fetchSessionName() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sessions/${sessionId}`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.name === 'string' && data.name.trim()) {
        setSessionDisplayName(data.name);
      }
    } catch {
      // 실패해도 sessionId를 그대로 표시하므로 무시
    }
  }

  async function fetchViewerSettings() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data = await res.json();
      const settings = data?.viewerSettings;
      if (typeof settings?.defaultAutoMode === 'boolean') setAutoMode(settings.defaultAutoMode);
      if (typeof settings?.defaultTypingSpeed === 'number') setAutoSpeed(settings.defaultTypingSpeed);
    } catch {
      // 실패해도 기본값(오토모드 꺼짐, 1.0배속)으로 계속 진행
    }
  }

  async function fetchDictionary() {
    try {
      const guildId = new URLSearchParams(window.location.search).get('guildId') || '';
      if (!guildId) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/dictionary?guildId=${guildId}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      // API가 에러 시 null/객체 등 비배열을 내려줄 수 있으므로 방어적으로 처리한다.
      // 에러 바운더리가 없는 앱이라, 여기서 걸러주지 않으면 이후 dictionary.length/.map
      // 호출에서 예외가 나 뷰어 전체가 빈 흰 화면으로 멈춰버린다.
      if (Array.isArray(data)) {
        setDictionary(
          data.filter(
            (entry): entry is DictionaryEntry =>
              !!entry && typeof entry.word === 'string' && typeof entry.description === 'string'
          )
        );
      } else {
        setDictionary([]);
      }
    } catch {
      setDictionary([]);
    }
  }

  async function handleDownloadLog(format: 'txt' | 'json') {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/logs/${sessionId}/download/${format}`;
    window.open(url, '_blank');
  }

  // 세션이 유효하지 않거나(존재하지 않음/종료됨) 참가자가 아니라서 서버가 join을
  // 거부한 경우 — 뷰어 대신 "세션 없음" 화면을 보여준다.
  if (sessionError) {
    return (
      <main className="vn-viewer vn-no-session" id="vn-viewer">
        <div className="vn-no-session-icon">⚠️</div>
        <div>{sessionError}</div>
        <Link href="/dashboard" className="btn btn-primary">
          대시보드로 돌아가기
        </Link>
      </main>
    );
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

      {/* 주사위 굴림 오버레이 — 굴림 이벤트가 올 때마다 잠깐 표시되었다 자동으로 사라짐 */}
      <DiceOverlay payload={dicePayload} onClose={() => setDicePayload(null)} />

      {/* 캐릭터 상태창 (HP/MP) — 토글 가능한 사이드바로 상시 마운트 */}
      <StatusPanel
        isOpen={statusPanelOpen}
        onToggle={() => setStatusPanelOpen((p) => !p)}
        players={players}
        speakingDiscordId={speakerDiscordId}
        sessionName={sessionDisplayName}
        onDownloadLog={handleDownloadLog}
      />

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
          onClick={toggleAutoMode}
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
