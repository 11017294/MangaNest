import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readerCss = fs.readFileSync(new URL('../../frontend/src/style.css', import.meta.url), 'utf8')
const readerView = fs.readFileSync(new URL('../../frontend/src/views/Reader.vue', import.meta.url), 'utf8')
const comicDetailView = fs.readFileSync(new URL('../../frontend/src/views/ComicDetail.vue', import.meta.url), 'utf8')
const adminApp = fs.readFileSync(new URL('../../frontend-admin/src/App.vue', import.meta.url), 'utf8')

const getRuleBody = (selector) => {
  const match = readerCss.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
  assert.ok(match, `${selector} rule should exist`)
  return match[1]
}

test('home comic search spans the full header width on wide screens', () => {
  const miniSearchRule = getRuleBody('.mini-search')

  assert.match(miniSearchRule, /width:\s*100%/)
  assert.doesNotMatch(miniSearchRule, /min-width:\s*min\(360px,\s*46vw\)/)
})

test('reader chrome returns to comic detail without manual save or cover actions', () => {
  assert.match(readerView, /返回漫画/)
  assert.match(readerView, /\/comic\/\$\{chapter\.comicId\}/)
  assert.doesNotMatch(readerView, /保存进度/)
  assert.doesNotMatch(readerView, /设封面/)
})

test('comic detail favorite toggle preserves loaded chapters and metadata', () => {
  assert.match(comicDetailView, /const updated = await setComicFavorite/)
  assert.match(comicDetailView, /comic\.value = \{\s*\.\.\.comic\.value,\s*\.\.\.updated\s*\}/s)
  assert.doesNotMatch(comicDetailView, /comic\.value = await setComicFavorite/)
})

test('admin comics tab uses menu navigation and index-focused bulk actions', () => {
  assert.match(adminApp, /class="admin-menu-bar"/)
  assert.match(adminApp, /批量删除索引/)
  assert.match(adminApp, /设置封面/)
  assert.match(adminApp, /显示图片/)
  assert.doesNotMatch(adminApp, /取消收藏/)
  assert.doesNotMatch(adminApp, /comic\.sourcePath/)
  assert.doesNotMatch(adminApp, /搜索漫画标题或路径/)
})
