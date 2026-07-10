'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface BackgroundLayerProps {
  backgroundUrl: string | null;
}

export default function BackgroundLayer({ backgroundUrl }: BackgroundLayerProps) {
  // A/B 크로스페이드 구현 — 두 레이어를 번갈아 사용
  const [layers, setLayers] = useState({
    A: backgroundUrl ?? '/assets/backgrounds/default.jpg',
    B: null as string | null,
    active: 'A' as 'A' | 'B',
  });

  const prevUrlRef = useRef(backgroundUrl);

  useEffect(() => {
    if (!backgroundUrl || backgroundUrl === prevUrlRef.current) return;
    prevUrlRef.current = backgroundUrl;

    setLayers((prev) => {
      const next = prev.active === 'A' ? 'B' : 'A';
      return {
        ...prev,
        [next]: backgroundUrl,
        active: next,
      };
    });
  }, [backgroundUrl]);

  return (
    <div className="vn-background">
      {/* Layer A */}
      {layers.A && (
        <div
          className={`vn-bg-layer ${layers.active === 'A' ? 'active' : 'inactive'}`}
          style={{ backgroundImage: `url(${layers.A})` }}
        />
      )}
      {/* Layer B */}
      {layers.B && (
        <div
          className={`vn-bg-layer ${layers.active === 'B' ? 'active' : 'inactive'}`}
          style={{ backgroundImage: `url(${layers.B})` }}
        />
      )}
      {/* 하단 그라디언트 오버레이 */}
      <div className="vn-bg-overlay" />
    </div>
  );
}
