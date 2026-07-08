export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  params?: Record<string, string>
  signal?: AbortSignal
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error || res.statusText)
  }
  return res.json()
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  if (params) {
    const url = new URL(path, window.location.origin)
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v)
    })
    return url.toString()
  }
  return path
}

export const api = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return fetch(buildUrl(path, options?.params), {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: options?.signal,
    }).then(handleResponse<T>)
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    }).then(handleResponse<T>)
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return fetch(path, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    }).then(handleResponse<T>)
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return fetch(path, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: options?.signal,
    }).then(handleResponse<T>)
  },
}
