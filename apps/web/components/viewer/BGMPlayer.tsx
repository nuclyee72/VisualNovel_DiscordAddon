'use client';
import { useEffect, useRef, useState } from 'react';
import type { BGMPayload } from '../../../../packages/shared/src/index';

interface BGMPlayerProps {
  bgmPayload: BGMPayload | null;
  volume: number; // 0~1
  onVolumeChange: (v: number) => void;
}

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function BGMPlayer({ bgmPayload, volume, onVolumeChange }: BGMPlayerProps) {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentName, setCurrentName] = useState<string | null>(null);

  // YouTube IFrame API 로드
  useEffect(() => {
    if (window.YT?.Player) {
      initPlayer();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.body.appendChild(script);

    window.onYouTubeIframeAPIReady = () => {
      initPlayer();
    };

    return () => {
      window.onYouTubeIframeAPIReady = () => {};
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
          if (fadeVol >= targetVolume) clearInterval(fadeIn);
        }, 60);
      }
    }, 50);

    return () => clearInterval(fadeOut);
  }, [bgmPayload]);

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
