import type { ReadingProgress } from '@shared/types/api'
import { request } from '../request'

export const saveProgress = (payload: Partial<ReadingProgress>) =>
  request<ReadingProgress>('/progress', {
    method: 'PUT',
    body: JSON.stringify(payload)
  })

export const recordReadingEvent = (payload: Partial<ReadingProgress>) =>
  request<{ message?: string }>('/reading-events', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
