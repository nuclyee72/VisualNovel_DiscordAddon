import type { Metadata } from 'next';
import Link from 'next/link';
import './landing.css';

export const metadata: Metadata = {
  title: '비주얼 노벨 — 디스코드 세션을 비주얼 노벨로',
  description: '디스코드에서 나누는 대화를 웹에서 비주얼 노벨 스타일로 실시간 감상하세요. 캐릭터 스탠딩 이미지, 실시간 BGM, 주사위 연출을 지원합니다.',
};

export default function LandingPage() {
  return (
    <div className="landing">
      {/* 배경 */}
      <div className="landing-bg">
        <div className="landing-bg-orb orb1" />
        <div className="landing-bg-orb orb2" />
        <div className="landing-bg-orb orb3" />
      </div>

      {/* 헤더 */}
      <header className="landing-header">
        <div className="landing-logo">
          <span className="landing-logo-icon">⚔</span>
          <span className="landing-logo-text">비주얼 노벨</span>
        </div>
        <nav className="landing-nav">
          <Link href="/login" className="btn btn-primary">시작하기</Link>
        </nav>
      </header>

      {/* 히어로 */}
      <section className="landing-hero">
        <div className="landing-hero-badge">🎮 Discord × Visual Novel</div>
        <h1 className="landing-hero-title">
          디스코드 대화를<br />
          <span className="landing-hero-highlight">비주얼 노벨</span>로
        </h1>
        <p className="landing-hero-desc">
          캐릭터 스탠딩 이미지, 실시간 BGM, 주사위 연출로<br />
          디스코드 세션을 완전히 새로운 방식으로 경험하세요.
        </p>
        <div className="landing-hero-cta">
          <Link href="/login" className="discord-btn">
            <svg viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6 0.5c-.7 1.2-1.4 2.8-1.9 4.1a54.1 54.1 0 0 0-16.2 0C27 3.3 26.3 1.7 25.5.5A58.5 58.5 0 0 0 11 4.9C1.6 19 -.9 32.7.3 46.2a58.9 58.9 0 0 0 18 9.1 44.4 44.4 0 0 0 3.8-6.2 38.4 38.4 0 0 1-6-2.9l1.4-1.1a42 42 0 0 0 35.9 0l1.4 1.1a38.3 38.3 0 0 1-6 2.9 44.3 44.3 0 0 0 3.8 6.2 58.8 58.8 0 0 0 18-9.1C72 30.6 68.2 17 60.1 4.9ZM23.7 38c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.5 0 6.4 3.2 6.4 7.1s-2.9 7.1-6.4 7.1Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.5 0 6.4 3.2 6.4 7.1s-2.9 7.1-6.4 7.1Z" fill="currentColor"/>
            </svg>
            디스코드로 시작하기
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-section">
        <h2>지금 바로 시작하세요</h2>
        <p>디스코드 계정 하나로 모든 준비 완료</p>
        <Link href="/login" className="discord-btn">
          <svg viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6 0.5c-.7 1.2-1.4 2.8-1.9 4.1a54.1 54.1 0 0 0-16.2 0C27 3.3 26.3 1.7 25.5.5A58.5 58.5 0 0 0 11 4.9C1.6 19 -.9 32.7.3 46.2a58.9 58.9 0 0 0 18 9.1 44.4 44.4 0 0 0 3.8-6.2 38.4 38.4 0 0 1-6-2.9l1.4-1.1a42 42 0 0 0 35.9 0l1.4 1.1a38.3 38.3 0 0 1-6 2.9 44.3 44.3 0 0 0 3.8 6.2 58.8 58.8 0 0 0 18-9.1C72 30.6 68.2 17 60.1 4.9ZM23.7 38c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.5 0 6.4 3.2 6.4 7.1s-2.9 7.1-6.4 7.1Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.5 0 6.4 3.2 6.4 7.1s-2.9 7.1-6.4 7.1Z" fill="currentColor"/>
          </svg>
          무료로 시작하기
        </Link>
      </section>

      {/* 푸터 */}
      <footer className="landing-footer">
        <p>비주얼 노벨 · 디스코드 애드온</p>
      </footer>
    </div>
  );
}
