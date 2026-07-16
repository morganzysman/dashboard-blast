// Download an account's clock-in QR as a PNG with the account name rendered
// above the code. The server returns the raw QR PNG plus an X-Account-Name
// header; we composite the label onto a canvas client-side so the resulting
// file opens correctly everywhere (PNG, no SVG rendering quirks).
export async function downloadAccountQr({ companyToken, accountName = '', sessionId, t } = {}) {
  const label = (key, fallback) => (typeof t === 'function' ? t(key) : fallback)
  try {
    if (!companyToken) return
    const resp = await fetch(`/api/payroll/qr/${encodeURIComponent(companyToken)}/image`, {
      headers: { 'X-Session-ID': sessionId }
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.error || `Failed to download QR (${resp.status})`)
    }

    // Prefer the account name from the response header, fall back to the caller
    let accName = ''
    try { accName = decodeURIComponent(resp.headers.get('X-Account-Name') || '') } catch { accName = '' }
    if (!accName) accName = accountName || companyToken

    const blob = await resp.blob()
    const qrUrl = URL.createObjectURL(blob)
    try {
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('Failed to load QR image'))
        img.src = qrUrl
      })

      const QR = img.naturalWidth || 512
      const MARGIN = Math.round(QR * 0.047)   // ~24px at 512
      const LABEL_H = Math.round(QR * 0.16)    // room for the name
      const canvas = document.createElement('canvas')
      canvas.width = QR + MARGIN * 2
      canvas.height = LABEL_H + QR + MARGIN
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const fontSize = accName.length > 28 ? Math.round(QR * 0.045) : accName.length > 20 ? Math.round(QR * 0.055) : Math.round(QR * 0.066)
      ctx.fillStyle = '#111827'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`
      ctx.fillText(accName, canvas.width / 2, LABEL_H / 2, canvas.width - MARGIN * 2)

      ctx.drawImage(img, MARGIN, LABEL_H, QR, QR)

      const safeName = accName.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || companyToken
      const outUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = outUrl
      a.download = `qr-${safeName}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      URL.revokeObjectURL(qrUrl)
    }
  } catch (e) {
    window.showNotification?.({
      type: 'error',
      title: label('payroll.qrDownload', 'Download QR'),
      message: e.message || label('payroll.failedToDownloadQR', 'Failed to download QR')
    })
  }
}
