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
        <h1 className="landing-hero-title">
          디스코드 <span className="landing-hero-highlight">비주얼 노벨</span> 뷰어
        </h1>
      </section>

      {/* 푸터 */}
      <footer className="landing-footer">
        <p>비주얼 노벨 · 디스코드 애드온</p>
      </footer>
    </div>
  );
}
