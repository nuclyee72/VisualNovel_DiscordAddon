// 이 프로젝트는 apps/web 자체의 .env가 아니라 모노레포 루트의 .env 하나를 공유한다.
// Next.js는 자신의 프로젝트 루트(apps/web)의 .env*만 자동으로 읽으므로, 여기서
// 명시적으로 루트 .env를 로드하지 않으면 NEXT_PUBLIC_* 값이 항상 undefined가 되고
// 아래 env 블록도 조용히 빈 값을 내보내게 된다.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: 'pub-*.r2.dev' },
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  },
};

module.exports = nextConfig;
