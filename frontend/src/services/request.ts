export const getBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/$/, '')

  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:3001`
}

export const API_BASE = `${getBaseUrl()}/api`

export const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  })

  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const data = await res.json()
      message = data.error || data.detail || message
    } catch {}
    throw new Error(message)
  }

  return res.json() as Promise<T>
}

export const imageUrl = (relativePath?: string | null) => {
  if (!relativePath) return ''
  return `${API_BASE}/library/image/${encodeURIComponent(relativePath)}`
}

export const pageImageUrl = (pageId: number | string) => `${API_BASE}/pages/${pageId}/image`
export const pageThumbUrl = (pageId: number | string) => `${API_BASE}/pages/${pageId}/thumb`
