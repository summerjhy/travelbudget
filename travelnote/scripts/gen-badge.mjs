import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(dir, '..', 'public')

const badge = readFileSync(path.join(dir, 'badge-source.svg'))
await sharp(badge).resize(96, 96).png().toFile(path.join(publicDir, 'badge-96x96.png'))
console.log('배지 아이콘 생성 완료')
