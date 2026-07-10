"use client";

import { useState, useRef } from "react";

interface FacePart {
  id: string;
  dataUrl: string;
  tag: string;
}

export function FaceGridSlicer() {
  const [faces, setFaces] = useState<FacePart[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultTags = ["Neutral", "Happy", "Sad", "Angry", "Surprised", "Embarrassed", "Scared", "Thinking", "Custom"];

  const handleGridUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // We assume 2400x3240 resolution. Each part is 800x1080.
        const SLICE_WIDTH = 800;
        const SLICE_HEIGHT = 1080;
        
        const canvas = document.createElement("canvas");
        canvas.width = SLICE_WIDTH;
        canvas.height = SLICE_HEIGHT;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          setIsProcessing(false);
          return;
        }

        const newFaces: FacePart[] = [];
        
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            ctx.clearRect(0, 0, SLICE_WIDTH, SLICE_HEIGHT);
            // Draw cropped part
            ctx.drawImage(
              img,
              col * SLICE_WIDTH, row * SLICE_HEIGHT, SLICE_WIDTH, SLICE_HEIGHT,
              0, 0, SLICE_WIDTH, SLICE_HEIGHT
            );
            
            const index = row * 3 + col;
            newFaces.push({
              id: `face-${index}`,
              dataUrl: canvas.toDataURL("image/png"),
              tag: defaultTags[index] || `표정${index + 1}`
            });
          }
        }
        
        setFaces(newFaces);
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleTagChange = (id: string, newTag: string) => {
    setFaces(faces.map(f => f.id === id ? { ...f, tag: newTag } : f));
  };

  return (
    <div className="flex flex-col gap-6">
      {faces.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-[#4f545c] rounded-lg bg-[#2b2d31]">
          <span className="material-icons text-6xl text-[#5865f2] mb-4">grid_on</span>
          <h3 className="text-xl font-bold text-white mb-2">표정 템플릿(Grid) 업로드</h3>
          <p className="text-[#b5bac1] text-center mb-6 max-w-md">
            2400 × 3240 픽셀의 표정 템플릿을 업로드하면 브라우저에서 자동으로 9등분(800 × 1080)하여 표정 파츠를 분리합니다.
          </p>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-md font-medium transition-colors flex items-center gap-2"
          >
            <span className="material-icons">upload_file</span>
            템플릿 이미지 선택
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleGridUpload} 
            accept="image/png, image/webp" 
            className="hidden" 
          />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-white">추출된 표정 파츠 (9개)</h3>
            <button 
              onClick={() => setFaces([])}
              className="text-[#f23f42] hover:text-[#da373c] text-sm font-medium"
            >
              다시 업로드
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-6">
            {faces.map((face) => (
              <div key={face.id} className="bg-[#1e1f22] rounded-lg overflow-hidden border border-[#2b2d31] flex flex-col">
                <div className="bg-[url('https://png.pngtree.com/png-vector/20191018/ourmid/pngtree-transparent-background-pattern-png-image_1824213.jpg')] bg-repeat aspect-[800/1080] w-full flex items-center justify-center">
                  <img src={face.dataUrl} alt={face.tag} className="w-full h-full object-contain" />
                </div>
                <div className="p-3 bg-[#2b2d31]">
                  <label className="block text-xs text-[#949ba4] mb-1">매핑 태그</label>
                  <div className="flex items-center bg-[#1e1f22] rounded px-2 focus-within:ring-1 focus-within:ring-[#5865f2]">
                    <span className="text-[#949ba4] font-bold text-sm">#</span>
                    <input 
                      type="text" 
                      value={face.tag}
                      onChange={(e) => handleTagChange(face.id, e.target.value)}
                      className="bg-transparent border-none text-white text-sm w-full p-2 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2b2d31] p-6 rounded-lg flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-[#5865f2] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-white font-medium">이미지를 자르는 중입니다...</p>
          </div>
        </div>
      )}
    </div>
  );
}
