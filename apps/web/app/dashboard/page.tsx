"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface SessionDTO {
  sessionId: string;
  name: string;
  guildId: string;
  masterId: string;
  status: "waiting" | "active" | "ended";
  participants: Array<{ discordId: string; userName: string; role: string }>;
  maxParticipants?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 세션 "닫기" 버튼은 마스터 본인에게만 보여야 하므로, 현재 로그인한 유저의
  // discordId를 알아야 한다.
  const [myDiscordId, setMyDiscordId] = useState<string | null>(null);

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setMyDiscordId(data.discordId ?? null);
        }
      } catch {
        // 실패해도 "닫기" 버튼만 안 보일 뿐, 나머지 대시보드 기능에는 영향 없음
      }
    })();
  }, []);

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

  // 이 서버(길드)의 멤버라면 뷰어 접속 시 소켓 레벨에서 자동으로 참가 처리되므로,
  // 여기서 별도로 참가 API를 먼저 호출할 필요 없이 바로 뷰어로 이동하면 된다.
  const handleEnter = (sessionId: string, guildId: string) => {
    router.push(`/session/${sessionId}?guildId=${encodeURIComponent(guildId)}`);
  };

  const handleClose = async (sessionId: string) => {
    const ok = window.confirm("이 세션을 닫으시겠습니까? 닫힌 세션은 다시 열 수 없습니다.");
    if (!ok) return;

    setClosingId(sessionId);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "세션을 닫지 못했습니다.");
      }
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션을 닫지 못했습니다.");
    } finally {
      setClosingId(null);
    }
  };

  const handleDownloadLog = (sessionId: string, format: "txt" | "json") => {
    window.open(`${BACKEND_URL}/api/logs/${sessionId}/download/${format}`, "_blank");
  };

  const handleDelete = async (sessionId: string) => {
    const ok = window.confirm(
      "이 세션을 완전히 삭제하시겠습니까?\n대화 로그까지 함께 영구적으로 삭제되며, 되돌릴 수 없습니다.\n로그가 필요하면 삭제 전에 먼저 다운로드해주세요."
    );
    if (!ok) return;

    setDeletingId(sessionId);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/permanent`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "세션을 삭제하지 못했습니다.");
      }
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션을 삭제하지 못했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 className="page-title">비주얼 노벨 뷰어 창 목록</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>현재 참여 가능한 비주얼 노벨 대화창 목록입니다.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowCreateForm((v) => !v)}>
          <span className="material-icons" style={{ fontSize: "1.1rem" }}>add</span>
          수동으로 만들기
        </button>
      </div>

      <div
        className="card"
        style={{
          marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: 10,
          background: "var(--color-bg-card)", fontSize: "0.85rem", color: "var(--color-text-secondary)",
        }}
      >
        <span className="material-icons" style={{ color: "var(--color-accent-primary)" }}>info</span>
        <span>
          세션은 디스코드 채널에서 <code>/세션생성</code> 명령어로 만드는 걸 추천합니다 — 서버 ID를 몰라도 되고,
          생성과 동시에 바로 시작되며, 나온 링크를 서버 멤버 누구에게나 공유하면 별도 참가 절차 없이 바로 입장할 수 있습니다.
          아래 "수동으로 만들기"는 웹에서 직접 만들어야 할 때만 사용하세요.
        </span>
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
          아직 참여 가능한 세션이 없습니다. 디스코드에서 마스터가 <code>/세션생성</code> 명령어로 세션을 만들면 여기에 표시됩니다.
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
                title="세션 ID 복사 (봇 재시작 후 /세션시작으로 재연결할 때 사용)"
              >
                <span className="material-icons" style={{ fontSize: "1rem" }}>
                  {copiedId === s.sessionId ? "check" : "content_copy"}
                </span>
              </button>
            </div>

            <div style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              참가자 {s.participants.length}{s.maxParticipants ? ` / ${s.maxParticipants}` : ""}명
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={s.status === "ended"}
                onClick={() => handleEnter(s.sessionId, s.guildId)}
                title="이 서버 멤버라면 누구나 별도 참가 절차 없이 바로 입장합니다"
              >
                입장하기 ▶
              </button>
              {/* 세션을 만든 마스터 본인에게만 닫기 버튼을 보여준다 (서버도 동일하게 강제함) */}
              {myDiscordId === s.masterId && s.status !== "ended" && (
                <button
                  className="btn btn-secondary"
                  style={{ color: "var(--color-danger)" }}
                  disabled={closingId === s.sessionId}
                  onClick={() => handleClose(s.sessionId)}
                  title="세션 닫기"
                >
                  {closingId === s.sessionId ? "닫는 중..." : "닫기"}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center", fontSize: "0.8rem", padding: "8px" }}
                onClick={() => handleDownloadLog(s.sessionId, "txt")}
                title="대화 로그를 텍스트 파일로 다운로드"
              >
                <span className="material-icons" style={{ fontSize: "1rem" }}>description</span>
                TXT
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center", fontSize: "0.8rem", padding: "8px" }}
                onClick={() => handleDownloadLog(s.sessionId, "json")}
                title="대화 로그를 JSON 파일로 다운로드"
              >
                <span className="material-icons" style={{ fontSize: "1rem" }}>data_object</span>
                JSON
              </button>
              {/* 완전 삭제는 종료된 세션에 대해서만, 마스터 본인에게만 보여준다 (서버도 동일하게 강제함) */}
              {myDiscordId === s.masterId && s.status === "ended" && (
                <button
                  className="btn-ghost"
                  style={{ padding: "8px", display: "flex", color: "var(--color-danger)" }}
                  disabled={deletingId === s.sessionId}
                  onClick={() => handleDelete(s.sessionId)}
                  title="세션 완전 삭제 (되돌릴 수 없음)"
                >
                  <span className="material-icons" style={{ fontSize: "1.1rem" }}>
                    {deletingId === s.sessionId ? "hourglass_top" : "delete_forever"}
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
