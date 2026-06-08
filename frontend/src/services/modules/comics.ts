import type {
  Category,
  ChapterSummary,
  ComicDetail,
  ComicSummary,
  PageSummary
} from '@shared/types/api'
import { request } from '../request'

export const fetchComics = () => request<ComicSummary[]>('/library/comics')
export const fetchComic = (id: number | string) => request<ComicDetail>(`/library/comics/${id}`)
export const fetchChapter = (id: number | string) => request<ChapterSummary>(`/chapters/${id}`)
export const fetchChapterPages = (id: number | string) => request<PageSummary[]>(`/chapters/${id}/pages`)
export const fetchRecent = () => request<ComicSummary[]>('/recent')
export const fetchRanking = () => request<ComicSummary[]>('/ranking')
export const fetchCategories = () => request<Category[]>('/categories')

export const scanLibrary = (libraryPath?: string) =>
  request<{ message?: string }>('/library/scan', {
    method: 'POST',
    body: JSON.stringify(libraryPath ? { libraryPath } : {})
  })

export const createCategory = (name: string) =>
  request<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name })
  })

export const setComicFavorite = (comicId: number | string, favorite: boolean) =>
  request<ComicSummary>(`/comics/${comicId}/favorite`, {
    method: 'PUT',
    body: JSON.stringify({ favorite })
  })

export const setComicCategories = (comicId: number | string, categoryIds: Array<number | string>) =>
  request<ComicSummary>(`/comics/${comicId}/categories`, {
    method: 'PUT',
    body: JSON.stringify({ categoryIds })
  })

export const setComicCover = (comicId: number | string, coverPath: string) =>
  request<ComicSummary>(`/comics/${comicId}/cover`, {
    method: 'PUT',
    body: JSON.stringify({ coverPath })
  })

export const deleteComicIndex = (comicId: number | string) =>
  request<{ message?: string }>(`/comics/${comicId}`, {
    method: 'DELETE'
  })
