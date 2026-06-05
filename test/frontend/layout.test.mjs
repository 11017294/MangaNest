import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readerCss = fs.readFileSync(new URL('../../frontend/src/style.css', import.meta.url), 'utf8')
const adminCss = fs.readFileSync(new URL('../../frontend-admin/src/style.css', import.meta.url), 'utf8')
const readerView = fs.readFileSync(new URL('../../frontend/src/views/Reader.vue', import.meta.url), 'utf8')
const comicDetailView = fs.readFileSync(new URL('../../frontend/src/views/ComicDetail.vue', import.meta.url), 'utf8')
const adminApp = fs.readFileSync(new URL('../../frontend-admin/src/App.vue', import.meta.url), 'utf8')
const adminApi = fs.readFileSync(new URL('../../frontend-admin/src/services/api.js', import.meta.url), 'utf8')
const backendServer = fs.readFileSync(new URL('../../backend/server.js', import.meta.url), 'utf8')

const getRuleBody = (selector) => {
  const match = readerCss.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
  assert.ok(match, `${selector} rule should exist`)
  return match[1]
}

const getAdminRuleBody = (selector, occurrence = 'first') => {
  const matches = [...adminCss.matchAll(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g'))]
  assert.ok(matches.length, `${selector} rule should exist`)
  return occurrence === 'last' ? matches[matches.length - 1][1] : matches[0][1]
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
  assert.match(adminApp, /activeTab === 'settings'/)
  assert.match(adminApp, />设置<\/button>/)
  assert.match(adminApp, /批量删除索引/)
  assert.match(adminApp, /设置封面/)
  assert.match(adminApp, /显示图片/)
  assert.match(adminApp, /管理分类/)
  assert.match(adminApp, /新建分类/)
  assert.match(adminApp, /保存分类/)
  assert.match(adminApp, /categoryDialog/)
  assert.doesNotMatch(adminApp, /取消收藏/)
  assert.doesNotMatch(adminApp, /comic\.sourcePath/)
  assert.doesNotMatch(adminApp, /搜索漫画标题或路径/)
})

test('admin library root controls live under settings menu instead of the workspace header', () => {
  assert.match(adminApp, /<section v-if="activeTab === 'settings'" class="panel content-panel settings-panel">/)
  assert.match(adminApp, /class="library-console settings-console"/)
  assert.doesNotMatch(adminApp, /<section class="library-console">/)
  assert.match(getAdminRuleBody('.workspace'), /grid-template-rows:\s*auto auto auto minmax\(0,\s*1fr\)/)
  assert.match(getAdminRuleBody('.content-panel'), /max-height:\s*calc\(100vh - 142px\)/)
  assert.match(getAdminRuleBody('.admin-menu-bar'), /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/)
})

test('admin category management supports explicit sort ordering', () => {
  assert.match(adminApp, /上移/)
  assert.match(adminApp, /下移/)
  assert.match(adminApp, /moveCategory\(index,\s*-1\)/)
  assert.match(adminApp, /moveCategory\(index,\s*1\)/)
  assert.match(adminApp, /const moveCategory = async \(index,\s*direction\)/)
  assert.match(adminApp, /sortOrder:\s*index/)
  assert.match(getAdminRuleBody('.category-row'), /grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/)
  assert.match(adminCss, /\.sort-actions/)
})

test('admin category creation uses a dialog with duplicate-name validation and sort order', () => {
  assert.match(adminApp, /createCategoryDialog/)
  assert.match(adminApp, /openCreateCategoryDialog/)
  assert.match(adminApp, /placeholder="分类名"/)
  assert.match(adminApp, /placeholder="排序号"/)
  assert.match(adminApp, /categoryNameExists/)
  assert.match(adminApp, /分类名已存在/)
  assert.match(adminApp, /attachToCurrentComic/)
  assert.match(adminApi, /createCategory = \(name,\s*sortOrder\)/)
  assert.match(adminApi, /JSON\.stringify\(\{ name,\s*sortOrder \}\)/)
  assert.match(backendServer, /Category already exists/)
  assert.match(backendServer, /res\.status\(409\)/)
  assert.doesNotMatch(adminApp, /<form class="category-form" @submit\.prevent="addCategory">/)
})

test('admin comic category dialog saves selections explicitly then closes with feedback', () => {
  assert.match(adminApp, />保存分类<\/button>/)
  assert.match(adminApp, /await saveCategoryDialogSelection\(\)/)
  assert.match(adminApp, /closeCategoryDialog\(\)/)
  assert.match(adminApp, /message\.value = '漫画分类已更新'/)
  const toggleMatch = adminApp.match(/const toggleCategoryDialogSelection = \(categoryId,\s*checked\) => \{([\s\S]*?)\n\}/)
  assert.ok(toggleMatch, 'toggleCategoryDialogSelection function should exist')
  assert.doesNotMatch(toggleMatch[1], /saveCategoryDialogSelection/)
  assert.doesNotMatch(adminApp, /createAndAttachCategory/)
  assert.match(adminCss, /\.category-dialog-footer/)
  assert.match(adminCss, /\.create-category-dialog/)
})

test('admin layout keeps scrolling inside sidebar and workspace panels', () => {
  assert.match(getAdminRuleBody('html,\nbody,\n#app'), /height:\s*100%/)
  assert.match(getAdminRuleBody('body'), /overflow:\s*hidden/)
  assert.match(getAdminRuleBody('.admin-shell'), /height:\s*100vh/)
  assert.match(getAdminRuleBody('.sidebar'), /height:\s*100vh/)
  assert.match(getAdminRuleBody('.sidebar'), /overflow:\s*hidden/)
  assert.match(getAdminRuleBody('.folder-nav', 'last'), /overflow-y:\s*auto/)
  assert.match(getAdminRuleBody('.content-panel'), /max-height:\s*calc\(100vh - 142px\)/)
  assert.match(getAdminRuleBody('.content-panel'), /overflow-y:\s*auto/)
  assert.match(adminCss, /::-webkit-scrollbar-thumb/)
  assert.match(adminCss, /scrollbar-color:\s*var\(--accent\)/)
})
