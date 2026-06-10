import type {
  AppSettings,
  IndexCleanupResponse,
  IndexInspectResponse,
  LibraryScanResponse
} from '@shared/types/api'
import { request } from '../request'

export const fetchSettings = () => request<AppSettings>('/settings')

export const updateSetting = (key: string, value: unknown) =>
  request<AppSettings>('/settings', {
    method: 'POST',
    body: JSON.stringify({ key, value })
  })

export const scanLibrary = (libraryPath?: string) =>
  request<LibraryScanResponse>('/library/scan', {
    method: 'POST',
    body: JSON.stringify(libraryPath ? { libraryPath } : {})
  })

export const inspectLibraryIndex = (libraryPath?: string) => {
  const query = libraryPath ? `?libraryPath=${encodeURIComponent(libraryPath)}` : ''
  return request<IndexInspectResponse>(`/library/index/inspect${query}`)
}

export const cleanupLibraryIndex = (libraryPath?: string) =>
  request<IndexCleanupResponse>('/library/index/cleanup', {
    method: 'POST',
    body: JSON.stringify(libraryPath ? { libraryPath } : {})
  })
