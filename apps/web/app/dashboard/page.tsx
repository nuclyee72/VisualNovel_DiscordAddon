"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface SessionDTO {
  sessionId: string;
  name: string;
  guildId: string;
  status: "waiting" | "active" | "ended";
  participants: Array<{ discordId: string; userName: string; role: string }>;
  maxParticipants?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGuildId, setNewGuildId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions`, { credentials: "include" });
      if (!res.ok) throw new Error("세션 목록을 불러오지 못했습니다.");
      setSessions(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreate = async () => {
    if (!newName.trim() || !newGuildId.trim()) {
      setCreateError("세션 이름과 서버(길드) ID를 모두 입력해주세요.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, guildId: newGuildId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "세션 생성에 실패했습니다.");
      }
      setNewName("");
      setNewGuildId("");
      setShowCreateForm(false);
      await fetchSessions();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "세션 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyId = async (sessionId: string) => {
    await navigator.clipboard.writeText(sessionId);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId((prev) => (prev === sessionId ? null : prev)), 1500);
  };

  const handleJoin = async (sessionId: string, guildId: string) => {
    setJoiningId(sessionId);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "세션 입장에 실패했습니다.");
      }
      router.push(`/session/${sessionId}?guildId=${encodeURIComponent(guildId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 입장에 실패했습니다.");
      setJoiningId(null);
    }
  };

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 className="page-title">비주얼 노벨 뷰어 창 목록</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>현재 참여 가능한 비주얼 노벨 대화창 목록입니다.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateForm((v) => !v)}>
          <span className="material-icons" style={{ fontSize: "1.1rem" }}>add</span>
          새 세션 만들기
        </button>
      </div>

      {showCreateForm && (
        <div className="card" style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="input-group" style={{ flex: 1, minWidth: 220 }}>
              <label>세션 이름</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 어둠의 숲 탐험기"
              />
            </div>
            <div className="input-group" style={{ flex: 1, minWidth: 220 }}>
              <label>디스코드 서버(길드) ID</label>
              <input
                type="text"
                value={newGuildId}
                onChange={(e) => setNewGuildId(e.target.value)}
                placeholder="디스코드 개발자 모드 → 서버 우클릭 → ID 복사"
              />
            </div>
          </div>
          {createError && <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: 0 }}>{createError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
              {creating ? "생성 중..." : "만들기"}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: "var(--color-text-secondary)" }}>불러오는 중...</p>}
      {error && <p style={{ color: "var(--color-danger)", marginBottom: "1rem" }}>{error}</p>}

      {!loading && sessions.length === 0 && !error && (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)" }}>
          아직 참여 가능한 세션이 없습니다. 디스코드에서 마스터가 <code>/세션시작</code> 명령어로 세션을 연결하면 여기에 표시됩니다.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
        {sessions.map((s) => (
          <div key={s.sessionId} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "var(--color-text-primary)" }}>{s.name}</h3>
              <span className="tag-badge">
                {s.status === "active" ? "진행중" : s.status === "waiting" ? "대기중" : "종료"}
              </span>
            </div>

            <div
              style={{
                display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
                background: "var(--color-bg-card)", padding: "6px 10px", borderRadius: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "monospace", fontSize: "0.78rem", color: "var(--color-text-muted)",
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
                title={s.sessionId}
              >
                {s.sessionId}
              </span>
              <button
                className="btn-ghost"
                style={{ padding: 2, display: "flex" }}
                onClick={() => handleCopyId(s.sessionId)}
                title="세션 ID 복사 (/세션시작 명령어에 사용)"
              >
                <span className="material-icons" style={{ fontSize: "1rem" }}>
                  {copiedId === s.sessionId ? "check" : "content_copy"}
                </span>
              </button>
            </div>

            <div style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              참가자 {s.participants.length}{s.maxParticipants ? ` / ${s.maxParticipants}` : ""}명
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={s.status === "ended" || joiningId === s.sessionId}
              onClick={() => handleJoin(s.sessionId, s.guildId)}
            >
              {joiningId === s.sessionId ? "입장 중..." : "참가하기 ▶"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
