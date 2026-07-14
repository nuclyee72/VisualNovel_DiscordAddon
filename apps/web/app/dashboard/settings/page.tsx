"use client";

import { useState } from "react";

type SettingsTab = "viewer" | "session" | "emoji";

const TABS: Array<{ id: SettingsTab; icon: string; label: string }> = [
  { id: "viewer", icon: "movie", label: "뷰어 설정" },
  { id: "session", icon: "groups", label: "세션 설정" },
  { id: "emoji", icon: "mood", label: "이모지 매핑" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("viewer");

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
        <div className="tab-panel-placeholder">
          <div className="tab-panel-placeholder-inner">
            <div className="icon material-icons" style={{ fontSize: "3rem" }}>construction</div>
            <div>{TABS.find((t) => t.id === activeTab)?.label} 항목을 준비 중입니다.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
