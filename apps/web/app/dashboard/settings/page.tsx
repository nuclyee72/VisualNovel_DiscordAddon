"use client";

import { useCallback, useEffect, useState } from "react";
import { EMOJI_EXPRESSION_MAP, EMOTION_TAGS } from "@vn-trpg/shared";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type SettingsTab = "viewer" | "session" | "emoji";

const TABS: Array<{ id: SettingsTab; icon: string; label: string }> = [
  { id: "viewer", icon: "movie", label: "뷰어 설정" },
  { id: "session", icon: "groups", label: "세션 설정" },
  { id: "emoji", icon: "mood", label: "이모지 매핑" },
];

const TYPING_SPEED_OPTIONS = [1.0, 1.5, 2.0];

type MeResponse = {
  viewerSettings?: { defaultAutoMode?: boolean; defaultTypingSpeed?: number };
  expressionAutoDetect?: boolean;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("viewer");
  const [loading, setLoading] = useState(true);

  // ── 뷰어 설정 ──────────────────────────────────────────
  const [defaultAutoMode, setDefaultAutoMode] = useState(false);
  const [defaultTypingSpeed, setDefaultTypingSpeed] = useState(1.0);
  const [viewerSaving, setViewerSaving] = useState(false);
  const [viewerSaved, setViewerSaved] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  // ── 표정 자동 감지 ────────────────────────────────────
  const [expressionAutoDetect, setExpressionAutoDetect] = useState(false);
  const [expressionSaving, setExpressionSaving] = useState(false);
  const [expressionError, setExpressionError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, { credentials: "include" });
      if (!res.ok) return;
      const data: MeResponse = await res.json();
      if (typeof data.viewerSettings?.defaultAutoMode === "boolean") {
        setDefaultAutoMode(data.viewerSettings.defaultAutoMode);
      }
      if (typeof data.viewerSettings?.defaultTypingSpeed === "number") {
        setDefaultTypingSpeed(data.viewerSettings.defaultTypingSpeed);
      }
      if (typeof data.expressionAutoDetect === "boolean") {
        setExpressionAutoDetect(data.expressionAutoDetect);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveViewerSettings = async (next: { defaultAutoMode: boolean; defaultTypingSpeed: number }) => {
    setViewerSaving(true);
    setViewerError(null);
    setViewerSaved(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/settings/viewer`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "저장하지 못했습니다.");
      }
      setViewerSaved(true);
      setTimeout(() => setViewerSaved(false), 2000);
    } catch (err) {
      setViewerError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setViewerSaving(false);
    }
  };

  const handleToggleAutoMode = () => {
    const next = !defaultAutoMode;
    setDefaultAutoMode(next);
    handleSaveViewerSettings({ defaultAutoMode: next, defaultTypingSpeed });
  };

  const handleChangeSpeed = (speed: number) => {
    setDefaultTypingSpeed(speed);
    handleSaveViewerSettings({ defaultAutoMode, defaultTypingSpeed: speed });
  };

  const handleToggleExpressionAutoDetect = async () => {
    const next = !expressionAutoDetect;
    setExpressionAutoDetect(next);
    setExpressionSaving(true);
    setExpressionError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/settings/expression`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "저장하지 못했습니다.");
      }
    } catch (err) {
      setExpressionAutoDetect(!next); // 실패 시 되돌리기
      setExpressionError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setExpressionSaving(false);
    }
  };

  return (
    <div className="side-tab-layout">
      <aside className="side-tab-sidebar">
        <h3>설정 카테고리</h3>
        {TABS.map((tab) => (
          <div
            key={tab.id}
            className={`side-tab-item ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="material-icons" style={{ fontSize: "1.1rem" }}>{tab.icon}</span>
            <span style={{ fontWeight: 500 }}>{tab.label}</span>
          </div>
        ))}
      </aside>

      <div className="side-tab-content">
        {loading ? (
          <div className="tab-panel-placeholder">
            <div className="tab-panel-placeholder-inner">불러오는 중...</div>
          </div>
        ) : activeTab === "viewer" ? (
          <div className="tab-panel">
            <section className="settings-section">
              <h4 className="settings-section-title">기본 오토 모드</h4>
              <p className="settings-desc">뷰어에 처음 입장했을 때 오토 모드가 자동으로 켜져 있을지 정합니다.</p>
              <div className="settings-row">
                <span className="settings-label">오토 모드 기본값</span>
                <button
                  type="button"
                  className={`toggle-switch ${defaultAutoMode ? "on" : ""}`}
                  role="switch"
                  aria-checked={defaultAutoMode}
                  onClick={handleToggleAutoMode}
                >
                  <span className="toggle-switch-knob" />
                </button>
              </div>
            </section>

            <section className="settings-section">
              <h4 className="settings-section-title">기본 재생 속도</h4>
              <p className="settings-desc">오토 모드에서 다음 대사로 넘어가는 속도의 기본값입니다.</p>
              <div className="settings-row">
                <span className="settings-label">배속</span>
                <div className="speed-option-group">
                  {TYPING_SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      className={`speed-option ${defaultTypingSpeed === speed ? "active" : ""}`}
                      onClick={() => handleChangeSpeed(speed)}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="settings-save-status">
              {viewerSaving && <span className="settings-save-status-saving">저장 중...</span>}
              {viewerSaved && <span className="settings-save-status-saved">저장됨</span>}
              {viewerError && <span className="settings-save-status-error">{viewerError}</span>}
            </div>
          </div>
        ) : activeTab === "emoji" ? (
          <div className="tab-panel">
            <section className="settings-section">
              <h4 className="settings-section-title">표정 자동 감지</h4>
              <p className="settings-desc">
                대사 텍스트의 문맥을 분석해 8가지 감정 중 가장 유사한 표정으로 자동 전환합니다.
                단, 이모지나 <code>!Happy</code> 같은 수동 명령어로 표정을 직접 지정한 경우에는
                그 지정이 항상 우선하고, 자동 감지 결과는 무시됩니다.
              </p>
              <div className="settings-row">
                <span className="settings-label">자동 감지 사용</span>
                <button
                  type="button"
                  className={`toggle-switch ${expressionAutoDetect ? "on" : ""}`}
                  role="switch"
                  aria-checked={expressionAutoDetect}
                  disabled={expressionSaving}
                  onClick={handleToggleExpressionAutoDetect}
                >
                  <span className="toggle-switch-knob" />
                </button>
              </div>
              {expressionError && <div className="settings-save-status-error">{expressionError}</div>}

              <div className="emotion-tag-list">
                {EMOTION_TAGS.map((tag) => (
                  <span key={tag} className="emotion-tag-chip">{tag}</span>
                ))}
              </div>
            </section>

            <section className="settings-section">
              <h4 className="settings-section-title">이모지 → 표정 매핑</h4>
              <p className="settings-desc">대사에 아래 이모지가 포함되면 해당 표정으로 즉시 전환됩니다 (수동 지정과 동일하게 최우선순위).</p>
              <div className="emoji-map-grid">
                {Object.entries(EMOJI_EXPRESSION_MAP).map(([emoji, tag]) => (
                  <div key={emoji} className="emoji-map-item">
                    <span className="emoji-map-emoji">{emoji}</span>
                    <span className="material-icons emoji-map-arrow">arrow_forward</span>
                    <span className="emoji-map-tag">{tag}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="tab-panel-placeholder">
            <div className="tab-panel-placeholder-inner">
              <div className="icon material-icons" style={{ fontSize: "3rem" }}>construction</div>
              <div>{TABS.find((t) => t.id === activeTab)?.label} 항목을 준비 중입니다.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
