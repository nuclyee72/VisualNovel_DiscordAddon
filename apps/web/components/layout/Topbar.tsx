import Link from 'next/link';

export function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/dashboard" className="logo">
          <span className="material-icons" style={{ color: 'var(--color-accent-primary)' }}>auto_awesome</span>
          <span style={{ fontFamily: 'var(--font-title)', letterSpacing: '2px' }}>VN TRPG</span>
        </Link>
      </div>
      <div className="topbar-right">
        <Link href="/dashboard/settings" className="btn-ghost" title="종합 설정">
          <span className="material-icons">settings</span>
        </Link>
        <Link href="/dashboard/character" className="btn-ghost" title="내 캐릭터 관리">
          <span className="material-icons">account_circle</span>
        </Link>
      </div>
    </header>
  );
}
