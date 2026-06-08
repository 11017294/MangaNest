import type { AppSettings } from '@shared/types/api'
import { request } from '../request'

export const fetchSettings = () => request<AppSettings>('/settings')

export const updateSetting = (key: string, value: unknown) =>
  request<AppSettings>('/settings', {
    method: 'POST',
    body: JSON.stringify({ key, value })
  })
