import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from './providers'

/**
 * 카카오 작은글씨 (Kakao Small Sans) — body / UI 기본.
 * 3 weight: Light(300) / Regular(400) / Bold(700).
 * 라이선스: SIL Open Font License 1.1.
 */
const kakaoSmall = localFont({
  src: [
    {
      path: './fonts/KakaoSmallSans-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: './fonts/KakaoSmallSans-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/KakaoSmallSans-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-kakao-small',
})

/**
 * 카카오 큰글씨 (Kakao Big Sans) — 제목/디스플레이용.
 * 3 weight: Regular(400) / Bold(700) / ExtraBold(800).
 */
const kakaoBig = localFont({
  src: [
    {
      path: './fonts/KakaoBigSans-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/KakaoBigSans-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/KakaoBigSans-ExtraBold.woff2',
      weight: '800',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-kakao-big',
})

export const metadata: Metadata = {
  title: 'StarNion — Stocks War Room',
  description: '실시간 AI 타점 분석 & 시장 인텔리전스 대시보드',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="bg-background">
      <body
        className={`${kakaoSmall.variable} ${kakaoBig.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
