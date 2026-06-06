const timestamp = () => new Date().toISOString()

const formatMeta = (meta = {}) => {
  const entries = Object.entries(meta).filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (!entries.length) return ''
  return ` ${entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(' ')}`
}

export const logInfo = (message, meta = {}) => {
  console.log(`[${timestamp()}] [info] ${message}${formatMeta(meta)}`)
}

export const logWarn = (message, meta = {}) => {
  console.warn(`[${timestamp()}] [warn] ${message}${formatMeta(meta)}`)
}

export const logError = (message, error, meta = {}) => {
  console.error(`[${timestamp()}] [error] ${message}${formatMeta(meta)}`, error)
}

const shouldSkipRequestLog = (req) => {
  return req.path.startsWith('/api/library/image/')
    || req.path.startsWith('/api/pages/')
    || req.path.startsWith('/api/image/')
}

export const requestLogger = (req, res, next) => {
  if (shouldSkipRequestLog(req)) return next()

  const startedAt = Date.now()
  res.on('finish', () => {
    logInfo('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    })
  })
  return next()
}
