"use client";

import { useCallback, useEffect, useState } from "react";
import { CharacterEditor, CharacterDTO } from "@/components/character/CharacterEditor";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function CharacterPage() {
  const [characters, setCharacters] = useState<CharacterDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 세션 참가 시 실제로 사용될 "활성" 캐릭터 — 편집을 위해 목록에서 클릭해
  // 열어보는 selectedId와는 별개의 개념이다.
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const fetchCharacters = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/characters`, { credentials: "include" });
      if (!res.ok) throw new Error("캐릭터 목록을 불러오지 못했습니다.");
      const data: CharacterDTO[] = await res.json();
      setCharacters(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "캐릭터 목록을 불러오지 못했습니다.");
      return [];
    }
  }, []);

  const fetchActiveCharacter = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setActiveCharacterId(data.activeCharacterId ?? null);
    } catch {
      // 실패해도 "사용 중" 배지만 안 보일 뿐 나머지 기능에는 영향 없음
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchCharacters();
      if (data.length > 0) setSelectedId(data[0]._id);
      setLoading(false);
    })();
    fetchActiveCharacter();
  }, [fetchCharacters, fetchActiveCharacter]);

  const handleSaved = async (characterId: string) => {
    await fetchCharacters();
    setSelectedId(characterId);
  };

  const handleSelectActive = async (e: React.MouseEvent, characterId: string) => {
    e.stopPropagation(); // 편집용 목록 클릭(setSelectedId)과 분리
    setSelectingId(characterId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/characters/${characterId}/select`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("캐릭터 선택에 실패했습니다.");
      setActiveCharacterId(characterId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "캐릭터 선택에 실패했습니다.");
    } finally {
      setSelectingId(null);
    }
  };

  const selectedCharacter = selectedId === "new" ? null : characters.find((c) => c._id === selectedId) ?? null;

  return (
    <div className="side-tab-layout">
      <aside className="side-tab-sidebar">
        <h3>내 캐릭터 목록</h3>

        {loading && <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>불러오는 중...</div>}
        {error && <div style={{ color: "var(--color-danger)", fontSize: "0.8rem" }}>{error}</div>}

        {characters.map((c) => {
          const thumb = c.images.find((img) => img.tag === "#Neutral")?.url ?? c.images[0]?.url;
          const isActiveCharacter = activeCharacterId === c._id;
          return (
            <div
              key={c._id}
              className={`side-tab-item ${selectedId === c._id ? "active" : ""}`}
              onClick={() => setSelectedId(c._id)}
            >
              {thumb ? (
                <img src={thumb} className="side-tab-item-img" alt={c.name} />
              ) : (
                <div className="side-tab-item-img" />
              )}
              <span style={{ fontWeight: 500, flex: 1 }}>{c.name}</span>
              {isActiveCharacter ? (
                <span className="char-active-badge" title="세션에서 사용 중인 캐릭터입니다">
                  <span className="material-icons" style={{ fontSize: "0.95rem" }}>check_circle</span>
                  사용 중
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-ghost char-select-btn"
                  disabled={selectingId === c._id}
                  onClick={(e) => handleSelectActive(e, c._id)}
                  title="세션에서 이 캐릭터를 사용하도록 선택"
                >
                  {selectingId === c._id ? "선택 중..." : "선택"}
                </button>
              )}
            </div>
          );
        })}

        <div
          className={`side-tab-item-new ${selectedId === "new" ? "active" : ""}`}
          onClick={() => setSelectedId("new")}
        >
          <span className="material-icons" style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: 4 }}>add</span>
          새 캐릭터 만들기
        </div>
      </aside>

      <main className="side-tab-content" style={{ padding: 32, overflowY: "auto" }}>
        <CharacterEditor key={selectedId} character={selectedCharacter} onSaved={handleSaved} />
      </main>
    </div>
  );
}
