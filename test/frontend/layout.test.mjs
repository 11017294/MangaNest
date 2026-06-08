import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readerCss = fs.readFileSync(new URL('../../frontend/src/style.css', import.meta.url), 'utf8')
const adminCss = fs.readFileSync(new URL('../../frontend-admin/src/style.css', import.meta.url), 'utf8')
const readerView = fs.readFileSync(new URL('../../frontend/src/views/Reader.vue', import.meta.url), 'utf8')
const comicDetailView = fs.readFileSync(
  new URL('../../frontend/src/views/ComicDetail.vue', import.meta.url),
  'utf8'
)
const adminApp = fs.readFileSync(new URL('../../frontend-admin/src/App.vue', import.meta.url), 'utf8')
const adminTopbar = fs.readFileSync(
  new URL('../../frontend-admin/src/components/common/AdminTopbar.vue', import.meta.url),
  'utf8'
)
const adminComicsView = fs.readFileSync(
  new URL('../../frontend-admin/src/views/AdminComics.vue', import.meta.url),
  'utf8'
)
const adminCategoriesView = fs.readFileSync(
  new URL('../../frontend-admin/src/views/AdminCategories.vue', import.meta.url),
  'utf8'
)
const createCategoryDialog = fs.readFileSync(
  new URL('../../frontend-admin/src/components/categories/CreateCategoryDialog.vue', import.meta.url),
  'utf8'
)
const categoryDialog = fs.readFileSync(
  new URL('../../frontend-admin/src/components/categories/CategoryDialog.vue', import.meta.url),
  'utf8'
)
const adminApi = fs.readFileSync(
  new URL('../../frontend-admin/src/services/modules/comics.ts', import.meta.url),
  'utf8'
)
const adminRouter = fs.readFileSync(
  new URL('../../frontend-admin/src/router/index.ts', import.meta.url),
  'utf8'
)
const backendServer = fs.readFileSync(new URL('../../backend/server.js', import.meta.url), 'utf8')

const getRuleBody = (selector) => {
  const match = readerCss.match(
    new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
  )
  assert.ok(match, `${selector} rule should exist`)
  return match[1]
}

const getAdminRuleBody = (selector, occurrence = 'first') => {
  const matches = [
    ...adminCss.matchAll(
      new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')
    )
  ]
  assert.ok(matches.length, `${selector} rule should exist`)
  return occurrence === 'last' ? matches[matches.length - 1][1] : matches[0][1]
}

test('home comic search spans the full header width on wide screens', () => {
  const miniSearchRule = getRuleBody('.mini-search')

  assert.match(miniSearchRule, /width:\s*100%/)
  assert.doesNotMatch(miniSearchRule, /min-width:\s*min\(360px,\s*46vw\)/)
})

test('reader chrome returns to comic detail without manual save or cover actions', () => {
  assert.match(readerView, /\/comic\/\$\{chapter\.comicId\}/)
  assert.doesNotMatch(readerView, /saveCurrentProgress\(\).*@click/s)
  assert.doesNotMatch(readerView, /setComicCover/)
})

test('comic detail favorite toggle preserves loaded chapters and metadata', () => {
  assert.match(comicDetailView, /const updated = await setComicFavorite/)
  assert.match(comicDetailView, /comic\.value = \{\s*\.\.\.comic\.value,\s*\.\.\.updated\s*\}/s)
  assert.doesNotMatch(comicDetailView, /comic\.value = await setComicFavorite/)
})

test('admin shell uses router navigation and topbar menu items', () => {
  assert.match(adminApp, /<RouterView v-slot="\{ Component \}">/)
  assert.match(adminApp, /@update:active-tab="openMenu"/)
  assert.match(adminApp, /router\.push\(target\.path\)/)
  assert.match(adminTopbar, /class="admin-menu-list"/)
  assert.match(adminRouter, /key: 'files'/)
  assert.match(adminRouter, /path: '\/settings'/)
  assert.doesNotMatch(adminApp, /admin-menu-bar/)
  assert.doesNotMatch(adminApp, /activeTab === 'settings'/)
})

test('admin comics view keeps index-focused category and image actions', () => {
  assert.match(adminComicsView, /removeSelectedComicIndexes/)
  assert.match(adminComicsView, /deleteComicIndex/)
  assert.match(adminComicsView, /openCategoryDialog/)
  assert.match(adminComicsView, /openComicImages\(comic,\s*'cover'\)/)
  assert.match(adminComicsView, /openComicImages\(comic,\s*'view'\)/)
  assert.match(adminComicsView, /categoryDialog/)
  assert.doesNotMatch(adminComicsView, /setComicFavorite/)
  assert.doesNotMatch(adminComicsView, /comic\.sourcePath/)
})

test('admin library root controls live under settings view instead of the workspace header', () => {
  assert.match(adminRouter, /path: '\/settings'/)
  assert.match(adminApp, /RouterView/)
  assert.doesNotMatch(adminApp, /<section class="library-console">/)
  assert.match(getAdminRuleBody('.admin-shell'), /grid-template-rows:\s*auto minmax\(0,\s*1fr\)/)
  assert.match(getAdminRuleBody('.workspace'), /height:\s*100%/)
  assert.match(getAdminRuleBody('.content-panel'), /overflow-y:\s*auto/)
  assert.match(getAdminRuleBody('.admin-menu-list'), /display:\s*flex/)
})

test('admin category management supports explicit sort ordering', () => {
  assert.match(adminCategoriesView, /moveCategory\(index,\s*-1\)/)
  assert.match(adminCategoriesView, /moveCategory\(index,\s*1\)/)
  assert.match(adminCategoriesView, /const moveCategory = async \(index,\s*direction\)/)
  assert.match(adminCategoriesView, /sortOrder:\s*index/)
  assert.match(getAdminRuleBody('.category-row'), /grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/)
  assert.match(adminCss, /\.sort-actions/)
})

test('admin category creation uses a dialog with duplicate-name validation and sort order', () => {
  assert.match(adminComicsView, /createCategoryDialog/)
  assert.match(adminComicsView, /openCreateCategoryDialog/)
  assert.match(createCategoryDialog, /placeholder="分类名"/)
  assert.match(createCategoryDialog, /placeholder="排序号"/)
  assert.match(adminComicsView, /categoryNameExists/)
  assert.match(adminComicsView, /attachToCurrentComic/)
  assert.match(adminApi, /createCategory = \(name:\s*string,\s*sortOrder\?:\s*number\)/)
  assert.match(adminApi, /JSON\.stringify\(\{ name,\s*sortOrder \}\)/)
  assert.match(backendServer, /Category already exists/)
  assert.match(backendServer, /res\.status\(409\)/)
  assert.doesNotMatch(adminCategoriesView, /<form class="category-form" @submit\.prevent="addCategory">/)
})

test('admin comic category dialog saves selections explicitly then closes with feedback', () => {
  assert.match(categoryDialog, /@click="\$emit\('save'\)"/)
  assert.match(adminComicsView, /await saveCategoryDialogSelection\(\)/)
  assert.match(adminComicsView, /closeCategoryDialog\(\)/)
  assert.match(adminComicsView, /notifySuccess\(/)
  const toggleMatch = adminComicsView.match(
    /const toggleCategoryDialogSelection = \(categoryId,\s*checked\) => \{([\s\S]*?)\n\}/
  )
  assert.ok(toggleMatch, 'toggleCategoryDialogSelection function should exist')
  assert.doesNotMatch(toggleMatch[1], /saveCategoryDialogSelection/)
  assert.doesNotMatch(adminComicsView, /createAndAttachCategory/)
  assert.match(adminCss, /\.category-dialog-footer/)
  assert.match(adminCss, /\.create-category-dialog/)
})

test('admin layout keeps scrolling inside sidebar and workspace panels', () => {
  assert.match(adminCss, /html,\s*body,\s*#app\s*\{[^}]*height:\s*100%/s)
  assert.match(getAdminRuleBody('body'), /overflow:\s*hidden/)
  assert.match(getAdminRuleBody('.admin-shell'), /height:\s*100vh/)
  assert.match(getAdminRuleBody('.sidebar'), /height:\s*100%/)
  assert.match(getAdminRuleBody('.sidebar'), /overflow:\s*hidden/)
  assert.match(getAdminRuleBody('.folder-nav', 'last'), /overflow-y:\s*auto/)
  assert.match(getAdminRuleBody('.workspace'), /overflow:\s*hidden/)
  assert.match(getAdminRuleBody('.content-panel'), /overflow-y:\s*auto/)
  assert.match(adminCss, /::-webkit-scrollbar-thumb/)
  assert.match(adminCss, /scrollbar-color:\s*var\(--accent\)/)
})
