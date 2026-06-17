// Contract generation service.
//
// Pure, side-effect-free logic (validation, formatting, pdfmake document
// definition). The HTTP layer (routes/admin.js) handles auth, data loading and
// streaming. Keeping this layer pure makes the contract text and field mapping
// the easy place to audit — and the safe place to add country templates.
//
//   validateContractData ──► { ok, missing[] }   (blocks blank placeholders)
//   buildContractDefinition ──► pdfmake docDefinition (dispatch by template)
//
// Adding a country: add its entry to contractCountries.js (available:true) and
// a `case` in buildContractDefinition pointing at a builder fn.

import { getCountryConfig } from '../config/contractCountries.js'

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// ---- formatting helpers (unit-test targets) -------------------------------

/** Format a number as "S/ 1,664.00" style money. */
export function formatMoney(amount, symbol = 'S/') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${symbol} 0.00`
  const fixed = n.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${symbol} ${withThousands}.${decPart}`
}

/**
 * Format an ISO date (YYYY-MM-DD) as a Spanish long date: "1 de julio de 2026".
 * Parses date parts directly (no Date()) to avoid timezone off-by-one.
 */
export function formatSpanishDate(iso) {
  if (typeof iso !== 'string') return ''
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return iso
  return `${day} de ${SPANISH_MONTHS[month - 1]} de ${year}`
}

const isBlank = (v) => v == null || String(v).trim() === ''

// ---- validation -----------------------------------------------------------

/**
 * Validate that all data required to render a contract is present, so we never
 * emit a document with blank {{placeholders}}.
 *
 * @returns {{ ok: boolean, missing: string[], reason?: string }}
 *   `missing` items are stable keys ("employer.tax_id", "employee.address",
 *   "params.start_date", ...) the UI can map to localized labels.
 */
export function validateContractData({ country, employer = {}, employee = {}, params = {} }) {
  const config = getCountryConfig(country)
  if (!config) {
    return { ok: false, missing: [], reason: 'unknown_country' }
  }
  if (!config.available) {
    return { ok: false, missing: [], reason: 'template_unavailable' }
  }

  const missing = []

  for (const field of config.employerFields) {
    if (field.required && isBlank(employer[field.key])) {
      missing.push(`employer.${field.key}`)
    }
  }

  if (isBlank(employee.name)) missing.push('employee.name')
  if (isBlank(employee.document_type)) missing.push('employee.document_type')
  if (isBlank(employee.document_number)) missing.push('employee.document_number')
  if (isBlank(employee.address)) missing.push('employee.address')

  if (isBlank(params.start_date)) missing.push('params.start_date')
  if (isBlank(params.end_date)) missing.push('params.end_date')
  if (isBlank(params.area_servicio)) missing.push('params.area_servicio')
  const rate = Number(params.hourly_rate)
  if (!Number.isFinite(rate) || rate <= 0) missing.push('params.hourly_rate')

  // Date sanity (only when both present and well-formed).
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (
    iso.test(String(params.start_date || '').slice(0, 10)) &&
    iso.test(String(params.end_date || '').slice(0, 10)) &&
    String(params.end_date).slice(0, 10) < String(params.start_date).slice(0, 10)
  ) {
    return { ok: false, missing, reason: 'end_before_start' }
  }

  return { ok: missing.length === 0, missing }
}

// ---- document builders ----------------------------------------------------

/**
 * Resolve the monthly reference amount: explicit override if provided and
 * positive, otherwise hourly_rate × country.referenceHours.
 */
export function resolveMonthlyReference({ hourly_rate, monthly_reference }, config) {
  const explicit = Number(monthly_reference)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  return Number(hourly_rate) * config.referenceHours
}

/**
 * Build the pdfmake document definition for a contract.
 * @throws if the country/template is not renderable (callers should call
 *   validateContractData first).
 */
export function buildContractDefinition({ country, employer, employee, params }) {
  const config = getCountryConfig(country)
  if (!config || !config.available) {
    throw new Error(`No contract template available for country: ${country}`)
  }
  switch (config.template) {
    case 'pe_locacion_v1':
      return buildPeruLocacion({ config, employer, employee, params })
    default:
      throw new Error(`No builder for template: ${config.template}`)
  }
}

// Numbered clause helper for consistent styling.
function clause(title, body) {
  const content = [{ text: title, style: 'clauseTitle' }]
  const paragraphs = Array.isArray(body) ? body : [body]
  for (const p of paragraphs) {
    if (typeof p === 'object' && p.ul) {
      content.push({ ul: p.ul, style: 'para', margin: [10, 2, 0, 4] })
    } else {
      content.push({ text: p, style: 'para' })
    }
  }
  return content
}

/**
 * Peru — Contrato de Locación de Servicios (Código Civil). Renders the exact
 * template text with employer/employee/params substituted.
 */
function buildPeruLocacion({ config, employer, employee, params }) {
  const symbol = config.currencySymbol
  const monthlyRef = resolveMonthlyReference(params, config)

  const empresa = employer.legal_name
  const ruc = employer.tax_id
  const domicilioEmpresa = employer.address
  const repLegal = employer.rep_name
  const tipoDocRep = employer.rep_doc_type
  const docRep = employer.rep_doc_number

  const nombre = employee.name
  const tipoDoc = employee.document_type
  const numDoc = employee.document_number
  const domicilio = employee.address

  const area = params.area_servicio
  const fechaInicio = formatSpanishDate(params.start_date)
  const fechaFin = formatSpanishDate(params.end_date)
  const tarifa = formatMoney(params.hourly_rate, symbol)
  const monto = formatMoney(monthlyRef, symbol)

  return {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 64],
    info: {
      title: `Contrato de Locación de Servicios - ${nombre}`,
      author: empresa,
    },
    footer: (currentPage, pageCount) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'center',
      style: 'footer',
    }),
    content: [
      { text: 'CONTRATO DE LOCACIÓN DE SERVICIOS', style: 'docTitle' },
      {
        text: [
          'Conste por el presente documento el Contrato de Locación de Servicios que celebran de una parte ',
          { text: empresa, bold: true },
          ', identificado con RUC N.° ', { text: ruc, bold: true },
          ', con domicilio en ', { text: domicilioEmpresa, bold: true },
          ', debidamente representado por ', { text: repLegal, bold: true },
          ', identificado con ', { text: `${tipoDocRep} N.° ${docRep}`, bold: true },
          ', a quien en adelante se le denominará EL CONTRATANTE; y de la otra parte ',
          { text: nombre, bold: true },
          ', identificado con ', { text: `${tipoDoc} N.° ${numDoc}`, bold: true },
          ', con domicilio en ', { text: domicilio, bold: true },
          ', a quien en adelante se le denominará EL LOCADOR; en los términos y condiciones siguientes:',
        ],
        style: 'para',
      },

      clause('PRIMERA: ANTECEDENTES', [
        'EL CONTRATANTE desarrolla actividades comerciales vinculadas a servicios de restaurante y requiere contratar servicios especializados de apoyo operativo.',
        'EL LOCADOR declara contar con la experiencia, capacidad técnica y autonomía necesarias para prestar dichos servicios.',
      ]),

      clause('SEGUNDA: OBJETO DEL CONTRATO', [
        { text: [
          'Por el presente contrato, EL LOCADOR se obliga a prestar servicios de apoyo operativo en el área de ',
          { text: area, bold: true }, '.',
        ] },
        'EL LOCADOR ejecutará sus actividades con autonomía técnica y administrativa, utilizando sus propios criterios profesionales para el cumplimiento de las obligaciones asumidas.',
      ]),

      clause('TERCERA: NATURALEZA DE LA RELACIÓN', [
        'Las partes dejan expresa constancia de que el presente contrato es de naturaleza civil y se encuentra regulado por las disposiciones del Código Civil relativas a la Locación de Servicios.',
        'No existe relación laboral, subordinación, exclusividad ni obligación de incorporación a planilla.',
        'EL LOCADOR actúa como prestador independiente de servicios y asume íntegramente las obligaciones tributarias que correspondan por los ingresos percibidos.',
      ]),

      clause('CUARTA: PLAZO', [
        { text: [
          'El presente contrato tendrá vigencia desde el ',
          { text: fechaInicio, bold: true }, ' hasta el ',
          { text: fechaFin, bold: true }, '.',
        ] },
        'Al vencimiento del plazo, el contrato podrá renovarse automáticamente por períodos sucesivos de igual duración salvo comunicación escrita de cualquiera de las partes con una anticipación mínima de siete (7) días calendario.',
      ]),

      clause('QUINTA: CONTRAPRESTACIÓN', [
        { text: [
          'Las partes acuerdan una contraprestación referencial mensual de ',
          { text: monto, bold: true }, '.',
        ] },
        { text: [
          'Para efectos de cálculo y control administrativo, dicha contraprestación equivale a una tarifa de ',
          { text: tarifa, bold: true }, ' por hora efectivamente prestada.',
        ] },
        'La contraprestación correspondiente a cada período será calculada multiplicando la tarifa horaria pactada por el número de horas efectivamente registradas y aprobadas por EL CONTRATANTE.',
        `Las partes reconocen que el monto mensual indicado constituye únicamente una referencia económica basada en un promedio de ${config.referenceHours} horas mensuales y que el importe efectivamente pagado podrá variar en función de las horas realmente prestadas durante cada período.`,
        'La contraprestación referencial mensual no constituye remuneración ni implica la existencia de una jornada laboral determinada.',
      ]),

      clause('SEXTA: FORMA DE PAGO', [
        'EL CONTRATANTE efectuará pagos quincenales.',
        'El primer período comprenderá del día 1 al día 15 de cada mes.',
        'El segundo período comprenderá del día 16 hasta el último día calendario del mes.',
        'Los pagos se realizarán dentro de los cinco (5) días hábiles siguientes al cierre de cada período, previa emisión y entrega del correspondiente Recibo por Honorarios Electrónico por parte del LOCADOR.',
        'El importe de cada pago será calculado sobre la base de las horas efectivamente registradas durante el período correspondiente.',
      ]),

      clause('SÉTIMA: OBLIGACIONES DEL LOCADOR', [
        { ul: [
          'Ejecutar los servicios con diligencia, responsabilidad y buena fe.',
          'Cumplir las normas de seguridad e higiene establecidas por EL CONTRATANTE.',
          'Mantener una conducta adecuada dentro de las instalaciones donde se presten los servicios.',
          'Informar oportunamente cualquier incidencia que pueda afectar el normal desarrollo de las operaciones.',
          'Emitir los comprobantes de pago que correspondan conforme a la normativa tributaria vigente.',
        ] },
      ]),

      clause('OCTAVA: OBLIGACIONES DEL CONTRATANTE', [
        { ul: [
          'Facilitar la información necesaria para la adecuada ejecución de los servicios.',
          'Efectuar los pagos pactados dentro de los plazos establecidos.',
          'Permitir el acceso a las instalaciones cuando resulte necesario para la ejecución de los servicios contratados.',
        ] },
      ]),

      clause('NOVENA: EQUIPOS, MATERIALES Y UNIFORMES', [
        'Cuando resulte necesario para la prestación de los servicios, EL CONTRATANTE podrá facilitar equipos, herramientas, materiales o uniformes.',
        'La entrega de dichos elementos no implica subordinación laboral ni modifica la naturaleza civil de la relación contractual.',
        'EL LOCADOR será responsable por el uso adecuado y conservación de los bienes que se le entreguen.',
      ]),

      clause('DÉCIMA: CONFIDENCIALIDAD', [
        'EL LOCADOR se compromete a mantener absoluta reserva respecto de toda información comercial, financiera, operativa, tecnológica o estratégica a la que tenga acceso durante la ejecución del presente contrato.',
        'Esta obligación subsistirá incluso después de concluida la relación contractual.',
      ]),

      clause('DÉCIMA PRIMERA: PROTECCIÓN DE INFORMACIÓN',
        'EL LOCADOR se obliga a no copiar, divulgar, transferir ni utilizar información del CONTRATANTE para fines distintos a los previstos en este contrato.'),

      clause('DÉCIMA SEGUNDA: NO EXCLUSIVIDAD',
        'EL LOCADOR podrá prestar servicios a terceros siempre que ello no afecte el adecuado cumplimiento de las obligaciones asumidas mediante el presente contrato.'),

      clause('DÉCIMA TERCERA: RESPONSABILIDAD',
        'EL LOCADOR responderá por los daños y perjuicios que pudiera ocasionar por dolo, negligencia grave o incumplimiento de las obligaciones asumidas.'),

      clause('DÉCIMA CUARTA: RESOLUCIÓN ANTICIPADA',
        'Cualquiera de las partes podrá resolver el presente contrato mediante comunicación escrita remitida con una anticipación mínima de siete (7) días calendario.'),

      clause('DÉCIMA QUINTA: DOMICILIO',
        'Las partes señalan como domicilios los indicados en la introducción del presente contrato.'),

      clause('DÉCIMA SEXTA: LEGISLACIÓN APLICABLE Y JURISDICCIÓN', [
        'Las partes acuerdan que cualquier controversia derivada de la interpretación o ejecución del presente contrato será resuelta de conformidad con las leyes de la República del Perú.',
        'Para tal efecto, las partes se someten a la jurisdicción de los jueces y tribunales del Distrito Judicial de Lima.',
      ]),

      {
        style: 'signatures',
        margin: [0, 48, 0, 0],
        columns: [
          {
            width: '*',
            stack: [
              { text: 'EL CONTRATANTE', bold: true },
              { text: empresa },
              { text: 'Representante Legal:' },
              { text: repLegal },
              { text: `${tipoDocRep} N.° ${docRep}` },
              { text: '\nFirma: ______________________________', margin: [0, 16, 0, 0] },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'EL LOCADOR', bold: true },
              { text: nombre },
              { text: `${tipoDoc} N.° ${numDoc}` },
              { text: '\nFirma: ______________________________', margin: [0, 16, 0, 0] },
            ],
          },
        ],
      },
    ],
    styles: {
      docTitle: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 16] },
      clauseTitle: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] },
      para: { fontSize: 10, alignment: 'justify', lineHeight: 1.25, margin: [0, 0, 0, 4] },
      signatures: { fontSize: 10 },
      footer: { fontSize: 8, color: '#888888' },
    },
  }
}
