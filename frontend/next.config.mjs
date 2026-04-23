/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // lightweight-charts 는 ESM 전용 (type: "module") 이라 Next.js 번들러가
  // transpile 하도록 명시. Turbopack 에서 import 해결 실패 시 차트가 undefined 가 되어
  // 캔버스가 안 뜨는 증상을 방지.
  transpilePackages: ['lightweight-charts'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
}

export default nextConfig
