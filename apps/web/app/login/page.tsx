import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '로그인 | TRPG Visual Novel',
  description: '디스코드 계정으로 로그인하여 TRPG 비주얼 노벨 세션에 입장하세요.',
};

export default function LoginPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'radial-gradient(ellipse at top, rgba(124,106,247,0.08) 0%, transparent 60%)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        textAlign: 'center',
      }}>
        {/* 로고 */}
        <div style={{ fontSize: '3rem', marginBottom: '16px', filter: 'drop-shadow(0 0 20px rgba(124,106,247,0.5))' }}>
          ⚔
        </div>
        <h1 style={{
          fontFamily: 'var(--font-title)',
          fontSize: '1.8rem',
          marginBottom: '8px',
          letterSpacing: '0.08em',
        }}>
          VN TRPG
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '40px', fontSize: '0.95rem' }}>
          비주얼 노벨 TRPG 뷰어에 오신 것을 환영합니다
        </p>

        {/* 로그인 카드 */}
        <div className="card" style={{ padding: '40px' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>시작하기</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', marginBottom: '28px', lineHeight: '1.6' }}>
            별도 회원가입 없이<br />
            Discord 계정으로 즉시 로그인
          </p>

          <a
            href={`${backendUrl}/api/auth/login`}
            className="discord-btn"
            id="discord-login-btn"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <svg viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6 0.5c-.7 1.2-1.4 2.8-1.9 4.1a54.1 54.1 0 0 0-16.2 0C27 3.3 26.3 1.7 25.5.5A58.5 58.5 0 0 0 11 4.9C1.6 19 -.9 32.7.3 46.2a58.9 58.9 0 0 0 18 9.1 44.4 44.4 0 0 0 3.8-6.2 38.4 38.4 0 0 1-6-2.9l1.4-1.1a42 42 0 0 0 35.9 0l1.4 1.1a38.3 38.3 0 0 1-6 2.9 44.3 44.3 0 0 0 3.8 6.2 58.8 58.8 0 0 0 18-9.1C72 30.6 68.2 17 60.1 4.9ZM23.7 38c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.5 0 6.4 3.2 6.4 7.1s-2.9 7.1-6.4 7.1Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1c3.5 0 6.4 3.2 6.4 7.1s-2.9 7.1-6.4 7.1Z" fill="currentColor"/>
            </svg>
            Discord로 로그인
          </a>

          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '10px',
            fontSize: '0.78rem',
            color: 'var(--color-text-muted)',
            lineHeight: '1.6',
          }}>
            <strong style={{ color: 'var(--color-text-secondary)' }}>로그인 시 요청하는 권한:</strong><br />
            • 사용자 닉네임·프로필 사진 (identify)<br />
            • 소속 서버 목록 (guilds) — 세션 접근 보안에 사용
          </div>
        </div>

        <p style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          <Link href="/">← 메인으로 돌아가기</Link>
        </p>
      </div>
    </div>
  );
}
