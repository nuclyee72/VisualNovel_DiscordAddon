import type { Metadata } from 'next';
import Link from 'next/link';
import './landing.css';

export const metadata: Metadata = {
  title: 'TRPG Visual Novel — 디스코드 TRPG를 비주얼 노벨로',
  description: '디스코드 TRPG 세션을 비주얼 노벨 형식으로 즐기는 웹 뷰어. 캐릭터 스탠딩 이미지, 실시간 BGM, 3D 주사위 애니메이션을 경험하세요.',
};

const FEATURES = [
  {
    icon: '🎭',
    title: '비주얼 노벨 연출',
    desc: '캐릭터 스탠딩 이미지, 대사 타이핑 효과, 표정 변화로 몰입감 있는 TRPG를 즐기세요.',
  },
  {
    icon: '🎵',
    title: '실시간 BGM',
    desc: 'YouTube 링크로 배경음악을 즉시 변경. 크로스페이드 효과로 자연스러운 분위기 전환.',
  },
  {
    icon: '🎲',
    title: '3D 주사위 애니메이션',
    desc: '/roll 명령어를 치면 전체 화면에 주사위가 굴러가며 결과를 드라마틱하게 표시합니다.',
  },
  {
    icon: '🎙️',
    title: '음성 인식 자막',
    desc: '브라우저 내장 음성 인식으로 말하는 내용이 자동으로 대사창에 표시됩니다.',
  },
  {
    icon: '⚔️',
    title: 'TRPG 상태창',
    desc: 'HP/MP를 실시간으로 확인하고, 슬래시 명령어로 즉시 변경. 애니메이션 스테이터스 바.',
  },
  {
    icon: '🔒',
    title: 'Discord OAuth2 보안',
    desc: '디스코드 계정으로 원클릭 로그인. 서버 멤버만 세션에 입장할 수 있는 보안 접근.',
  },
];

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
          <span className="landing-logo-text">VN TRPG</span>
        </div>
        <nav className="landing-nav">
          <Link href="#features">기능</Link>
          <Link href="#how">사용법</Link>
          <Link href="/login" className="btn btn-primary">시작하기</Link>
        </nav>
      </header>

      {/* 히어로 */}
      <section className="landing-hero">
        <div className="landing-hero-badge">🎮 Discord TRPG × Visual Novel</div>
        <h1 className="landing-hero-title">
          디스코드 TRPG를<br />
          <span className="landing-hero-highlight">비주얼 노벨</span>로
        </h1>
        <p className="landing-hero-desc">
          캐릭터 스탠딩 이미지, 실시간 BGM, 3D 주사위 애니메이션으로<br />
          테이블톱 RPG를 완전히 새로운 방식으로 경험하세요.
        </p>
        <div className="landing-hero-cta">
          <Link href="/login" className="discord-btn">
            <svg viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6 0.5c-.7 1.2-1.4 2.8-1.9 4.1a54.1 54.1 0 0 0-16.2 0C27 3.3 26.3 1.7 25.5.5A58.5 58.5 0 0 0 11 4.9C1.6 19 -.9 32.7.3 46.2a58.9 58.9 0 0 0 18 9.1 44.4 44.4 0 0 0 3.8-6.2 38.4 38.4 0 0 1-6-2.9l1.4-1.1a42 42 0 0 0 35.9 0l1.4 1.1a38.3 38.3 0 0 1-6 2.9 44.3 44.3 0 0 0 3.8 6.2 58.8 58.8 0 0 0 18-9.1C72 30.6 68.2 17 60.1 4.9ZM23.7 38c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.5 0 6.4 3.2 6.4 7.1s-2.9 7.1-6.4 7.1Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.5 0 6.4 3.2 6.4 7.1s-2.9 7.1-6.4 7.1Z" fill="currentColor"/>
            </svg>
            디스코드로 시작하기
          </Link>
          <Link href="#features" className="btn btn-secondary">기능 살펴보기</Link>
        </div>

        {/* 통계 */}
        <div className="landing-stats">
          <div className="landing-stat"><span>10명</span> 동시 접속</div>
          <div className="landing-stat-divider" />
          <div className="landing-stat"><span>무료</span> STT 음성인식</div>
          <div className="landing-stat-divider" />
          <div className="landing-stat"><span>실시간</span> 이벤트 동기화</div>
        </div>
      </section>

      {/* 기능 그리드 */}
      <section className="landing-features" id="features">
        <h2 className="landing-section-title">주요 기능</h2>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card card">
              <div className="landing-feature-icon">{f.icon}</div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 사용법 */}
      <section className="landing-how" id="how">
        <h2 className="landing-section-title">사용법</h2>
        <div className="landing-steps">
          {[
            { step: '01', title: '디스코드로 로그인', desc: '별도 회원가입 없이 Discord 계정으로 즉시 입장' },
            { step: '02', title: '캐릭터 등록', desc: '스탠딩 이미지를 태그별로 업로드하고 기본 설정 완료' },
            { step: '03', title: '세션 생성', desc: '마스터가 세션을 만들고 참여 링크를 플레이어에게 공유' },
            { step: '04', title: '비주얼 노벨 시작', desc: '/세션시작 커맨드로 봇 연결 후 TRPG 시작!' },
          ].map((s) => (
            <div key={s.step} className="landing-step">
              <div className="landing-step-num">{s.step}</div>
              <div className="landing-step-content">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
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
        <p>TRPG Visual Novel Discord Addon</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          Next.js · discord.js · Socket.IO · MongoDB
        </p>
      </footer>
    </div>
  );
}
