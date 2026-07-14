"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "theater_comedy", label: "세션" },
  { href: "/dashboard/character", icon: "face", label: "캐릭터" },
  { href: "/dashboard/settings", icon: "settings", label: "설정" },
];

interface MeResponse {
  username: string;
  avatar?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, { credentials: "include" });
        if (res.ok) {
          setUser(await res.json());
        } else {
          router.push("/login");
        }
      } catch {
        // 백엔드에 연결할 수 없는 경우 등 — 로그인 페이지로 보내는 대신 조용히 무시
        // (네트워크 문제로 로그인 페이지에 갇히는 것을 방지)
      }
    })();
  }, [router]);

  const handleLogout = async () => {
    await fetch(`${BACKEND_URL}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/login");
  };

  return (
    <aside className="admin-sidebar">
      <Link href="/dashboard" className="admin-sidebar-brand">
        <span className="material-icons" style={{ color: "var(--color-accent-primary)" }}>
          auto_awesome
        </span>
        <span>비주얼 노벨</span>
      </Link>

      <nav className="admin-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`admin-nav-item ${active ? "active" : ""}`}>
              <span className="material-icons">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="admin-sidebar-footer">
          <img src={user.avatar || "/assets/default-avatar.png"} alt={user.username} />
          <span className="user-name">{user.username}</span>
          <button className="logout-btn" onClick={handleLogout} title="로그아웃">
            <span className="material-icons" style={{ fontSize: "1.1rem" }}>
              logout
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
