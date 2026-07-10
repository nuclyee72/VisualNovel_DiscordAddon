import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TRPG Visual Novel | 비주얼 노벨 TRPG 뷰어',
  description: '디스코드 TRPG 세션을 비주얼 노벨 연출로 즐기는 웹 뷰어. 캐릭터 스탠딩, 실시간 BGM, 주사위 애니메이션 지원.',
  keywords: 'TRPG, 비주얼노벨, 디스코드, 롤플레이, 주사위',
  openGraph: {
    title: 'TRPG Visual Novel',
    description: '디스코드 TRPG를 비주얼 노벨로',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
