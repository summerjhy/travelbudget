import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(dir, '..', 'public')

const icon = readFileSync(path.join(dir, 'icon-source.svg'))
const maskable = readFileSync(path.join(dir, 'icon-maskable.svg'))

await sharp(icon).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'))
await sharp(icon).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'))
await sharp(maskable).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512x512.png'))
await sharp(icon).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'))

console.log('아이콘 생성 완료')
