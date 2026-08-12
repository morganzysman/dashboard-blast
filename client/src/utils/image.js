// Client-side image downscaling.
//
// Images are posted as base64 in a JSON body and stored in Postgres BYTEA, so
// shrinking them here is what keeps rows (and request bodies) reasonable. A
// 1280px JPEG at quality 0.7 is plenty to read a fridge label or a document.

/**
 * Downscale + compress an image File.
 * Resolves to `{ base64, mime, preview }` where base64 is a data URL.
 */
export function compressImage(file, { maxDim = 1280, quality = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('image decode failed'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve({ base64: dataUrl, mime: 'image/jpeg', preview: dataUrl })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
