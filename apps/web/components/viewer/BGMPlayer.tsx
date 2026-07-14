'use client';
import { useEffect, useRef, useState } from 'react';
import type { BGMPayload } from '../../../../packages/shared/src/index';

interface BGMPlayerProps {
  bgmPayload: BGMPayload | null;
  volume: number; // 0~1
  onVolumeChange: (v: number) => void;
}

declare global {
  // 최소한의 YouTube IFrame API 앰비언트 타입 선언 (공식 @types 패키지 미설치 환경 대응)
  namespace YT {
    interface PlayerVars {
      [key: string]: unknown;
    }
    interface PlayerEvent {
      target: Player;
    }
    interface Events {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: PlayerEvent) => void;
      onError?: (event: PlayerEvent) => void;
    }
    interface PlayerOptions {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: PlayerVars;
      events?: Events;
    }
    class Player {
      constructor(element: string | HTMLElement, options: PlayerOptions);
      loadVideoById(video: string | { videoId: string; startSeconds?: number }, startSeconds?: number): void;
      setVolume(volume: number): void;
      getVolume(): number;
      mute(): void;
      unMute(): void;
      isMuted(): boolean;
      destroy(): void;
    }
  }

  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// 컴포넌트가 리마운트되어도 <script> 태그가 중복 주입되지 않도록 모듈 스코프에서
// 로드 상태를 한 번만 추적한다. window.onYouTubeIframeAPIReady도 덮어쓰기 전에
// 기존에 등록되어 있던 콜백(다른 컴포넌트가 먼저 등록했을 수 있음)을 체인으로 보존한다.
let youtubeApiLoadPromise: Promise<void> | null = null;
function loadYouTubeIframeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  if (!youtubeApiLoadPromise) {
    youtubeApiLoadPromise = new Promise((resolve) => {
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        resolve();
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.body.appendChild(script);
      }
    });
  }

  return youtubeApiLoadPromise;
}

export default function BGMPlayer({ bgmPayload, volume, onVolumeChange }: BGMPlayerProps) {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentName, setCurrentName] = useState<string | null>(null);
  // 진행 중인 페이드(fadeOut 또는 그 내부에서 만들어지는 fadeIn) 인터벌 ID를 항상
  // 참조할 수 있도록 ref로 추적 — 클린업이 어느 콜백에서 생성됐는지와 무관하게
  // 현재 활성 인터벌을 확실히 정리할 수 있도록 한다.
  const activeFadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // YouTube IFrame API 로드
  useEffect(() => {
    let cancelled = false;
    loadYouTubeIframeAPI().then(() => {
      if (!cancelled) initPlayer();
    });

    return () => {
      cancelled = true;
      // 언마운트 시 플레이어를 실제로 파괴 — 그렇지 않으면 숨겨진 iframe과
      // 내부 타이머가 컴포넌트가 사라진 뒤에도 계속 살아있게 된다.
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  function initPlayer() {
    if (!containerRef.current) return;

    playerRef.current = new window.YT.Player(containerRef.current, {
      width: '0',
      height: '0',
      playerVars: {
        autoplay: 1,
        loop: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          setIsReady(true);
          playerRef.current?.setVolume(Math.round(volume * 100));
        },
      },
    });
  }

  // BGM 변경 (크로스페이드 효과)
  // isReady를 의존성에 포함시켜, 플레이어 초기화가 끝나기 전에 도착한 BGM 변경
  // 이벤트도 플레이어가 준비되는 즉시 한 번은 반드시 적용되도록 한다
  // (이전에는 isReady가 빠져있어 그런 이벤트가 영구히 유실되었음).
  useEffect(() => {
    if (!bgmPayload || !isReady || !playerRef.current) return;

    const player = playerRef.current;
    const targetVolume = Math.round((bgmPayload.volume ?? volume) * 100);

    // 현재 볼륨을 0으로 페이드 아웃 → 새 곡 로드 → 페이드 인
    let currentVol = player.getVolume();
    const fadeOut = setInterval(() => {
      currentVol = Math.max(0, currentVol - 8);
      player.setVolume(currentVol);
      if (currentVol <= 0) {
        clearInterval(fadeOut);
        player.loadVideoById({
          videoId: bgmPayload.youtubeVideoId,
          startSeconds: bgmPayload.startSeconds ?? 0,
        });
        player.setVolume(0);
        setCurrentName(bgmPayload.name);

        // 페이드 인
        let fadeVol = 0;
        const fadeIn = setInterval(() => {
          fadeVol = Math.min(targetVolume, fadeVol + 6);
          player.setVolume(fadeVol);
          if (fadeVol >= targetVolume) {
            clearInterval(fadeIn);
            activeFadeIntervalRef.current = null;
          }
        }, 60);
        activeFadeIntervalRef.current = fadeIn;
      }
    }, 50);
    activeFadeIntervalRef.current = fadeOut;

    return () => {
      if (activeFadeIntervalRef.current) clearInterval(activeFadeIntervalRef.current);
      activeFadeIntervalRef.current = null;
    };
  }, [bgmPayload, isReady]);

  // 볼륨 조절
  useEffect(() => {
    if (!isReady || !playerRef.current || isMuted) return;
    playerRef.current.setVolume(Math.round(volume * 100));
  }, [volume, isReady]);

  function toggleMute() {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(Math.round(volume * 100));
    } else {
      playerRef.current.mute();
    }
    setIsMuted(!isMuted);
  }

  return (
    <>
      {/* 숨김 YouTube 플레이어 */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }}
        aria-hidden="true"
      />

      {/* BGM 상태 표시 (뷰어 우상단) */}
      {currentName && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 'var(--z-toast)' as never,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          padding: '6px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          fontSize: '0.78rem',
          color: 'rgba(255,255,255,0.7)',
        }}>
          <span style={{ fontSize: '1rem' }}>🎵</span>
          <span>{currentName}</span>
          <button
            onClick={toggleMute}
            className="btn-ghost"
            aria-label={isMuted ? '음소거 해제' : '음소거'}
            style={{ fontSize: '0.9rem', padding: '0 4px' }}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            style={{ width: '60px', cursor: 'pointer' }}
            aria-label="볼륨"
          />
        </div>
      )}
    </>
  );
}
