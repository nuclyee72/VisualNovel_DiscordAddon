"use client";

import { useRef, useState } from "react";

export interface FacePart {
  tag: string;          // 정규 포맷: "#Neutral", "#Happy" ...
  previewUrl: string;   // <img> 표시용 (data URL 또는 원격 URL)
  dataUrl?: string;     // 새로 자른 조각인 경우 존재 (업로드 필요)
  url?: string;         // 서버에 이미 저장된 조각인 경우 존재
  key?: string;         // 서버(R2)에 이미 저장된 조각의 오브젝트 키 (재저장 시 유실 방지용)
  originalTag?: string; // 불러왔을 때의 태그. 저장 시 tag와 다르면 "이름 변경"으로 처리한다.
}

interface FaceGridSlicerProps {
  faces: FacePart[];
  onFacesChange: (faces: FacePart[]) => void;
}

export const DEFAULT_TAGS = [
  "#Neutral", "#Happy", "#Sad",
  "#Angry", "#Surprised", "#Embarrassed",
  "#Scared", "#Thinking", "#Custom",
];

export const SLICE_WIDTH = 800;
export const SLICE_HEIGHT = 1080;

export function FaceGridSlicer({ faces, onFacesChange }: FaceGridSlicerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGridUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);
    const reader = new FileReader();

    reader.onerror = () => {
      setIsProcessing(false);
      setError("파일을 읽는 중 오류가 발생했습니다. 다른 이미지로 다시 시도해주세요.");
    };

    reader.onload = (event) => {
      const img = new Image();

      img.onerror = () => {
        setIsProcessing(false);
        setError("이미지를 불러올 수 없습니다. 손상되었거나 지원하지 않는 형식일 수 있습니다.");
      };

      img.onload = () => {
        // 2400x3240 템플릿을 가정하고 800x1080씩 9등분 — 크기가 다르면 조용히
        // 잘못 잘리므로 미리 검증한다.
        const expectedWidth = SLICE_WIDTH * 3;
        const expectedHeight = SLICE_HEIGHT * 3;
        if (img.naturalWidth !== expectedWidth || img.naturalHeight !== expectedHeight) {
          setIsProcessing(false);
          setError(
            `이미지 크기가 ${expectedWidth}×${expectedHeight}가 아닙니다 ` +
            `(업로드한 이미지: ${img.naturalWidth}×${img.naturalHeight}). 템플릿 크기에 맞춰 다시 준비해주세요.`
          );
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = SLICE_WIDTH;
        canvas.height = SLICE_HEIGHT;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          setIsProcessing(false);
          setError("이미지를 처리할 수 없습니다 (canvas 컨텍스트 생성 실패).");
          return;
        }

        const newFaces: FacePart[] = [];

        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            ctx.clearRect(0, 0, SLICE_WIDTH, SLICE_HEIGHT);
            ctx.drawImage(
              img,
              col * SLICE_WIDTH, row * SLICE_HEIGHT, SLICE_WIDTH, SLICE_HEIGHT,
              0, 0, SLICE_WIDTH, SLICE_HEIGHT
            );

            const index = row * 3 + col;
            const dataUrl = canvas.toDataURL("image/png");
            newFaces.push({
              tag: DEFAULT_TAGS[index] || `#표정${index + 1}`,
              previewUrl: dataUrl,
              dataUrl,
            });
          }
        }

        onFacesChange(newFaces);
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleTagChange = (index: number, suffix: string) => {
    const updated = faces.map((f, i) => (i === index ? { ...f, tag: `#${suffix}` } : f));
    onFacesChange(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {faces.length === 0 ? (
        <div className="upload-zone" style={{ padding: 48 }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleGridUpload}
            accept="image/png, image/webp"
          />
          <div className="icon material-icons">grid_view</div>
          <div style={{ color: "var(--color-text-primary)", fontWeight: 600, marginBottom: 8 }}>
            표정 템플릿(Grid) 업로드
          </div>
          <p className="hint">
            2400 × 3240 픽셀의 표정 템플릿을 업로드하면 브라우저에서 자동으로
            9등분(800 × 1080)하여 표정 파츠를 분리합니다.
          </p>
          {error && (
            <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", marginTop: 8 }}>{error}</p>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>추출된 표정 파츠 (9개)</h3>
            <button
              className="btn-ghost"
              style={{ color: "var(--color-danger)", fontSize: "0.85rem" }}
              onClick={() => onFacesChange([])}
            >
              다시 업로드
            </button>
          </div>

          <div className="face-grid-preview">
            {faces.map((face, i) => (
              <div key={i} className="face-slot">
                <div className="face-slot-img-wrap">
                  <img src={face.previewUrl} alt={face.tag} />
                </div>
                <div className="tag-input">
                  <span>#</span>
                  <input
                    type="text"
                    value={face.tag.replace(/^#/, "")}
                    onChange={(e) => handleTagChange(i, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isProcessing && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
        >
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div className="spinner" />
            <p>이미지를 자르는 중입니다...</p>
          </div>
        </div>
      )}
    </div>
  );
}
