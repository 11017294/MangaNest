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

export const fetchSettings = () => request('/settings')
export const updateSetting = (key, value) => request('/settings', {
  method: 'POST',
  body: JSON.stringify({ key, value })
})

export const scanLibrary = (libraryPath) => request('/library/scan', {
  method: 'POST',
  body: JSON.stringify(libraryPath ? { libraryPath } : {})
})

export const fetchComics = () => request('/library/comics')
export const fetchComic = (id) => request(`/library/comics/${id}`)
export const fetchChapterPages = (id) => request(`/chapters/${id}/pages`)
export const setComicFavorite = (comicId, favorite) => request(`/comics/${comicId}/favorite`, {
  method: 'PUT',
  body: JSON.stringify({ favorite })
})
export const pageImageUrl = (pageId) => `${API_BASE}/pages/${pageId}/image`
export const setComicCover = (comicId, coverPath) => request(`/comics/${comicId}/cover`, {
  method: 'PUT',
  body: JSON.stringify({ coverPath })
})
export const setComicCategories = (comicId, categoryIds) => request(`/comics/${comicId}/categories`, {
  method: 'PUT',
  body: JSON.stringify({ categoryIds })
})
export const deleteComicIndex = (comicId) => request(`/comics/${comicId}`, { method: 'DELETE' })

export const fetchCategories = () => request('/categories')
export const createCategory = (name, sortOrder) => request('/categories', {
  method: 'POST',
  body: JSON.stringify({ name, sortOrder })
})
export const updateCategory = (id, payload) => request(`/categories/${id}`, {
  method: 'PUT',
  body: JSON.stringify(payload)
})
export const deleteCategory = (id) => request(`/categories/${id}`, { method: 'DELETE' })

export const fetchFolder = (dir = '', options = {}) => {
  const params = new URLSearchParams({ dir })
  if (options.hideMarked) params.set('hideMarked', 'true')
  return request(`/admin/folders?${params.toString()}`)
}
export const createFolder = (parentPath, name) => request('/admin/folders', {
  method: 'POST',
  body: JSON.stringify({ parentPath, name })
})
export const renameFile = (path, newName) => request('/admin/files/rename', {
  method: 'POST',
  body: JSON.stringify({ path, newName })
})
export const replaceFolderPrefixes = (dir, oldPrefix, newPrefix) => request('/admin/folders/prefix-replace', {
  method: 'POST',
  body: JSON.stringify({ dir, oldPrefix, newPrefix })
})
export const moveFile = (path, targetParentPath) => request('/admin/files/move', {
  method: 'POST',
  body: JSON.stringify({ path, targetParentPath })
})
export const moveFolder = (path, targetParentPath) => request('/admin/folders/move', {
  method: 'POST',
  body: JSON.stringify({ path, targetParentPath })
})
export const deleteFile = (path) => request(`/admin/files?path=${encodeURIComponent(path)}`, {
  method: 'DELETE'
})
export const revealFile = (path) => request('/admin/files/reveal', {
  method: 'POST',
  body: JSON.stringify({ path })
})
export const setFolderCover = (folderPath, imagePath) => request('/admin/folders/cover', {
  method: 'POST',
  body: JSON.stringify({ folderPath, imagePath })
})
export const setFolderMarked = (folderPath, marked) => request('/admin/folders/mark', {
  method: 'POST',
  body: JSON.stringify({ folderPath, marked })
})
