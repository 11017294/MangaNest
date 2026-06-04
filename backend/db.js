import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Sequelize, DataTypes } from 'sequelize'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DB_PATH = path.join(PROJECT_ROOT, 'database.sqlite')

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: DB_PATH,
  logging: false
})

export const Comic = sequelize.define('Comic', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  author: { type: DataTypes.STRING, allowNull: true },
  coverPath: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: true },
  favorite: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  readCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lastReadAt: { type: DataTypes.DATE, allowNull: true },
  sourcePath: { type: DataTypes.STRING, allowNull: false, unique: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'comics'
})

export const Chapter = sequelize.define('Chapter', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comicId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  number: { type: DataTypes.FLOAT, allowNull: true },
  path: { type: DataTypes.STRING, allowNull: false, unique: true },
  type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'folder' },
  pageCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'chapters'
})

export const Page = sequelize.define('Page', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  chapterId: { type: DataTypes.INTEGER, allowNull: false },
  pageIndex: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  filePath: { type: DataTypes.STRING, allowNull: false, unique: true },
  width: { type: DataTypes.INTEGER, allowNull: true },
  height: { type: DataTypes.INTEGER, allowNull: true },
  thumbPath: { type: DataTypes.STRING, allowNull: true },
  fileSize: { type: DataTypes.INTEGER, allowNull: true },
  hash: { type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'pages',
  indexes: [
    { fields: ['chapterId', 'pageIndex'] }
  ]
})

export const ReadingProgress = sequelize.define('ReadingProgress', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comicId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  chapterId: { type: DataTypes.INTEGER, allowNull: false },
  pageIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  scrollOffset: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'reading_progress'
})

export const ReadingEvent = sequelize.define('ReadingEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comicId: { type: DataTypes.INTEGER, allowNull: false },
  chapterId: { type: DataTypes.INTEGER, allowNull: false },
  pageIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'reading_events'
})

export const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'categories'
})

export const ComicCategory = sequelize.define('ComicCategory', {
  comicId: { type: DataTypes.INTEGER, allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'comic_categories',
  timestamps: false
})

export const Menu = sequelize.define('Menu', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  path: { type: DataTypes.STRING, allowNull: false },
  parentId: { type: DataTypes.INTEGER, allowNull: true },
  order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'menus',
  timestamps: false
})

export const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.TEXT, allowNull: false }
}, {
  tableName: 'settings',
  timestamps: false
})

export const FolderMetadata = sequelize.define('FolderMetadata', {
  path: { type: DataTypes.STRING, primaryKey: true },
  coverImage: { type: DataTypes.STRING, allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'folder_metadata',
  timestamps: false
})

Comic.hasMany(Chapter, { foreignKey: 'comicId', as: 'chapters', onDelete: 'CASCADE' })
Chapter.belongsTo(Comic, { foreignKey: 'comicId', as: 'comic' })
Chapter.hasMany(Page, { foreignKey: 'chapterId', as: 'pages', onDelete: 'CASCADE' })
Page.belongsTo(Chapter, { foreignKey: 'chapterId', as: 'chapter' })
Comic.hasOne(ReadingProgress, { foreignKey: 'comicId', as: 'progress', onDelete: 'CASCADE' })
ReadingProgress.belongsTo(Comic, { foreignKey: 'comicId', as: 'comic' })
ReadingProgress.belongsTo(Chapter, { foreignKey: 'chapterId', as: 'chapter' })
Comic.hasMany(ReadingEvent, { foreignKey: 'comicId', as: 'readingEvents', onDelete: 'CASCADE' })
ReadingEvent.belongsTo(Comic, { foreignKey: 'comicId', as: 'comic' })
ReadingEvent.belongsTo(Chapter, { foreignKey: 'chapterId', as: 'chapter' })
Comic.belongsToMany(Category, { through: ComicCategory, foreignKey: 'comicId', otherKey: 'categoryId', as: 'categories' })
Category.belongsToMany(Comic, { through: ComicCategory, foreignKey: 'categoryId', otherKey: 'comicId', as: 'comics' })

const defaultSettings = [
  { key: 'theme', value: JSON.stringify('soft-light') },
  { key: 'libraryPath', value: JSON.stringify('E:\\pagefile') },
  { key: 'readerPreloadPages', value: JSON.stringify(3) },
  { key: 'readerConcurrentLoads', value: JSON.stringify(3) },
  { key: 'pageSize', value: JSON.stringify(50) },
  { key: 'showImagesInFolder', value: JSON.stringify(false) },
  { key: 'showImageNamesInFolder', value: JSON.stringify(false) }
]

export const initDB = async () => {
  await sequelize.authenticate()
  await sequelize.sync()

  const qi = sequelize.getQueryInterface()
  try {
    const comicSchema = await qi.describeTable('comics')
    if (!comicSchema.favorite) {
      await qi.addColumn('comics', 'favorite', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      })
    }
    if (!comicSchema.readCount) {
      await qi.addColumn('comics', 'readCount', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      })
    }
    if (!comicSchema.lastReadAt) {
      await qi.addColumn('comics', 'lastReadAt', {
        type: DataTypes.DATE,
        allowNull: true
      })
    }
  } catch {}

  for (const item of defaultSettings) {
    const existing = await Setting.findByPk(item.key)
    if (!existing) await Setting.create(item)
  }
}

export const getProjectRoot = () => PROJECT_ROOT
export const getDatabasePath = () => DB_PATH
