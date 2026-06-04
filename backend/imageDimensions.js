import fs from 'node:fs'

const emptyDimensions = () => ({ width: null, height: null })

const readPng = (buffer) => {
  if (buffer.length < 24) return null
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    }
  }
  return null
}

const readGif = (buffer) => {
  if (buffer.length < 10) return null
  const signature = buffer.subarray(0, 6).toString('ascii')
  if (signature === 'GIF87a' || signature === 'GIF89a') {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8)
    }
  }
  return null
}

const readWebp = (buffer) => {
  if (buffer.length < 30) return null
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF') return null
  if (buffer.subarray(8, 12).toString('ascii') !== 'WEBP') return null

  const chunk = buffer.subarray(12, 16).toString('ascii')
  if (chunk === 'VP8X' && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3)
    const height = 1 + buffer.readUIntLE(27, 3)
    return { width, height }
  }

  if (chunk === 'VP8 ' && buffer.length >= 30) {
    const start = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]))
    if (start > -1 && start + 7 < buffer.length) {
      return {
        width: buffer.readUInt16LE(start + 3) & 0x3fff,
        height: buffer.readUInt16LE(start + 5) & 0x3fff
      }
    }
  }

  if (chunk === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    }
  }

  return null
}

const readJpeg = (buffer) => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null
  let offset = 2

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)

    if (isStartOfFrame && offset + 8 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      }
    }

    if (!length) break
    offset += 2 + length
  }

  return null
}

export const readImageDimensionsFromBuffer = (buffer) => {
  return readPng(buffer) || readGif(buffer) || readWebp(buffer) || readJpeg(buffer) || emptyDimensions()
}

export const readImageDimensions = (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath)
    return readImageDimensionsFromBuffer(buffer)
  } catch {
    return emptyDimensions()
  }
}
