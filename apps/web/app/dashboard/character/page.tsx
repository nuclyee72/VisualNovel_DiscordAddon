"use client";

import { useCallback, useEffect, useState } from "react";
import { CharacterEditor, CharacterDTO } from "@/components/character/CharacterEditor";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function CharacterPage() {
  const [characters, setCharacters] = useState<CharacterDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchCharacters();
      if (data.length > 0) setSelectedId(data[0]._id);
      setLoading(false);
    })();
  }, [fetchCharacters]);

  const handleSaved = async (characterId: string) => {
    await fetchCharacters();
    setSelectedId(characterId);
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
              <span style={{ fontWeight: 500 }}>{c.name}</span>
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
