/**
 * Next.js Route Handler for Claude AI 심층 분석 엔드포인트.
 *
 * 기존 `next.config.mjs` 의 ``rewrites()`` 프록시는 long-running 요청에서
 * ECONNRESET / socket hang up 이 발생한다 (내부 프록시가 연결을 중간에
 * 끊는 이슈). Claude 호출은 30~60초가 걸리므로 이 엔드포인트만 Route
 * Handler 로 직접 백엔드에 forward 한다. Route Handler 는 Node.js 런타임
 * 에서 동작하며 fetch() 에 타임아웃이 기본 없으므로 안전하게 대기 가능.
 *
 * 경로: POST /api/stocks/{symbol}/ai-analysis
 *   - 히스토리 조회 (GET /api/stocks/{symbol}/ai-analysis/history) 는
 *     별도 서브경로라 rewrites 가 그대로 처리한다.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

// Vercel 배포 시 최대 실행 시간 힌트 (dev 에도 영향 없음)
export const maxDuration = 300

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params
  const target = `${BACKEND_URL}/api/stocks/${encodeURIComponent(symbol)}/ai-analysis`

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // fetch() 기본 타임아웃 없음 → Claude 호출이 수 분 걸려도 대기
      cache: 'no-store',
    })

    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown proxy error'
    return Response.json(
      { detail: `ai-analysis proxy failed: ${message}` },
      { status: 502 },
    )
  }
}
