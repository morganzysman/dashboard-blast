// Thin wrapper around pdfmake's server-side printer.
//
// Uses the built-in PDF standard font "Helvetica" (one of the base-14 fonts
// shipped inside PDFKit) so we do NOT need to bundle any .ttf files. Latin-1 /
// WinAnsi covers the Spanish glyphs we need (á é í ó ú ñ ¿ ¡), which is all the
// LATAM contract templates require. This keeps the image small and avoids any
// native/font-file deployment headaches on Railway.

import Pdfmake from 'pdfmake'

const PdfPrinter = Pdfmake.default || Pdfmake

const FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
}

const printer = new PdfPrinter(FONTS)

/**
 * Build a PDFKit document stream from a pdfmake document definition.
 * Caller is responsible for piping / ending the returned stream.
 * `defaultStyle.font` is forced to Helvetica so callers can't accidentally
 * reference a font we haven't registered.
 *
 * @param {object} docDefinition pdfmake document definition.
 * @returns {import('stream').Readable} PDFKit document (already implements
 *   the readable-stream interface: .on('data'|'end'), .pipe(), .end()).
 */
export function createPdf(docDefinition) {
  const def = {
    ...docDefinition,
    defaultStyle: { font: 'Helvetica', ...(docDefinition.defaultStyle || {}) },
  }
  const doc = printer.createPdfKitDocument(def)
  return doc
}

/**
 * Render a pdfmake document definition fully into a Buffer.
 * Used when we need to persist the PDF (immutable contract snapshots) rather
 * than stream it to the client.
 *
 * @param {object} docDefinition pdfmake document definition.
 * @returns {Promise<Buffer>} the complete PDF bytes.
 */
export function createPdfBuffer(docDefinition) {
  return new Promise((resolve, reject) => {
    const doc = createPdf(docDefinition)
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}
