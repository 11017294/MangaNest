export const normalizeRelativePath = (value = '') => {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim()
}

export const replacePathPrefix = (value, oldPrefix, newPrefix) => {
  const normalizedValue = normalizeRelativePath(value)
  const normalizedOldPrefix = normalizeRelativePath(oldPrefix)
  const normalizedNewPrefix = normalizeRelativePath(newPrefix)
  if (!normalizedValue || !normalizedOldPrefix || !normalizedNewPrefix) return normalizedValue

  const archiveSeparator = normalizedValue.indexOf('#')
  const basePath = archiveSeparator >= 0 ? normalizedValue.slice(0, archiveSeparator) : normalizedValue
  const suffix = archiveSeparator >= 0 ? normalizedValue.slice(archiveSeparator) : ''

  if (basePath === normalizedOldPrefix) return `${normalizedNewPrefix}${suffix}`
  if (basePath.startsWith(`${normalizedOldPrefix}/`)) return `${normalizedNewPrefix}${basePath.slice(normalizedOldPrefix.length)}${suffix}`
  return normalizedValue
}

export const pathsOverlap = (left, right) => {
  const normalizedLeft = normalizeRelativePath(left)
  const normalizedRight = normalizeRelativePath(right)
  if (!normalizedLeft || !normalizedRight) return normalizedLeft === normalizedRight
  return normalizedLeft === normalizedRight
    || normalizedLeft.startsWith(`${normalizedRight}/`)
    || normalizedRight.startsWith(`${normalizedLeft}/`)
}
