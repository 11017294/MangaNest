const getBaseUrl = () => {
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:3001`
}

export const API_BASE = `${getBaseUrl()}/api`

const request = async (path, options = {}) => {
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

  return res.json()
}

export const imageUrl = (relativePath) => {
  if (!relativePath) return ''
  return `${API_BASE}/library/image/${encodeURIComponent(relativePath)}`
}

export const pageImageUrl = (pageId) => `${API_BASE}/pages/${pageId}/image`
export const pageThumbUrl = (pageId) => `${API_BASE}/pages/${pageId}/thumb`

export const fetchComics = () => request('/library/comics')
export const fetchComic = (id) => request(`/library/comics/${id}`)
export const fetchChapter = (id) => request(`/chapters/${id}`)
export const fetchChapterPages = (id) => request(`/chapters/${id}/pages`)
export const fetchRecent = () => request('/recent')
export const fetchRanking = () => request('/ranking')
export const fetchSettings = () => request('/settings')
export const fetchCategories = () => request('/categories')

export const scanLibrary = (libraryPath) => request('/library/scan', {
  method: 'POST',
  body: JSON.stringify(libraryPath ? { libraryPath } : {})
})

export const saveProgress = (payload) => request('/progress', {
  method: 'PUT',
  body: JSON.stringify(payload)
})

export const recordReadingEvent = (payload) => request('/reading-events', {
  method: 'POST',
  body: JSON.stringify(payload)
})

export const createCategory = (name) => request('/categories', {
  method: 'POST',
  body: JSON.stringify({ name })
})

export const setComicFavorite = (comicId, favorite) => request(`/comics/${comicId}/favorite`, {
  method: 'PUT',
  body: JSON.stringify({ favorite })
})

export const setComicCategories = (comicId, categoryIds) => request(`/comics/${comicId}/categories`, {
  method: 'PUT',
  body: JSON.stringify({ categoryIds })
})

export const setComicCover = (comicId, coverPath) => request(`/comics/${comicId}/cover`, {
  method: 'PUT',
  body: JSON.stringify({ coverPath })
})

export const deleteComicIndex = (comicId) => request(`/comics/${comicId}`, {
  method: 'DELETE'
})

export const updateSetting = (key, value) => request('/settings', {
  method: 'POST',
  body: JSON.stringify({ key, value })
})
