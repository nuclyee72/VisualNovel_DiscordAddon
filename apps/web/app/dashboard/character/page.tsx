"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { CharacterEditor } from "@/components/character/CharacterEditor";

export default function CharacterPage() {
  const [selectedChar, setSelectedChar] = useState<string>("new");

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#1e1f22] bg-[#2b2d31] p-4 flex flex-col gap-4">
        <h2 className="text-xs font-bold text-[#b5bac1] tracking-wider mb-2">내 캐릭터 목록</h2>
        
        <div 
          className={`p-3 rounded-md cursor-pointer transition-colors ${selectedChar === 'char1' ? 'bg-[#404249] text-white' : 'hover:bg-[#313338] text-[#b5bac1]'}`}
          onClick={() => setSelectedChar('char1')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1e1f22] flex items-center justify-center overflow-hidden">
              <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Ariel&backgroundColor=b6e3f4" alt="avatar" />
            </div>
            <span className="font-medium text-sm">아리엘</span>
          </div>
        </div>

        <button 
          className={`p-3 rounded-md border border-dashed border-[#4f545c] text-[#949ba4] text-sm hover:bg-[#313338] hover:text-white transition-colors ${selectedChar === 'new' ? 'bg-[#313338] border-solid border-[#5865f2] text-white' : ''}`}
          onClick={() => setSelectedChar('new')}
        >
          + 새 캐릭터 만들기
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#313338] p-8">
        <CharacterEditor characterId={selectedChar} />
      </main>
    </div>
  );
}
