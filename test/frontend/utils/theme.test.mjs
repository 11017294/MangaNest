import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.document = {
  documentElement: {
    dataset: {},
    style: {}
  }
}

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value))
}

const { THEME_STORAGE_KEY, applyTheme, getStoredTheme, normalizeTheme } = await import('../../../frontend/src/utils/theme.js')

test('normalizeTheme only accepts supported app themes', () => {
  assert.equal(normalizeTheme('night'), 'night')
  assert.equal(normalizeTheme('soft-light'), 'soft-light')
  assert.equal(normalizeTheme('dark-theme'), 'soft-light')
  assert.equal(normalizeTheme(undefined), 'soft-light')
})

test('applyTheme writes theme state to document and localStorage', () => {
  const applied = applyTheme('night')

  assert.equal(applied, 'night')
  assert.equal(document.documentElement.dataset.theme, 'night')
  assert.equal(document.documentElement.style.colorScheme, 'dark')
  assert.equal(localStorage.getItem(THEME_STORAGE_KEY), 'night')
})

test('getStoredTheme returns normalized persisted theme', () => {
  localStorage.setItem(THEME_STORAGE_KEY, 'night')
  assert.equal(getStoredTheme(), 'night')

  localStorage.setItem(THEME_STORAGE_KEY, 'unknown')
  assert.equal(getStoredTheme(), 'soft-light')
})
