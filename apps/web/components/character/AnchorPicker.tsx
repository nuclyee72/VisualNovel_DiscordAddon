"use client";

import { MouseEvent, useRef, useState } from "react";
import { SLICE_WIDTH, SLICE_HEIGHT } from "./FaceGridSlicer";

interface AnchorPickerProps {
  imageUrl: string;
  anchor: { x: number; y: number } | null;
  onAnchorChange: (anchor: { x: number; y: number }) => void;
}

export function AnchorPicker({ imageUrl, anchor, onAnchorChange }: AnchorPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 표정 템플릿 생성 시 실제로 잘려나갈 800×1080 영역을 앵커 위에 겹쳐 보여주기
  // 위해, 원본 이미지의 실제 픽셀 크기를 알아야 한다 (표시 크기는 축소되어 있으므로).
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    onAnchorChange({
      x: Math.round((x / rect.width) * 1000) / 10,
      y: Math.round((y / rect.height) * 1000) / 10,
    });
  };

  const cropBoxSize =
    naturalSize && naturalSize.w > 0 && naturalSize.h > 0
      ? {
          width: `${(SLICE_WIDTH / naturalSize.w) * 100}%`,
          height: `${(SLICE_HEIGHT / naturalSize.h) * 100}%`,
        }
      : null;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div ref={containerRef} className="anchor-picker-wrap" onClick={handleClick}>
        <img
          src={imageUrl}
          alt="Base"
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
          }}
        />

        {anchor && cropBoxSize && (
          <div
            className="anchor-crop-box"
            style={{ left: `${anchor.x}%`, top: `${anchor.y}%`, ...cropBoxSize }}
          />
        )}

        {anchor && (
          <>
            <div className="anchor-marker" style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }} />
            <span
              className="anchor-marker-label"
              style={{ left: `calc(${anchor.x}% + 20px)`, top: `calc(${anchor.y}% + 20px)` }}
            >
              {anchor.x.toFixed(1)}%, {anchor.y.toFixed(1)}%
            </span>
          </>
        )}
      </div>

      {!anchor && <div className="anchor-hint">얼굴이 위치할 중심점을 클릭하세요</div>}
    </div>
  );
}
