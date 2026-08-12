// Shared validation for base64 image uploads.
//
// Every image in this app arrives as base64 inside a JSON body (there is no
// multipart layer) and lands in a BYTEA column, so the size/type gate is the
// only thing standing between a phone camera and the database.

export const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const DEFAULT_MAX_IMAGE_BYTES = 4 * 1024 * 1024

/**
 * Parse a data URL or raw base64 + mime into a validated Buffer.
 * Returns `{ error }` on rejection, `{ buffer, mime }` on success.
 */
export function decodeImagePayload({ image_base64, mime }, { maxBytes = DEFAULT_MAX_IMAGE_BYTES } = {}) {
  if (!image_base64 || typeof image_base64 !== 'string') {
    return { error: 'image_base64 is required' }
  }
  let resolvedMime = mime
  let b64 = image_base64
  const dataUrlMatch = image_base64.match(/^data:([^;]+);base64,(.*)$/s)
  if (dataUrlMatch) {
    resolvedMime = resolvedMime || dataUrlMatch[1]
    b64 = dataUrlMatch[2]
  }
  resolvedMime = (resolvedMime || '').toLowerCase()
  if (!ALLOWED_IMAGE_MIME.has(resolvedMime)) {
    return { error: 'Unsupported image type (use JPEG, PNG or WebP)' }
  }
  let buf
  try {
    buf = Buffer.from(b64, 'base64')
  } catch {
    return { error: 'Invalid base64 image data' }
  }
  if (!buf.length) return { error: 'Empty image' }
  if (buf.length > maxBytes) {
    return { error: `Image too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)` }
  }
  return { buffer: buf, mime: resolvedMime }
}
