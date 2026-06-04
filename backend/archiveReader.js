import yauzl from 'yauzl'
import { IMAGE_EXTENSIONS } from './imageTypes.js'
import path from 'node:path'

const naturalCompare = (a, b) => a.localeCompare(b, undefined, {
  numeric: true,
  sensitivity: 'base'
})

const normalizeEntryName = (name) => name.replace(/\\/g, '/')

const openZip = (archivePath) => new Promise((resolve, reject) => {
  yauzl.open(archivePath, { lazyEntries: true }, (error, zipfile) => {
    if (error) reject(error)
    else resolve(zipfile)
  })
})

export const listArchiveImages = async (archivePath) => {
  const zipfile = await openZip(archivePath)
  const images = []

  return await new Promise((resolve, reject) => {
    zipfile.readEntry()

    zipfile.on('entry', (entry) => {
      const name = normalizeEntryName(entry.fileName)
      const ext = path.extname(name).toLowerCase()
      if (!/\/$/.test(name) && IMAGE_EXTENSIONS.has(ext)) {
        images.push({
          name,
          fileSize: entry.uncompressedSize
        })
      }
      zipfile.readEntry()
    })

    zipfile.on('end', () => {
      resolve(images.sort((a, b) => naturalCompare(a.name, b.name)))
    })
    zipfile.on('error', reject)
  })
}

export const readArchiveEntryBuffer = async (archivePath, entryName) => {
  const normalizedTarget = normalizeEntryName(entryName)
  const zipfile = await openZip(archivePath)

  return await new Promise((resolve, reject) => {
    zipfile.readEntry()

    zipfile.on('entry', (entry) => {
      const name = normalizeEntryName(entry.fileName)
      if (name !== normalizedTarget) {
        zipfile.readEntry()
        return
      }

      zipfile.openReadStream(entry, (error, stream) => {
        if (error) {
          reject(error)
          return
        }
        const chunks = []
        stream.on('data', (chunk) => chunks.push(chunk))
        stream.on('end', () => {
          zipfile.close()
          resolve(Buffer.concat(chunks))
        })
        stream.on('error', reject)
      })
    })

    zipfile.on('end', () => reject(new Error(`Archive entry not found: ${entryName}`)))
    zipfile.on('error', reject)
  })
}
