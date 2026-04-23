/**
 * Backend API 클라이언트. Next.js rewrites 설정에 따라
 * /api/* 경로가 FastAPI 백엔드 (http://localhost:8000) 로 프록시된다.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const payload = await res.json()
      if (payload?.detail) detail = String(payload.detail)
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  return handleResponse<T>(res)
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPut<T>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiDelete(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok && res.status !== 204) {
    throw new ApiError(res.status, `HTTP ${res.status}`)
  }
}
