"use client";

import { useState } from "react";
import { AnchorPicker } from "./AnchorPicker";
import { FaceGridSlicer, FacePart, SLICE_WIDTH, SLICE_HEIGHT } from "./FaceGridSlicer";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export interface CharacterImageDTO {
  tag: string;
  url: string;
  key: string;
}

export interface CharacterDTO {
  _id: string;
  name: string;
  description?: string;
  images: CharacterImageDTO[];
  baseImageUrl?: string;
  anchorX?: number;
  anchorY?: number;
}

interface CharacterEditorProps {
  character: CharacterDTO | null;
  onSaved: (characterId: string) => void;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    // 응답 바디가 JSON이 아닌 경우 등 — fallback 메시지 사용
  }
  return fallback;
}

async function uploadImage(file: File | Blob, filename: string): Promise<{ url: string; key: string }> {
  const form = new FormData();
  form.append("image", file, filename);
  const res = await fetch(`${BACKEND_URL}/api/upload/image`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "이미지 업로드에 실패했습니다."));
  return res.json();
}

async function saveCharacterFields(
  id: string | null,
  body: Record<string, unknown>
): Promise<{ _id: string }> {
  const res = await fetch(`${BACKEND_URL}/api/characters${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "캐릭터 저장에 실패했습니다."));
  return res.json();
}

async function saveCharacterImage(id: string, tag: string, url: string, key: string) {
  const res = await fetch(`${BACKEND_URL}/api/characters/${id}/images`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag, url, key }),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "표정 이미지 등록에 실패했습니다."));
}

async function deleteCharacterImage(id: string, tag: string) {
  await fetch(`${BACKEND_URL}/api/characters/${id}/images/${encodeURIComponent(tag)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

// data:/blob: URL(로컬에서 방금 고른 파일)은 그대로 두고, R2에 저장된 원격 URL(기존
// 캐릭터를 편집할 때)은 백엔드 프록시를 거치게 한다. 원격 이미지를 CORS 헤더 없이
// canvas에 그리면 canvas가 오염(tainted)되어 toDataURL()이 실패하기 때문이다.
function toCanvasSafeUrl(src: string): string {
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  return `${BACKEND_URL}/api/upload/proxy-image?url=${encodeURIComponent(src)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("아바타 이미지를 불러오지 못했습니다."));
    img.src = toCanvasSafeUrl(src);
  });
}

// 아바타 이미지 + 앵커 좌표를 바탕으로 얼굴 부분만 잘라내, 표정 템플릿과 동일한
// 800×1080 타일을 3×3(2400×3240)으로 반복한 그리드 이미지를 만든다. 잘라낼 영역은
// 항상 앵커(십자선) 좌표를 중심으로 한 정확히 800×1080 픽셀이며, 이미지 경계에
// 부딪혀 일부가 잘리더라도 위치를 옮기지 않고 앵커 중심을 그대로 유지한다.
async function generateFaceGridFromAvatar(
  avatarUrl: string,
  anchor: { x: number; y: number }
): Promise<string> {
  const img = await loadImage(avatarUrl);

  const anchorPxX = (anchor.x / 100) * img.naturalWidth;
  const anchorPxY = (anchor.y / 100) * img.naturalHeight;
  const cropX = Math.round(anchorPxX - SLICE_WIDTH / 2);
  const cropY = Math.round(anchorPxY - SLICE_HEIGHT / 2);

  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = SLICE_WIDTH;
  tileCanvas.height = SLICE_HEIGHT;
  const tileCtx = tileCanvas.getContext("2d");
  if (!tileCtx) throw new Error("canvas 컨텍스트를 생성할 수 없습니다.");
  tileCtx.drawImage(img, cropX, cropY, SLICE_WIDTH, SLICE_HEIGHT, 0, 0, SLICE_WIDTH, SLICE_HEIGHT);

  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = SLICE_WIDTH * 3;
  gridCanvas.height = SLICE_HEIGHT * 3;
  const gridCtx = gridCanvas.getContext("2d");
  if (!gridCtx) throw new Error("canvas 컨텍스트를 생성할 수 없습니다.");
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      gridCtx.drawImage(tileCanvas, col * SLICE_WIDTH, row * SLICE_HEIGHT);
    }
  }

  return gridCanvas.toDataURL("image/png");
}

export function CharacterEditor({ character, onSaved }: CharacterEditorProps) {
  const [activeTab, setActiveTab] = useState<"base" | "face" | "preview">("base");
  const [name, setName] = useState(character?.name ?? "");
  const [baseImageFile, setBaseImageFile] = useState<File | null>(null);
  const [basePreviewUrl, setBasePreviewUrl] = useState<string | null>(character?.baseImageUrl ?? null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(
    character?.baseImageUrl
      ? { x: character.anchorX ?? 50, y: character.anchorY ?? 10 }
      : null
  );
  const [faces, setFaces] = useState<FacePart[]>(
    (character?.images ?? []).map((img) => ({
      tag: img.tag,
      previewUrl: img.url,
      url: img.url,
      key: img.key,
      originalTag: img.tag,
    }))
  );
  const [previewTag, setPreviewTag] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  // 저장 도중(예: R2 미설정으로 이미지 업로드만 실패) 캐릭터 레코드 자체는 이미 생성된
  // 경우, character prop(부모 state)이 갱신되기 전에 재시도하면 새 캐릭터가 중복
  // 생성된다. 그래서 최초 저장 성공 시점의 ID를 로컬에도 별도로 기억해둔다.
  const [savedCharId, setSavedCharId] = useState<string | null>(character?._id ?? null);

  const handleBaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBaseImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setBasePreviewUrl(event.target?.result as string);
      setAnchor((prev) => prev ?? { x: 50, y: 10 });
    };
    reader.readAsDataURL(file);
  };

  const handleAnchorNumberChange = (axis: "x" | "y", value: string) => {
    const num = parseFloat(value);
    const clamped = Number.isNaN(num) ? 0 : Math.round(Math.min(100, Math.max(0, num)) * 10) / 10;
    setAnchor((prev) => ({
      x: axis === "x" ? clamped : prev?.x ?? 50,
      y: axis === "y" ? clamped : prev?.y ?? 10,
    }));
  };

  const handleGenerateFaceTemplate = async () => {
    if (!basePreviewUrl || !anchor) return;

    setGeneratingTemplate(true);
    setSaveError(null);
    try {
      const gridDataUrl = await generateFaceGridFromAvatar(basePreviewUrl, anchor);

      // 바로 표정 슬롯에 반영하지 않고 PNG 파일로만 내려받는다. 사용자가 외부
      // 편집 도구에서 9칸을 표정별로 그려넣은 뒤 "표정 이미지 업로드" 탭에서
      // 직접 업로드하도록 한다.
      const link = document.createElement("a");
      link.href = gridDataUrl;
      link.download = `${name.trim() || "character"}_표정템플릿.png`;
      link.click();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "표정 템플릿 생성에 실패했습니다.");
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const activePreviewFace =
    faces.find((f) => f.tag === previewTag) ?? faces.find((f) => f.tag === "#Neutral") ?? faces[0] ?? null;

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError("캐릭터 이름을 입력해주세요.");
      setActiveTab("base");
      return;
    }

    const tags = faces.map((f) => f.tag);
    const dupTag = tags.find((t, i) => tags.indexOf(t) !== i);
    if (dupTag) {
      setSaveError(`표정 태그 "${dupTag}"가 중복되었습니다. 서로 다른 태그를 사용해주세요.`);
      setActiveTab("face");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveCharacterFields(savedCharId, { name });
      const charId = saved._id;
      // 이후 단계(이미지 업로드 등)가 실패해도 이름 저장까지는 이미 커밋된 상태이므로,
      // 재시도 시 새 캐릭터가 또 생성되지 않도록 여기서 바로 기억해둔다.
      setSavedCharId(charId);

      let baseImageUrl = character?.baseImageUrl;
      if (baseImageFile) {
        const uploaded = await uploadImage(baseImageFile, baseImageFile.name);
        baseImageUrl = uploaded.url;
      }
      if (baseImageUrl || anchor) {
        await saveCharacterFields(charId, {
          baseImageUrl,
          anchorX: anchor?.x,
          anchorY: anchor?.y,
        });
      }

      const updatedFaces: FacePart[] = [];
      for (const face of faces) {
        let url = face.url;
        let key = face.key ?? "";

        if (face.dataUrl) {
          const blob = dataUrlToBlob(face.dataUrl);
          const uploaded = await uploadImage(blob, `${face.tag.replace("#", "")}.png`);
          url = uploaded.url;
          key = uploaded.key;
        }

        // 태그 이름이 바뀐 경우: 새 태그로 저장하기 전에 예전 태그 항목을 지워서
        // 중복 항목이 영구히 남지 않게 한다. (실패해도 저장 자체는 계속 진행)
        if (face.originalTag && face.originalTag !== face.tag) {
          try {
            await deleteCharacterImage(charId, face.originalTag);
          } catch {
            // best-effort — 예전 태그가 남아있어도 치명적이지 않음
          }
        }

        if (url) {
          await saveCharacterImage(charId, face.tag, url, key);
        }

        // 성공적으로 반영된 상태를 기록 — dataUrl을 비워서 다음 저장 때 같은 조각을
        // 다시 업로드하지 않도록 한다.
        updatedFaces.push({ ...face, url, key, dataUrl: undefined, originalTag: face.tag });
      }
      setFaces(updatedFaces);

      onSaved(charId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "1.5rem" }}>
            {character ? "캐릭터 편집" : "새 캐릭터 만들기"}
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>
            캐릭터 스탠딩 이미지를 등록하고 표정과 얼굴 중심축(Anchor)을 설정합니다.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>

      {saveError && (
        <div
          style={{
            background: "rgba(224,85,85,0.15)", border: "1px solid rgba(224,85,85,0.3)",
            color: "var(--color-danger)", padding: "10px 16px", borderRadius: 8,
            marginBottom: 16, fontSize: "0.85rem",
          }}
        >
          {saveError}
        </div>
      )}

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div className="tab-bar">
          <div
            className={`tab-bar-item ${activeTab === "base" ? "active" : ""}`}
            onClick={() => setActiveTab("base")}
          >
            아바타 이미지 업로드
          </div>
          <div
            className={`tab-bar-item ${activeTab === "face" ? "active" : ""}`}
            onClick={() => setActiveTab("face")}
          >
            표정 이미지 업로드
          </div>
          <div
            className={`tab-bar-item ${activeTab === "preview" ? "active" : ""}`}
            onClick={() => setActiveTab("preview")}
          >
            미리보기
          </div>
        </div>

        <div className="tab-panel">
          {activeTab === "base" && (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="input-group">
                  <label>캐릭터 이름 *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 아리엘"
                  />
                </div>

                <div className="input-group">
                  <label>아바타(Base) 이미지 업로드 (권장 1600×4320)</label>
                  <div className="upload-zone">
                    <input type="file" accept="image/png, image/webp" onChange={handleBaseUpload} />
                    <div className="icon material-icons">upload_file</div>
                    <div>클릭하여 이미지 파일 선택</div>
                    <div className="hint">PNG(투명 배경 권장), WebP</div>
                  </div>
                </div>

                {anchor && (
                  <div style={{ background: "var(--color-bg-card)", padding: 16, borderRadius: 8, border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>앵커 좌표 (얼굴 중심 위치, %)</div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div className="input-group">
                        <label>X (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={anchor.x}
                          onChange={(e) => handleAnchorNumberChange("x", e.target.value)}
                          style={{ width: 100 }}
                        />
                      </div>
                      <div className="input-group">
                        <label>Y (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={anchor.y}
                          onChange={(e) => handleAnchorNumberChange("y", e.target.value)}
                          style={{ width: 100 }}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                      오른쪽 이미지를 클릭해서 지정할 수도 있습니다.
                    </div>

                    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleGenerateFaceTemplate}
                        disabled={generatingTemplate}
                        style={{ alignSelf: "flex-start" }}
                      >
                        {generatingTemplate ? "생성 중..." : "이 얼굴로 표정 템플릿 만들기 (3×3)"}
                      </button>
                      <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                        앵커(십자선) 위치를 중심으로 800×1080 픽셀 영역을 그대로 잘라 9칸(3×3, 2400×3240)
                        표정 템플릿을 자동 생성합니다. 생성된 이미지가 다운로드되니, 각 칸을 원하는
                        표정으로 편집한 뒤 "표정 이미지 업로드" 탭에서 다시 업로드하면 표정별로
                        교체할 수 있습니다.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  flex: 2, minWidth: 300, display: "flex", justifyContent: "center", alignItems: "flex-start",
                  background: "#1e1f22", borderRadius: 8, padding: 16, border: "1px solid var(--color-border)",
                }}
              >
                {!basePreviewUrl ? (
                  <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "60px 0" }}>
                    아바타 이미지를 업로드하면
                    <br />
                    여기에 표시됩니다.
                  </div>
                ) : (
                  <AnchorPicker imageUrl={basePreviewUrl} anchor={anchor} onAnchorChange={setAnchor} />
                )}
              </div>
            </div>
          )}

          {activeTab === "face" && <FaceGridSlicer faces={faces} onFacesChange={setFaces} />}

          {activeTab === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {faces.length > 0 && (
                <div className="char-preview-tag-row">
                  {faces.map((f) => (
                    <button
                      key={f.tag}
                      className={`char-preview-tag-btn ${activePreviewFace?.tag === f.tag ? "active" : ""}`}
                      onClick={() => setPreviewTag(f.tag)}
                    >
                      {f.tag}
                    </button>
                  ))}
                </div>
              )}

              <div className="char-preview-stage">
                {!basePreviewUrl ? (
                  <div style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
                    아바타 이미지를 업로드하면
                    <br />
                    미리보기가 표시됩니다.
                  </div>
                ) : (
                  <div className="char-preview-composite">
                    <img src={basePreviewUrl} alt="아바타" className="char-preview-base" />
                    {activePreviewFace && (
                      <img
                        src={activePreviewFace.previewUrl}
                        alt={activePreviewFace.tag}
                        className="char-preview-face"
                        style={{ left: `${anchor?.x ?? 50}%`, top: `${anchor?.y ?? 10}%` }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
