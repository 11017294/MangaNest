import { initDB, FolderMetadata, sequelize } from './db.js'
await initDB()
await FolderMetadata.upsert({ path: 'test/folder', coverImage: 'test/folder/cover.jpg' })
const row = await FolderMetadata.findByPk('test/folder')
console.log(JSON.stringify({ success: !!row, coverImage: row?.coverImage }))
await sequelize.close()
