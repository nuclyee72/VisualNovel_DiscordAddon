"use client";

import { MouseEvent, useRef } from "react";

interface AnchorPickerProps {
  imageUrl: string;
  anchor: { x: number; y: number } | null;
  onAnchorChange: (anchor: { x: number; y: number }) => void;
}

export function AnchorPicker({ imageUrl, anchor, onAnchorChange }: AnchorPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate percentage coordinates
    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    onAnchorChange({ x: percentX, y: percentY });
  };

  return (
    <div className="relative inline-block max-w-full max-h-full">
      <div 
        ref={containerRef}
        className="relative cursor-crosshair shadow-lg rounded-md overflow-hidden bg-[url('https://png.pngtree.com/png-vector/20191018/ourmid/pngtree-transparent-background-pattern-png-image_1824213.jpg')] bg-repeat"
        onClick={handleClick}
      >
        <img 
          src={imageUrl} 
          alt="Base Image" 
          className="max-w-full max-h-[600px] object-contain block pointer-events-none" 
        />
        
        {/* Anchor Marker */}
        {anchor && (
          <div 
            className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-[#f23f42] bg-[rgba(242,63,66,0.2)] shadow-[0_0_10px_rgba(242,63,66,0.8)] relative flex items-center justify-center">
              <div className="w-1 h-1 bg-[#f23f42] rounded-full"></div>
              {/* Crosshairs */}
              <div className="absolute w-12 h-[1px] bg-[#f23f42]"></div>
              <div className="absolute w-[1px] h-12 bg-[#f23f42]"></div>
            </div>
            <div className="absolute top-5 left-5 bg-[rgba(0,0,0,0.7)] text-white text-[10px] px-1 py-0.5 rounded whitespace-nowrap">
              {anchor.x.toFixed(1)}%, {anchor.y.toFixed(1)}%
            </div>
          </div>
        )}
      </div>
      
      {!anchor && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-[rgba(88,101,242,0.9)] text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none animate-pulse">
          얼굴이 위치할 중심점을 클릭하세요
        </div>
      )}
    </div>
  );
}
