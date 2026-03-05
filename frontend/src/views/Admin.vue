
<template>
  <div class="admin-container" :class="currentTheme" @click="closeContextMenu">
    <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <div class="sidebar-header">
        <h2>菜单管理</h2>
        <div class="actions">
          <button @click="scanMenus" title="重新生成">🔄</button>
          <button @click="addRootMenu" title="新增根菜单">➕</button>
        </div>
      </div>
      <div class="menu-tree-container">
         <AdminMenuTree 
            :list="menus" 
            :current-id="currentMenuId"
            :parent-id="null"
            :expanded-state="menuExpandedState"
            @select="selectMenu"
            @edit="editMenu"
            @delete="deleteMenu"
            @change="onRootChange"
         />
      </div>

      <!-- Settings Button Area -->
      <div class="sidebar-footer">
          <button class="settings-btn" @click="showSettingsModal = true" title="设置">
              ⚙️ 设置
          </button>
      </div>
    </div>
    
    <!-- Resize Handle -->
    <div class="resize-handle" @mousedown="startResize"></div>

    <div class="main-content">
      <div class="content-header">
        <div class="path-nav">
             <!-- Breadcrumbs logic to be added here later if requested, for now just text as per previous state, or improved? 
                  User asked for breadcrumb fix in previous turn but then gave new instructions. 
                  I will fix breadcrumbs too since it was requested. -->
             <div class="breadcrumbs">
                 <span v-for="(crumb, index) in breadcrumbs" :key="index" class="crumb">
                     <span 
                        class="crumb-link" 
                        @click="navigateTo(crumb.path)" 
                        :class="{ active: index === breadcrumbs.length - 1 }"
                     >
                         {{ crumb.name }}
                     </span>
                     <span v-if="index < breadcrumbs.length - 1" class="separator">/</span>
                 </span>
             </div>
        </div>
        <div class="content-actions">
            <label class="toggle-label">
                <input type="checkbox" v-model="showImages"> 显示图片
            </label>
            <label class="toggle-label" style="margin-left: 10px;">
                <input type="checkbox" v-model="showImageNames"> 显示文件名
            </label>
        </div>
      </div>

      <draggable 
        v-if="isPathDefined"
        v-model="folderContent.folders" 
        :group="{ name: 'folder', pull: 'clone', put: false }"
        item-key="path"
        class="folder-grid"
        ghost-class="ghost-folder"
        :filter="'.no-drag'"
        :preventOnFilter="false"
        @contextmenu.prevent
      >
        <template #item="{ element: folder }">
            <div class="folder-tile" @contextmenu.prevent.stop="showContextMenu($event, folder, 'folder')">
                <div 
                    class="folder-item"
                    @click="!isEditing('folder', folder.path) && navigateTo(folder.path)"
                    :title="folder.name"
                >
                    <div class="folder-content-wrapper">
                        <div v-if="folder.coverImage" class="folder-cover-wrapper">
                            <img :src="getImageUrl(folder.coverImage)" loading="lazy" class="folder-cover-img" />
                        </div>
                        <div v-else class="folder-icon-large">📁</div>
                        <div class="folder-type-badge">DIR</div>
                    </div>
                </div>
                <div 
                    v-if="!isEditing('folder', folder.path) && showImageNames" 
                    class="folder-title" 
                    :title="folder.name"
                >
                    {{ folder.name }}
                </div>
                <input
                    v-else-if="isEditing('folder', folder.path)"
                    class="rename-input title-input no-drag"
                    v-model="renameEdit.name"
                    @keyup.enter="confirmInlineRename"
                    @blur="confirmInlineRename"
                    @mousedown.stop
                    @touchstart.stop
                />
            </div>
        </template>
        <template #footer>
            <template v-if="showImages">
                <div 
                    v-for="(img, idx) in folderContent.images" 
                    :key="img.path" 
                    class="image-tile"
                    @contextmenu.prevent.stop="showContextMenu($event, img, 'image')"
                    :title="img.name"
                >
                    <div class="image-item" @dblclick="openPreview(idx)">
                        <div class="image-wrapper">
                            <img :src="getImageUrl(img.relativePath)" loading="lazy" />
                        </div>
                    </div>
                    <div 
                        class="image-title" 
                        v-if="!isEditing('image', img.relativePath) && showImageNames"
                    >
                        {{ img.name }}
                    </div>
                    <input
                        v-else-if="isEditing('image', img.relativePath)"
                    class="rename-input title-input no-drag"
                        v-model="renameEdit.name"
                        @keyup.enter="confirmInlineRename"
                        @blur="confirmInlineRename"
                    @mousedown.stop
                    @touchstart.stop
                    />
                </div>
            </template>
            <!-- Pagination Controls -->
             <div v-if="totalImages > 0 && showImages" class="pagination-container">
                 <button class="page-btn" @click="prevPage" :disabled="currentPage <= 1">上一页</button>
                 <span class="page-info">{{ currentPage }} / {{ totalPages }} (共 {{ totalImages }} 张)</span>
                 <button class="page-btn" @click="nextPage" :disabled="currentPage >= totalPages">下一页</button>
             </div>
        </template>
      </draggable>
      
      <div v-else class="empty-state">
          <div class="empty-content">
              <span class="empty-icon">👈</span>
              <p>请选择左侧菜单或文件夹</p>
          </div>
      </div>
    </div>

    <!-- Context Menu -->
    <div 
        v-if="contextMenu.visible" 
        class="context-menu" 
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
        <div class="context-menu-item" v-if="['folder', 'image'].includes(contextMenu.type)" @click="handleContextAction('rename')">重命名</div>
        <div class="context-menu-item" v-if="['folder', 'image'].includes(contextMenu.type)" @click="handleContextAction('delete')">删除</div>
        <div 
            class="context-menu-item" 
            v-if="contextMenu.type === 'image'" 
            @click="handleContextAction('cover')"
        >
            设置为封面
        </div>
        <div 
            class="context-menu-item" 
            v-if="contextMenu.type === 'background'" 
            @click="handleContextAction('batch-prefix')"
        >
            批量增加前缀
        </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay">
        <div class="modal">
            <div class="modal-header">
                <h3>确认删除?</h3>
            </div>
            <div class="modal-body">
                <p class="target-path" :title="deleteTarget?.path || deleteTarget?.relativePath">{{ deleteTarget?.name }}</p>
                
                <div v-if="deleteStats" class="stats-box">
                    <p>包含内容:</p>
                    <ul class="stats-list">
                        <li>文件总数: <strong>{{ deleteStats.fileCount }}</strong></li>
                        <li v-if="deleteStats.children && deleteStats.children.length">子文件夹: {{ deleteStats.children.length }}</li>
                    </ul>
                </div>
                <div v-else-if="deleteTarget?.type === 'folder'" class="loading-stats">正在统计...</div>
                <div v-else>确定要删除此文件吗？</div>
            </div>

            <div class="modal-actions">
                <button @click="cancelDelete" class="btn-cancel">取消</button>
                <button 
                    @click="confirmDelete" 
                    :disabled="deleteButtonDisabled"
                    class="btn-danger"
                >
                    {{ deleteButtonDisabled ? `确认 (${deleteTimer}s)` : '确认删除' }}
                </button>
            </div>
        </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettingsModal" class="modal-overlay" @click.self="showSettingsModal = false">
        <div class="modal settings-modal">
            <div class="modal-header">
                <h3>设置</h3>
                <button class="close-btn" @click="showSettingsModal = false">×</button>
            </div>
            <div class="modal-body">
                <div class="setting-item">
                    <label>主题颜色</label>
                    <div class="theme-options">
                        <button 
                            :class="{ active: currentTheme === 'dark-theme' }" 
                            @click="setTheme('dark-theme')"
                        >深色 (Dark)</button>
                        <button 
                            :class="{ active: currentTheme === 'light-theme' }" 
                            @click="setTheme('light-theme')"
                        >浅色 (Light)</button>
                    </div>
                </div>
                <div class="setting-item">
                    <label>文件夹默认显示图片</label>
                    <div class="toggle-switch">
                        <input 
                            type="checkbox" 
                            id="setting-show-images" 
                            v-model="settings.showImagesInFolder" 
                            @change="updateSettings('showImagesInFolder', settings.showImagesInFolder)"
                        >
                        <label for="setting-show-images"></label>
                    </div>
                    <p class="setting-desc">默认进入文件夹时是否显示图片。</p>
                </div>
                <div class="setting-item">
                    <label>文件夹默认显示文件名</label>
                    <div class="toggle-switch">
                        <input 
                            type="checkbox" 
                            id="setting-show-image-names" 
                            v-model="settings.showImageNamesInFolder" 
                            @change="updateSettings('showImageNamesInFolder', settings.showImageNamesInFolder)"
                        >
                        <label for="setting-show-image-names"></label>
                    </div>
                    <p class="setting-desc">默认进入文件夹时是否显示文件名。</p>
                </div>
                <div class="setting-item">
                    <label>每页图片数量</label>
                    <input 
                        type="number" 
                        v-model.number="pageSize" 
                        @change="updateSettings('pageSize', pageSize)"
                        min="10"
                        class="input-number"
                    >
                </div>
            </div>
        </div>
    </div>

    <!-- Preview Modal -->
    <div v-if="showPreview" class="preview-overlay" @click.self="closePreview">
        <div class="preview-vertical">
            <div class="preview-header">
                <span class="preview-count">{{ previewStartIndex + 1 }} - {{ Math.min(previewStartIndex + previewWindowSize, totalImages) }} / {{ totalImages }}</span>
                <button class="close-btn" @click="closePreview">×</button>
            </div>
            <div class="preview-scroll" ref="previewScrollRef" @scroll="onPreviewScroll">
                <div v-for="(img, i) in previewImages" :key="img?.relativePath || i" class="preview-list-item" :ref="el => setPreviewItemRef(el, i)">
                    <img v-if="img" :src="getImageUrl(img.relativePath)" class="preview-list-img" />
                </div>
            </div>
        </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, onUnmounted, nextTick } from 'vue'
import draggable from 'vuedraggable'
import AdminMenuTree from '../components/AdminMenuTree.vue'
import axios from 'axios'
import message from '../plugins/message'

// State
const menus = ref([])
const currentMenuId = ref(null)
const currentPath = ref('')
const folderContent = ref({ folders: [], images: [], metadata: {} })
const showImages = ref(false) 
const showImageNames = ref(false)
const settings = ref({})
const sidebarWidth = ref(300) 
const currentTheme = ref('dark-theme')
const isPathDefined = computed(() => currentPath.value !== undefined && currentPath.value !== null)

// Pagination
const pageSize = ref(50)
const currentPage = ref(1)
const totalImages = ref(0)
const totalPages = computed(() => Math.ceil(totalImages.value / pageSize.value))

// Preview
const showPreview = ref(false)
const loadedPages = ref(new Set())
const pageImages = ref({})
const previewWindowSize = ref(5)
const previewStartIndex = ref(0)
const previewImages = ref([])
const previewScrollRef = ref(null)
const previewItemRefs = ref([])
const setPreviewItemRef = (el, i) => {
    if (!el) return
    previewItemRefs.value[i] = el
}

// Context Menu
const contextMenu = ref({ visible: false, x: 0, y: 0, target: null, type: null })

// Inline Rename
const renameEdit = ref({ active: false, type: '', key: '', name: '' })
const isEditing = (type, key) => renameEdit.value.active && renameEdit.value.type === type && renameEdit.value.key === key
const startInlineRename = (target, type) => {
    const key = type === 'folder' ? target.path : target.relativePath
    renameEdit.value = { active: true, type, key, name: target.name }
}
const clearInlineRename = () => {
    renameEdit.value = { active: false, type: '', key: '', name: '' }
}
const confirmInlineRename = async () => {
    if (!renameEdit.value.active) return
    const { type, key, name } = renameEdit.value
    if (!name || !name.trim()) {
        message.warning('名称不能为空')
        clearInlineRename()
        return
    }
    try {
        const isFolder = type === 'folder'
        let prevCover = null
        if (isFolder) {
            const targetFolder = folderContent.value.folders.find(f => f.path === key)
            prevCover = targetFolder?.coverImage || null
        }
        const res = await axios.post(`${API_BASE}/file/rename`, {
            oldPath: key,
            newName: name.trim()
        })
        if (res.data.success) {
            message.success('重命名成功')
            if (isFolder && prevCover) {
                const parent = key.split('/').slice(0, -1).join('/')
                const newPath = parent ? `${parent}/${name.trim()}` : name.trim()
                const newCoverPath = prevCover.replace(key, newPath)
                try {
                    await axios.post(`${API_BASE}/folder/cover`, {
                        dir: newPath,
                        imagePath: newCoverPath
                    })
                } catch (e) {}
            }
            refreshContent()
            if (isFolder) fetchMenus()
        }
    } catch (e) {
        message.error(e.response?.data?.error || '重命名失败')
    } finally {
        clearInlineRename()
    }
}

// Modals
const showDeleteModal = ref(false)
const showSettingsModal = ref(false)

// Delete logic
const deleteTarget = ref(null)
const deleteStats = ref(null)
const deleteButtonDisabled = ref(true)
const deleteTimer = ref(2)
let timerInterval = null

const API_BASE = 'http://localhost:3001/api'

const getImageUrl = (path) => `${API_BASE}/image/${encodeURIComponent(path)}`

const pageOf = (index) => Math.floor(index / pageSize.value) + 1
const posInPage = (index) => index % pageSize.value

const ensurePageLoaded = async (page) => {
    if (loadedPages.value.has(page)) return
    try {
        const res = await axios.get(`${API_BASE}/folder-content`, {
            params: {
                dir: currentPath.value,
                page,
                limit: pageSize.value
            }
        })
        pageImages.value[page] = res.data.images.map(i => ({ ...i, type: 'image' }))
        totalImages.value = res.data.totalImages
        loadedPages.value.add(page)
    } catch (e) { console.error(e) }
}

const getImageByAbsoluteIndex = async (index) => {
    const p = pageOf(index)
    const pos = posInPage(index)
    if (p === currentPage.value) {
        if (!folderContent.value.images[pos]) await ensurePageLoaded(p)
        return folderContent.value.images[pos]
    }
    await ensurePageLoaded(p)
    return pageImages.value[p]?.[pos]
}

const fillPreviewWindow = async (start) => {
    const size = previewWindowSize.value
    const imgs = await Promise.all(
        Array.from({ length: size }, (_, i) => getImageByAbsoluteIndex(start + i))
    )
    previewStartIndex.value = start
    previewImages.value = imgs
}

const openPreview = async (localIndex) => {
    const absIndex = (currentPage.value - 1) * pageSize.value + localIndex
    const start = Math.max(0, absIndex - Math.floor(previewWindowSize.value / 2))
    await fillPreviewWindow(start)
    showPreview.value = true
    const offset = absIndex - start
    await nextTick()
    const targetEl = previewItemRefs.value[offset]
    if (targetEl) targetEl.scrollIntoView({ behavior: 'auto', block: 'center' })
}

const shiftWindowDown = async () => {
    const start = previewStartIndex.value
    if (start + previewWindowSize.value >= totalImages.value) return
    const nextImg = await getImageByAbsoluteIndex(start + previewWindowSize.value)
    previewImages.value = [...previewImages.value.slice(1), nextImg]
    previewStartIndex.value = start + 1
}

const shiftWindowUp = async () => {
    const start = previewStartIndex.value
    if (start <= 0) return
    const prevImg = await getImageByAbsoluteIndex(start - 1)
    previewImages.value = [prevImg, ...previewImages.value.slice(0, previewWindowSize.value - 1)]
    previewStartIndex.value = start - 1
}

const onPreviewScroll = (e) => {
    const el = e.target
    const threshold = 100
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
        shiftWindowDown()
    } else if (el.scrollTop <= threshold) {
        shiftWindowUp()
    }
}

const closePreview = () => {
    showPreview.value = false
    previewItemRefs.value = []
}

// --- Breadcrumbs ---
const breadcrumbs = computed(() => {
    if (!currentPath.value) return []
    const parts = currentPath.value.split('/')
    const crumbs = []
    let pathAcc = ''
    // Add Root if needed, but path usually relative to root
    crumbs.push({ name: 'Root', path: '' })
    
    parts.forEach(part => {
        if(!part) return
        pathAcc = pathAcc ? `${pathAcc}/${part}` : part
        crumbs.push({ name: part, path: pathAcc })
    })
    return crumbs
})

// --- Resize Logic ---
const startResize = (e) => {
    e.preventDefault()
    window.addEventListener('mousemove', onResize)
    window.addEventListener('mouseup', stopResize)
}

const onResize = (e) => {
    const newWidth = e.clientX
    if (newWidth > 200 && newWidth < 600) {
        sidebarWidth.value = newWidth
    }
}

const stopResize = () => {
    window.removeEventListener('mousemove', onResize)
    window.removeEventListener('mouseup', stopResize)
}

// --- Context Menu ---
const showContextMenu = (e, target, type) => {
    // If clicking on background (target is null/undefined), type will be 'background'
    contextMenu.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        target,
        type: type || 'background'
    }
}

const closeContextMenu = () => {
    contextMenu.value.visible = false
}

const handleContextAction = (action) => {
    const { target, type } = contextMenu.value
    closeContextMenu()
    
    if (action === 'rename') startInlineRename(target, type)
    if (action === 'delete') promptDelete(target, type)
    if (action === 'cover') setCover(target)
    if (action === 'batch-prefix') promptBatchPrefix()
}

const promptBatchPrefix = async () => {
    const prefix = prompt('请输入文件名前缀:')
    if (!prefix) return
    
    try {
        const res = await axios.post(`${API_BASE}/folder/batch-prefix`, {
            dir: currentPath.value,
            prefix
        })
        if (res.data.success) {
            message.success(`成功重命名 ${res.data.count} 个文件`)
            refreshContent()
        }
    } catch (e) {
        message.error(e.response?.data?.error || '批量重命名失败')
    }
}

// --- Menus ---

const fetchMenus = async () => {
    try {
        const res = await axios.get(`${API_BASE}/menus`)
        menus.value = res.data
    } catch (e) { console.error(e) }
}

const findMenuById = (id, list = menus.value) => {
    for (const item of list) {
        if (item.id === id) return item
        if (item.children) {
            const found = findMenuById(id, item.children)
            if (found) return found
        }
    }
    return null
}

const scanMenus = async () => {
    if(!confirm('确定要重新扫描目录生成菜单吗？这将覆盖现有菜单结构。')) return
    try {
        await axios.post(`${API_BASE}/menus/scan`)
        await fetchMenus()
    } catch (e) { message.error('扫描失败') }
}

const selectMenu = (menu) => {
    currentMenuId.value = menu.id
    currentPath.value = menu.path
}

const handleMenuChange = async (evt, parentId) => {
    if (evt.added && evt.added.element.type === 'folder') {
        const folder = evt.added.element
        let targetPath = ''
        if (parentId) {
            const targetMenu = findMenuById(parentId)
            if (targetMenu) targetPath = targetMenu.path
        } else {
            targetPath = ''
        }
        
        if (confirm(`确定移动文件夹 "${folder.name}" 到 "${targetPath || '根目录'}" 吗?`)) {
            try {
                await axios.post(`${API_BASE}/folder/move`, {
                    oldPath: folder.path,
                    newParentPath: targetPath
                })
            } catch (e) {
                message.error(e.response?.data?.error || '移动失败')
            }
        }
        await fetchMenus()
        await refreshContent()
        return
    }

    if (evt.added) {
        const item = evt.added.element
        const newIndex = evt.added.newIndex
        await updateMenu(item.id, { parentId: parentId, order: newIndex })
    }
    else if (evt.moved) {
        const item = evt.moved.element
        const newIndex = evt.moved.newIndex
        await updateMenu(item.id, { order: newIndex })
    }
}

const onRootChange = (evt) => handleMenuChange(evt, null)

const updateMenu = async (id, data) => {
    try {
        await axios.put(`${API_BASE}/menus/${id}`, data)
    } catch (e) { console.error(e) }
}

const deleteMenu = async (menu) => {
    if(!confirm(`确定删除菜单 "${menu.name}" 吗?`)) return
    try {
        await axios.delete(`${API_BASE}/menus/${menu.id}`)
        await fetchMenus()
    } catch (e) { message.error('删除失败') }
}

const addRootMenu = async () => {
    const name = prompt('输入菜单名称')
    if(!name) return
    try {
        await axios.post(`${API_BASE}/menus`, { name, path: '' })
        await fetchMenus()
    } catch (e) { message.error('创建失败') }
}

const editMenu = async (menu) => {
    const name = prompt('新名称', menu.name)
    if(name && name !== menu.name) {
        await updateMenu(menu.id, { name })
        menu.name = name
    }
}

// --- Folder Content ---

const fetchFolderContent = async (path, append = false) => {
    if(path === undefined || path === null) return
    try {
        const res = await axios.get(`${API_BASE}/folder-content`, { 
            params: { 
                dir: path,
                page: currentPage.value,
                limit: pageSize.value
            } 
        })
        
        const newFolders = res.data.folders.map(f => ({ ...f, type: 'folder' }))
        const newImages = res.data.images.map(i => ({ ...i, type: 'image' }))
        
        if (append) {
            folderContent.value.images = [...folderContent.value.images, ...newImages]
        } else {
            folderContent.value = {
                folders: newFolders,
                images: newImages,
                metadata: res.data.metadata
            }
        }
        totalImages.value = res.data.totalImages
        
    } catch (e) { console.error(e) }
}

const nextPage = () => {
    if (currentPage.value < totalPages.value) {
        currentPage.value++
        fetchFolderContent(currentPath.value)
    }
}

const prevPage = () => {
    if (currentPage.value > 1) {
        currentPage.value--
        fetchFolderContent(currentPath.value)
    }
}

const loadMoreImages = () => {
    currentPage.value++
    fetchFolderContent(currentPath.value, true)
}

const refreshContent = () => {
    currentPage.value = 1
    fetchFolderContent(currentPath.value)
}

const menuExpandedState = ref({})

// Helper to find menu and expand parents
const syncMenuExpansion = (path) => {
    if (!path) {
        currentMenuId.value = null
        return
    }
    
    // Normalize path just in case
    const targetPath = path.replace(/\\/g, '/')
    
    // DFS to find node and keep track of parents
    const findNode = (nodes, tPath, parents = []) => {
        for (const node of nodes) {
            if (node.path === tPath) {
                return { node, parents }
            }
            if (node.children && node.children.length) {
                const result = findNode(node.children, tPath, [...parents, node])
                if (result) return result
            }
        }
        return null
    }

    const result = findNode(menus.value, targetPath)
    if (result) {
        const { node, parents } = result
        currentMenuId.value = node.id
        
        // Expand all parents
        parents.forEach(p => {
            menuExpandedState.value[p.id] = true
        })
    } else {
        // If path not found in menu (e.g. root or unmapped folder), clear selection
        currentMenuId.value = null
    }
}

const navigateTo = (path) => {
    currentPath.value = path
}

watch(currentPath, (newPath) => {
    // Reset state on nav
    currentPage.value = 1
    fetchFolderContent(newPath)
    
    // Sync menu tree
    syncMenuExpansion(newPath)
    
    showPreview.value = false
    loadedPages.value = new Set()
    pageImages.value = {}
    previewImages.value = []
    previewStartIndex.value = 0
    previewItemRefs.value = []
})

watch(pageSize, () => {
    refreshContent()
})

// --- Folder/File Operations ---

const promptRename = async (target, type) => {
    const isFolder = type === 'folder'
    const newName = prompt(`重命名 "${target.name}" 为:`, target.name)
    if(!newName || newName === target.name) return
    
    try {
        // Use generic file rename endpoint for both
        // For folders it handles recursive menu updates in backend
        const res = await axios.post(`${API_BASE}/file/rename`, {
            oldPath: isFolder ? target.path : target.relativePath,
            newName
        })
        if(res.data.success) {
            refreshContent()
            if(isFolder) fetchMenus() 
        }
    } catch (e) {
        message.error(e.response?.data?.error || '重命名失败')
    }
}

const promptDelete = async (target, type) => {
    deleteTarget.value = { ...target, type }
    showDeleteModal.value = true
    deleteButtonDisabled.value = true
    deleteTimer.value = settings.value.deleteConfirmDuration ? settings.value.deleteConfirmDuration / 1000 : 2
    deleteStats.value = null

    if (type === 'folder') {
        try {
            const res = await axios.get(`${API_BASE}/folder/stats`, { params: { dir: target.path } })
            deleteStats.value = res.data
        } catch (e) { console.error(e) }
    }

    if(timerInterval) clearInterval(timerInterval)
    timerInterval = setInterval(() => {
        deleteTimer.value--
        if(deleteTimer.value <= 0) {
            deleteButtonDisabled.value = false
            clearInterval(timerInterval)
        }
    }, 1000)
}

const cancelDelete = () => {
    showDeleteModal.value = false
    deleteTarget.value = null
    if(timerInterval) clearInterval(timerInterval)
}

const confirmDelete = async () => {
    if(!deleteTarget.value) return
    const { type, path: tPath, relativePath } = deleteTarget.value
    try {
        if (type === 'folder') {
            await axios.delete(`${API_BASE}/folder`, { params: { dir: tPath } })
        } else {
            await axios.delete(`${API_BASE}/file`, { params: { path: relativePath } })
        }
        
        showDeleteModal.value = false
        refreshContent()
        if (type === 'folder') fetchMenus()
    } catch (e) {
        message.error('删除失败')
    }
}

const setCover = async (img) => {
    try {
        await axios.post(`${API_BASE}/folder/cover`, {
            dir: currentPath.value,
            imagePath: img.relativePath
        })
        message.success('设置成功')
    } catch (e) {
        message.error('设置失败')
    }
}

// --- Settings ---

const fetchSettings = async () => {
    try {
        const res = await axios.get(`${API_BASE}/settings`)
        const parseVal = (v) => {
            if (typeof v === 'string') {
                try { return JSON.parse(v) } catch (_) { return v }
            }
            return v
        }
        const incoming = res.data || {}
        // Normalize types from backend
        settings.value = Object.fromEntries(Object.entries(incoming).map(([k, v]) => [k, parseVal(v)]))
        if (settings.value.showImagesInFolder !== undefined) {
            showImages.value = !!settings.value.showImagesInFolder
        }
        if (settings.value.showImageNamesInFolder !== undefined) {
            showImageNames.value = !!settings.value.showImageNamesInFolder
        }
        if(settings.value.theme) {
            currentTheme.value = settings.value.theme
        }
        if(settings.value.pageSize) {
            pageSize.value = parseInt(settings.value.pageSize)
        }
    } catch (e) { console.error(e) }
}

const updateSettings = async (key, value) => {
    try {
        await axios.post(`${API_BASE}/settings`, { key, value })
        settings.value[key] = value
    } catch (e) { console.error(e) }
}

const setTheme = (theme) => {
    currentTheme.value = theme
    updateSettings('theme', theme)
}

onMounted(() => {
    fetchMenus()
    fetchSettings()
    fetchFolderContent(currentPath.value)
    window.addEventListener('keydown', (e) => {
        if (!showPreview.value) return
        if (e.key === 'ArrowDown') shiftWindowDown()
        if (e.key === 'ArrowUp') shiftWindowUp()
        if (e.key === 'Escape') closePreview()
    })
})

onUnmounted(() => {
    window.removeEventListener('mousemove', onResize)
    window.removeEventListener('mouseup', stopResize)
    window.removeEventListener('keydown', () => {})
})
</script>

<style scoped>
/* Theme Variables */
.admin-container.dark-theme {
  --bg-color: #1e1e1e;
  --sidebar-bg: #252526;
  --text-color: #e0e0e0;
  --border-color: #333;
  --hover-bg: #2a2d2e;
  --active-bg: #37373d;
  --item-bg: #2d2d30;
  --item-hover: #3e3e42;
  --input-bg: #3c3c3c;
  --accent: #007acc;
  --scrollbar-track: transparent;
  --scrollbar-thumb: #444;
  --context-menu-bg: #252526;
  --context-menu-border: #454545;
}

.admin-container.light-theme {
  --bg-color: #f3f3f3;
  --sidebar-bg: #f3f3f3;
  --text-color: #333;
  --border-color: #ccc;
  --hover-bg: #e0e0e0;
  --active-bg: #cce8ff;
  --item-bg: #fff;
  --item-hover: #f0f0f0;
  --input-bg: #fff;
  --accent: #007acc;
  --scrollbar-track: #f0f0f0;
  --scrollbar-thumb: #ccc;
  --context-menu-bg: #fff;
  --context-menu-border: #ccc;
}

/* Sidebar Override for Light Theme */
.admin-container.light-theme .sidebar {
  background: transparent;
  border-right: 1px solid #ddd;
}
.admin-container.light-theme .sidebar-header,
.admin-container.light-theme .content-header {
  background: #e8e8e8;
}

/* General Reset & Typography */
.admin-container {
  display: flex;
  height: 100vh;
  color: var(--text-color);
  background: var(--bg-color);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow: hidden;
  transition: background 0.3s, color 0.3s;
}

/* Sidebar */
.sidebar {
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.05s ease;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--sidebar-bg);
}

.sidebar-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.sidebar-header .actions button {
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.7;
  transition: all 0.2s;
}

.sidebar-header .actions button:hover {
  background: var(--hover-bg);
  opacity: 1;
}

.menu-tree-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
}

.sidebar-footer {
  padding: 10px;
  border-top: 1px solid var(--border-color);
}

.settings-btn {
  width: 100%;
  padding: 8px;
  background: transparent;
  border: none;
  color: var(--text-color);
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.8;
}
.settings-btn:hover {
  background: var(--hover-bg);
  opacity: 1;
}

/* Resize Handle */
.resize-handle {
  width: 4px;
  background: var(--border-color);
  cursor: col-resize;
  transition: background 0.2s;
  z-index: 10;
}
.resize-handle:hover, .resize-handle:active {
  background: var(--accent);
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-color);
}

.content-header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--sidebar-bg);
}

.path-nav {
  font-size: 14px;
  color: var(--text-color);
  opacity: 0.9;
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.breadcrumbs {
  display: flex;
  flex-wrap: nowrap;
  overflow: hidden;
}
.crumb {
  display: flex;
  align-items: center;
}
.crumb-link {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}
.crumb-link:hover {
  background: var(--hover-bg);
  text-decoration: underline;
}
.crumb-link.active {
  font-weight: bold;
  cursor: default;
  text-decoration: none;
}
.separator {
  margin: 0 4px;
  color: #888;
}

.content-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toggle-label {
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.7;
}
.icon-btn:hover {
  background: var(--hover-bg);
  opacity: 1;
}

/* Folder Grid */
.folder-grid {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 20px;
  align-content: start;
}

/* 文件夹卡片样式 - 修改部分 */
.folder-item {
  background: var(--item-bg);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
  position: relative;
  height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.folder-tile {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.folder-item:hover {
  background: var(--item-hover);
  border-color: #888;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.folder-content-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 140px;
  margin-bottom: 8px;
}

.folder-icon-large {
  font-size: 72px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}

.folder-type-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: var(--accent);
  color: #fff;
  font-size: 9px;
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: bold;
  opacity: 0.8;
  z-index: 2;
}

.folder-title {
  font-size: 13px;
  color: var(--text-color);
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 4px;
  text-align: center;
}

/* 封面图片样式 - 修改部分 */
.folder-cover-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.folder-cover-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  display: block;
  object-fit: contain;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.folder-item:hover .folder-cover-img {
  opacity: 1;
}

/* 重命名输入框 */
.rename-input {
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--text-color);
  outline: none;
}

.title-input {
  margin-top: 4px;
}

.ghost-folder {
  opacity: 0.5;
  background: var(--item-hover);
}

/* 图片卡片样式 - 保持不变 */
.image-item {
  background: var(--item-bg);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
  height: 140px;
  display: flex;
  flex-direction: column;
}

.image-tile {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.image-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-color: #888;
}

.image-wrapper {
  flex: 1;
  overflow: hidden;
  background: #000;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s;
}

.image-item:hover img {
  transform: scale(1.05);
}

.image-title {
  padding: 6px 4px;
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Pagination */
.pagination-container {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 20px 0;
}
.page-btn {
  padding: 6px 16px;
  background: var(--item-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.page-btn:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: var(--accent);
}
.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.page-info {
  font-size: 13px;
  color: var(--text-color);
}

.load-more-container {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  padding: 20px 0;
}
.load-more-btn {
  padding: 10px 30px;
  background: var(--item-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.load-more-btn:hover {
  background: var(--hover-bg);
  border-color: var(--accent);
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: var(--context-menu-bg);
  border: 1px solid var(--context-menu-border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  border-radius: 6px;
  padding: 4px 0;
  z-index: 2000;
  min-width: 120px;
}
.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-color);
}
.context-menu-item:hover {
  background: var(--accent);
  color: #fff;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color);
  opacity: 0.5;
}
.empty-content {
  text-align: center;
}
.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--sidebar-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  overflow: hidden;
  color: var(--text-color);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-color);
  opacity: 0.6;
}
.close-btn:hover { opacity: 1; }

.modal-body {
  padding: 20px;
  font-size: 14px;
}

/* Settings Modal Specific */
.setting-item {
  margin-bottom: 20px;
}
.setting-item label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
}
.setting-desc {
  font-size: 12px;
  opacity: 0.6;
  margin-top: 6px;
}
.theme-options {
  display: flex;
  gap: 10px;
}
.theme-options button {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border-color);
  background: var(--item-bg);
  color: var(--text-color);
  border-radius: 4px;
  cursor: pointer;
}
.theme-options button.active {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: bold;
  background: var(--active-bg);
}

.input-number {
  width: 100%;
  padding: 8px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  border-radius: 4px;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 24px;
}
.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-switch label {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #555;
  transition: .4s;
  border-radius: 24px;
  margin: 0;
}
.toggle-switch label:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}
.toggle-switch input:checked + label {
  background-color: var(--accent);
}
.toggle-switch input:checked + label:before {
  transform: translateX(16px);
}

.target-path {
  background: var(--input-bg);
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 16px;
  color: var(--accent);
  border: 1px solid var(--border-color);
}

.stats-box {
  background: var(--input-bg);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}
.stats-list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0 0;
}
.stats-list li {
  margin-bottom: 4px;
}

.modal-actions {
  padding: 16px 20px;
  background: var(--bg-color);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel:hover {
  background: var(--hover-bg);
}

.btn-danger {
  background: #c93c3c;
  color: #fff;
  border: none;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-danger:hover {
  background: #e74c3c;
}
.btn-danger:disabled {
  background: #5a3030;
  color: #aaa;
  cursor: not-allowed;
}

/* Preview */
.preview-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
}
.preview-vertical {
  width: 90vw;
  max-width: 1200px;
  height: 90vh;
  display: flex;
  flex-direction: column;
}
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;
  padding: 8px 0;
}
.preview-count { opacity: 0.8; }
.preview-scroll {
  flex: 1;
  overflow-y: auto;
}
.preview-list-item {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 0;
}
.preview-list-img {
  max-width: 80vw;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
