import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'

export const setupCapacitor = (router) => {
  if (!Capacitor.isNativePlatform()) return

  StatusBar.setStyle({ style: Style.Light }).catch(() => {})
  StatusBar.setBackgroundColor({ color: '#fff7fb' }).catch(() => {})

  App.addListener('backButton', ({ canGoBack }) => {
    const route = router.currentRoute.value
    if (route.path.startsWith('/reader/')) {
      router.back()
      return
    }
    if (canGoBack && route.path !== '/') {
      router.back()
      return
    }
    App.exitApp()
  })
}

export const setReaderChrome = (active) => {
  if (!Capacitor.isNativePlatform()) return
  if (active) {
    StatusBar.hide().catch(() => {})
  } else {
    StatusBar.show().catch(() => {})
    StatusBar.setStyle({ style: Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#fff7fb' }).catch(() => {})
  }
}
