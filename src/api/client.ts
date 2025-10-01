const DEFAULT_PAGE_SIZE = Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE ?? '20');
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8002';

export interface RequestOptions extends RequestInit {
  searchParams?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, searchParams?: RequestOptions['searchParams']) {
  const url = new URL(path, API_BASE_URL);
  if (searchParams) {
    Object.entries(searchParams)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .forEach(([key, value]) => url.searchParams.set(key, String(value)));
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { searchParams, headers, ...init } = options;
  const url = buildUrl(path, searchParams);

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export { API_BASE_URL, DEFAULT_PAGE_SIZE };
