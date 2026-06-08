export type Id = number

export interface Category {
  id: Id
  name: string
  sortOrder?: number
}

export interface ReadingProgress {
  comicId: Id
  chapterId: Id
  pageIndex: number
  scrollOffset?: number
}

export interface ComicSummary {
  id: Id
  title: string
  path?: string
  coverPath?: string | null
  description?: string | null
  favorite?: boolean
  categories?: Category[]
  progress?: ReadingProgress | null
  chapterCount?: number
  pageCount?: number
}

export interface ChapterSummary {
  id: Id
  comicId: Id
  title: string
  path?: string
  pageCount?: number
  previousChapter?: Pick<ChapterSummary, 'id' | 'title'> | null
  nextChapter?: Pick<ChapterSummary, 'id' | 'title'> | null
  comic?: ComicSummary
}

export interface ComicDetail extends ComicSummary {
  chapters?: ChapterSummary[]
}

export interface PageSummary {
  id: Id
  chapterId?: Id
  name: string
  filePath: string
  width?: number
  height?: number
}

export interface AppSettings {
  libraryPath?: string
  theme?: string
  readerConcurrentLoads?: number
  readerPreloadPages?: number
  [key: string]: unknown
}

export interface FolderItem {
  type: 'folder'
  name: string
  path: string
  relativePath?: string
  coverImage?: string | null
  marked?: boolean
}

export interface ImageItem {
  type: 'image'
  name: string
  path: string
  relativePath?: string
  coverImage?: string | null
}

export interface FolderResponse {
  libraryPath: string
  currentPath: string
  parentPath?: string
  folders: FolderItem[]
  images: ImageItem[]
}

export interface AdminSearchResult {
  type: 'folder'
  name: string
  path: string
  parentPath: string
}

export interface AdminSearchResponse {
  libraryPath: string
  results: AdminSearchResult[]
}

export interface MovePathResponse {
  path: string
  oldPath?: string
  newPath?: string
}

export interface MessageResponse {
  message?: string
}
