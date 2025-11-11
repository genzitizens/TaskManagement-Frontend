// src/api/client.ts
const DEFAULT_PAGE_SIZE = Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE ?? '20')
// Leave base empty for dev proxy OR keep env for non-proxied prod
const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.PROD ? 'https://task.exeltan.com' : '')

export interface RequestOptions extends RequestInit {
  searchParams?: Record<string, string | number | boolean | undefined | null>;
}

const isAbsolute = (u: string) => /^https?:\/\//i.test(u)

function buildUrl(path: string, qp?: RequestOptions['searchParams']) {
  const base = API_BASE_URL
  const url = isAbsolute(base) && base
    ? new URL(path, base)            // absolute -> full URL
    : new URL(path, window.location.origin) // relative -> /api/... so Vite proxy applies
  if (qp) for (const [k, v] of Object.entries(qp)) if (v != null && v !== '') url.searchParams.set(k, String(v))
  return isAbsolute(base) ? url.toString() : url.pathname + url.search
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { searchParams, headers, ...init } = options
  const url = buildUrl(path, searchParams)
  // console.log('API →', init.method ?? 'GET', url)

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...init,
  })

  if (res.status === 204) return undefined as T
  const text = await res.clone().text()
  // console.log('API ←', res.status, res.statusText, text)
  if (!res.ok) throw new Error(text || `${res.status} ${res.statusText}`)
  try { return await res.json() as T } catch { return text as unknown as T }
}

export { API_BASE_URL, DEFAULT_PAGE_SIZE }
