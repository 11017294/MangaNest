import type {
  AdminSearchResponse,
  FolderResponse,
  MessageResponse,
  MovePathResponse
} from '@shared/types/api'
import { request } from '../request'

export const fetchFolder = (dir = '', options: { hideMarked?: boolean } = {}) => {
  const params = new URLSearchParams({ dir })
  if (options.hideMarked) params.set('hideMarked', 'true')
  return request<FolderResponse>(`/admin/folders?${params.toString()}`)
}

export const searchAdminFiles = (query: string, limit = 60) => {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  return request<AdminSearchResponse>(`/admin/files/search?${params.toString()}`)
}

export const createFolder = (parentPath: string, name: string) =>
  request<MessageResponse>('/admin/folders', {
    method: 'POST',
    body: JSON.stringify({ parentPath, name })
  })

export const renameFile = (path: string, newName: string) =>
  request<MovePathResponse>('/admin/files/rename', {
    method: 'POST',
    body: JSON.stringify({ path, newName })
  })

export const replaceFolderPrefixes = (dir: string, oldPrefix: string, newPrefix: string) =>
  request<MessageResponse>('/admin/folders/prefix-replace', {
    method: 'POST',
    body: JSON.stringify({ dir, oldPrefix, newPrefix })
  })

export const moveFile = (path: string, targetParentPath: string) =>
  request<MovePathResponse>('/admin/files/move', {
    method: 'POST',
    body: JSON.stringify({ path, targetParentPath })
  })

export const moveFolder = (path: string, targetParentPath: string) =>
  request<MovePathResponse>('/admin/folders/move', {
    method: 'POST',
    body: JSON.stringify({ path, targetParentPath })
  })

export const deleteFile = (path: string) =>
  request<MessageResponse>(`/admin/files?path=${encodeURIComponent(path)}`, {
    method: 'DELETE'
  })

export const revealFile = (path: string) =>
  request<MessageResponse>('/admin/files/reveal', {
    method: 'POST',
    body: JSON.stringify({ path })
  })

export const setFolderCover = (folderPath: string, imagePath: string) =>
  request<MessageResponse>('/admin/folders/cover', {
    method: 'POST',
    body: JSON.stringify({ folderPath, imagePath })
  })

export const setFolderMarked = (folderPath: string, marked: boolean) =>
  request<MessageResponse>('/admin/folders/mark', {
    method: 'POST',
    body: JSON.stringify({ folderPath, marked })
  })
