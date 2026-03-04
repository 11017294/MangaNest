import path from 'path'
import { fileURLToPath } from 'url'
import { Sequelize, DataTypes } from 'sequelize'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// SQLite 文件路径（位于根目录或 backend 同级）
const DB_PATH = path.join(__dirname, 'database.sqlite')
let resolvedPath = DB_PATH
try {
  const fs = await import('fs')
  if (!fs.existsSync(DB_PATH)) {
    const parentPath = path.join(__dirname, '..', 'database.sqlite')
    if (fs.existsSync(parentPath)) {
      resolvedPath = parentPath
    }
  }
} catch {}

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: resolvedPath,
  logging: false
})

export const Menu = sequelize.define('Menu', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  path: { type: DataTypes.STRING, allowNull: false }, // 相对 IMAGE_DIR 的路径（/ 分隔）
  parentId: { type: DataTypes.INTEGER, allowNull: true },
  order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'menus',
  timestamps: false
})

export const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.TEXT, allowNull: false } // 存 JSON 字符串
}, {
  tableName: 'settings',
  timestamps: false
})

export const FolderMetadata = sequelize.define('FolderMetadata', {
  path: { type: DataTypes.STRING, primaryKey: true }, // 目录相对路径
  coverImage: { type: DataTypes.STRING, allowNull: true }, // 图片相对路径
  note: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'folder_metadata',
  timestamps: false
})

export const initDB = async () => {
  await sequelize.authenticate()
  await sequelize.sync()

  const qi = sequelize.getQueryInterface()
  try {
    const schema = await qi.describeTable('folder_metadata')
    if (!schema.note) {
      await qi.addColumn('folder_metadata', 'note', { type: DataTypes.TEXT, allowNull: true })
    }
    if (schema.createdAt) {
      try {
        await qi.changeColumn('folder_metadata', 'createdAt', { type: DataTypes.DATE, allowNull: true })
      } catch (e) {
        try { await qi.removeColumn('folder_metadata', 'createdAt') } catch (_) {}
      }
    }
    if (schema.updatedAt) {
      try {
        await qi.changeColumn('folder_metadata', 'updatedAt', { type: DataTypes.DATE, allowNull: true })
      } catch (e) {
        try { await qi.removeColumn('folder_metadata', 'updatedAt') } catch (_) {}
      }
    }
  } catch (e) {}

  // 初始化一些缺省设置（可选）
  const defaults = [
    { key: 'theme', value: JSON.stringify('dark-theme') },
    { key: 'pageSize', value: JSON.stringify(50) },
    { key: 'showImagesInFolder', value: JSON.stringify(false) }
  ]
  for (const item of defaults) {
    const existing = await Setting.findByPk(item.key)
    if (!existing) {
      await Setting.create(item)
    }
  }
}

