import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '비주얼 노벨 | 디스코드 비주얼 노벨 뷰어',
  description: '디스코드 세션을 비주얼 노벨 연출로 즐기는 웹 뷰어. 캐릭터 스탠딩, 실시간 BGM, 주사위 애니메이션 지원.',
  keywords: '비주얼노벨, 디스코드, 롤플레이, 주사위',
  openGraph: {
    title: '비주얼 노벨',
    description: '디스코드 대화를 비주얼 노벨로',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
      </head>
      <body>{children}</body>
    </html>
  );
}
