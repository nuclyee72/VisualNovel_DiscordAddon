"use client";

import { useState } from "react";
import { AnchorPicker } from "./AnchorPicker";
import { FaceGridSlicer } from "./FaceGridSlicer";

interface CharacterEditorProps {
  characterId: string;
}

export function CharacterEditor({ characterId }: CharacterEditorProps) {
  const [activeTab, setActiveTab] = useState<"base" | "face">("base");
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const handleBaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setBaseImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#f2f3f5] mb-2">
            {characterId === "new" ? "새 캐릭터 만들기" : "캐릭터 편집"}
          </h1>
          <p className="text-sm text-[#b5bac1]">
            캐릭터 스탠딩 이미지를 등록하고 표정과 얼굴 중심축(Anchor)을 설정합니다.
          </p>
        </div>
        <button className="px-5 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-md font-medium transition-colors">
          저장하기
        </button>
      </div>

      <div className="bg-[#2b2d31] rounded-lg border border-[#1e1f22] flex-1 flex flex-col overflow-hidden shadow-lg">
        {/* Tabs */}
        <div className="flex border-b border-[#1e1f22]">
          <button
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === "base"
                ? "text-white border-b-2 border-[#5865f2] bg-[#313338]"
                : "text-[#b5bac1] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
            onClick={() => setActiveTab("base")}
          >
            기본 몸통 & 앵커 지정
          </button>
          <button
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === "face"
                ? "text-white border-b-2 border-[#5865f2] bg-[#313338]"
                : "text-[#b5bac1] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
            onClick={() => setActiveTab("face")}
          >
            표정 템플릿 분할
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#313338]">
          {activeTab === "base" ? (
            <div className="flex flex-col gap-6">
              <div className="flex gap-6">
                {/* Form column */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                      캐릭터 이름 <span className="text-[#f23f42]">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full bg-[#1e1f22] border-none text-[#f2f3f5] rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-[#5865f2]"
                      placeholder="예: 아리엘"
                      defaultValue={characterId === "char1" ? "아리엘" : ""}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                      몸통(Base) 이미지 업로드
                    </label>
                    <div className="border-2 border-dashed border-[#4f545c] rounded-md p-6 text-center hover:bg-[#2b2d31] transition-colors cursor-pointer relative">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleBaseUpload}
                      />
                      <span className="material-icons text-4xl text-[#949ba4] mb-2">cloud_upload</span>
                      <p className="text-sm text-[#b5bac1] font-medium">클릭하거나 이미지를 드래그하여 업로드</p>
                      <p className="text-xs text-[#949ba4] mt-1">PNG (투명 배경 권장), WebP</p>
                    </div>
                  </div>
                  
                  {anchor && (
                    <div className="bg-[#2b2d31] p-4 rounded-md border border-[#1e1f22]">
                      <h3 className="text-sm font-medium text-white mb-1">지정된 앵커 좌표</h3>
                      <p className="text-xs text-[#b5bac1]">X: {anchor.x.toFixed(1)}% / Y: {anchor.y.toFixed(1)}%</p>
                      <p className="text-xs text-[#949ba4] mt-2">이 좌표를 기준으로 표정 파츠가 합성됩니다.</p>
                    </div>
                  )}
                </div>

                {/* Anchor Picker Column */}
                <div className="flex-1 bg-[#1e1f22] rounded-md border border-[#2b2d31] flex flex-col overflow-hidden min-h-[500px]">
                  <div className="bg-[#2b2d31] px-4 py-2 border-b border-[#1e1f22]">
                    <h3 className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">앵커 지정기 (클릭)</h3>
                  </div>
                  <div className="flex-1 p-4 flex items-center justify-center overflow-auto relative">
                    {!baseImage ? (
                      <div className="text-center text-[#949ba4]">
                        <span className="material-icons text-4xl mb-2 opacity-50">person_off</span>
                        <p className="text-sm">몸통 이미지를 업로드하면<br/>여기에 표시됩니다.</p>
                      </div>
                    ) : (
                      <AnchorPicker imageUrl={baseImage} anchor={anchor} onAnchorChange={setAnchor} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <FaceGridSlicer />
          )}
        </div>
      </div>
    </div>
  );
}
