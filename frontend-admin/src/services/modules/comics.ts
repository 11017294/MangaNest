import type { Category, ComicDetail, ComicSummary, PageSummary } from '@shared/types/api'
import { request } from '../request'

export const fetchComics = () => request<ComicSummary[]>('/library/comics')
export const fetchComic = (id: number | string) => request<ComicDetail>(`/library/comics/${id}`)
export const fetchChapterPages = (id: number | string) => request<PageSummary[]>(`/chapters/${id}/pages`)

export const setComicFavorite = (comicId: number | string, favorite: boolean) =>
  request<ComicSummary>(`/comics/${comicId}/favorite`, {
    method: 'PUT',
    body: JSON.stringify({ favorite })
  })

export const setComicCover = (comicId: number | string, coverPath: string) =>
  request<ComicSummary>(`/comics/${comicId}/cover`, {
    method: 'PUT',
    body: JSON.stringify({ coverPath })
  })

export const setComicCategories = (comicId: number | string, categoryIds: Array<number | string>) =>
  request<ComicSummary>(`/comics/${comicId}/categories`, {
    method: 'PUT',
    body: JSON.stringify({ categoryIds })
  })

export const deleteComicIndex = (comicId: number | string) =>
  request<{ message?: string }>(`/comics/${comicId}`, { method: 'DELETE' })

export const fetchCategories = () => request<Category[]>('/categories')

export const createCategory = (name: string, sortOrder?: number) =>
  request<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, sortOrder })
  })

export const updateCategory = (id: number | string, payload: Partial<Category>) =>
  request<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })

export const deleteCategory = (id: number | string) =>
  request<{ message?: string }>(`/categories/${id}`, { method: 'DELETE' })
