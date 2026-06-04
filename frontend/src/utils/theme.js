export const THEME_STORAGE_KEY = 'manga-theme'

export const normalizeTheme = (theme) => {
  return theme === 'night' ? 'night' : 'soft-light'
}

export const applyTheme = (theme) => {
  const normalized = normalizeTheme(theme)
  document.documentElement.dataset.theme = normalized
  document.documentElement.style.colorScheme = normalized === 'night' ? 'dark' : 'light'
  localStorage.setItem(THEME_STORAGE_KEY, normalized)
  return normalized
}

export const getStoredTheme = () => {
  return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'soft-light')
}
