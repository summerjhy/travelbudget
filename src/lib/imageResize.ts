const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8

export async function resizeAndCompress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 생성할 수 없습니다.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  return dataUrl.split(',')[1]
}

export async function resizeAndCompressMany(files: File[]): Promise<string[]> {
  return Promise.all(files.map(resizeAndCompress))
}
