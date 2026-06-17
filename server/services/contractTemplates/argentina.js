// Argentina contract templates.
//
//   ar_locacion_v1 — Contrato de Locación de Servicios (Código Civil y
//                    Comercial). Prestador independiente (monotributista),
//                    sin relación de dependencia.
//   ar_trabajo_v1  — Contrato de Trabajo (Ley de Contrato de Trabajo N.° 20.744).
//                    Relación de dependencia, remuneración y aportes.

import {
  formatMoney,
  formatSpanishDate,
  resolveMonthlyReference,
  clause,
  signatureBlock,
  buildDoc,
} from './shared.js'

export function buildArgentinaLocacion({ config, employer, employee, params }) {
  const symbol = config.currencySymbol
  const monthlyRef = resolveMonthlyReference(params, config)

  const empresa = employer.legal_name
  const cuit = employer.tax_id
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

  const content = [
    { text: 'CONTRATO DE LOCACIÓN DE SERVICIOS', style: 'docTitle' },
    {
      text: [
        'Entre ', { text: empresa, bold: true },
        ', CUIT N.° ', { text: cuit, bold: true },
        ', con domicilio en ', { text: domicilioEmpresa, bold: true },
        ', representada por ', { text: repLegal, bold: true },
        ', ', { text: `${tipoDocRep} N.° ${docRep}`, bold: true },
        ', en adelante "EL COMITENTE"; y ',
        { text: nombre, bold: true },
        ', ', { text: `${tipoDoc} N.° ${numDoc}`, bold: true },
        ', con domicilio en ', { text: domicilio, bold: true },
        ', en adelante "EL LOCADOR", se celebra el presente Contrato de Locación de Servicios, conforme al Código Civil y Comercial de la Nación:',
      ],
      style: 'para',
    },

    clause('PRIMERA: OBJETO', [
      { text: ['EL LOCADOR se obliga a prestar servicios de apoyo operativo en el área de ', { text: area, bold: true }, ', de manera autónoma e independiente, con sus propios medios.'] },
    ]),

    clause('SEGUNDA: NATURALEZA', [
      'El presente es un contrato de naturaleza civil/comercial y no configura relación de dependencia laboral en los términos de la Ley N.° 20.744. No existe subordinación jurídica, técnica ni económica.',
      'EL LOCADOR reviste la condición de trabajador independiente (monotributista o responsable inscripto) y asume el cumplimiento de sus obligaciones fiscales y previsionales ante la AFIP.',
    ]),

    clause('TERCERA: PLAZO',
      { text: ['El contrato regirá desde el ', { text: fechaInicio, bold: true }, ' hasta el ', { text: fechaFin, bold: true }, ', pudiendo renovarse por acuerdo escrito de las partes.'] }),

    clause('CUARTA: RETRIBUCIÓN', [
      { text: ['Las partes acuerdan una retribución de referencia mensual de ', { text: monto, bold: true }, ', equivalente a una tarifa de ', { text: tarifa, bold: true }, ' por hora efectivamente prestada.'] },
      'El importe de cada período se calculará según las horas efectivamente registradas, previa emisión de la factura correspondiente por parte del LOCADOR.',
    ]),

    clause('QUINTA: OBLIGACIONES DEL LOCADOR', [
      { ul: [
        'Prestar los servicios con diligencia y buena fe.',
        'Emitir las facturas que correspondan conforme a la normativa fiscal.',
        'Cumplir las normas de higiene y seguridad de las instalaciones.',
        'Mantener confidencialidad sobre la información del COMITENTE.',
      ] },
    ]),

    clause('SEXTA: OBLIGACIONES DEL COMITENTE', [
      { ul: [
        'Abonar la retribución pactada en los plazos acordados.',
        'Brindar la información necesaria para la prestación.',
      ] },
    ]),

    clause('SÉPTIMA: RESCISIÓN',
      'Cualquiera de las partes podrá rescindir el contrato mediante notificación escrita con una antelación mínima de siete (7) días corridos.'),

    clause('OCTAVA: LEY Y JURISDICCIÓN',
      'El presente contrato se rige por las leyes de la República Argentina. Las partes se someten a la jurisdicción de los tribunales ordinarios competentes, con renuncia a cualquier otro fuero.'),

    signatureBlock(
      { heading: 'EL COMITENTE', lines: [empresa, repLegal, `${tipoDocRep} N.° ${docRep}`] },
      { heading: 'EL LOCADOR', lines: [nombre, `${tipoDoc} N.° ${numDoc}`] },
    ),
  ]

  return buildDoc({ title: `Contrato de Locación de Servicios - ${nombre}`, author: empresa, content })
}

export function buildArgentinaTrabajo({ config, employer, employee, params }) {
  const symbol = config.currencySymbol

  const empresa = employer.legal_name
  const cuit = employer.tax_id
  const domicilioEmpresa = employer.address
  const repLegal = employer.rep_name
  const tipoDocRep = employer.rep_doc_type
  const docRep = employer.rep_doc_number

  const nombre = employee.name
  const tipoDoc = employee.document_type
  const numDoc = employee.document_number
  const domicilio = employee.address

  const cargo = params.position
  const fechaInicio = formatSpanishDate(params.start_date)
  const indefinite = !params.end_date
  const fechaFin = indefinite ? null : formatSpanishDate(params.end_date)
  const sueldo = formatMoney(params.monthly_salary, symbol)
  const weeklyHours = Number(params.weekly_hours) > 0
    ? Math.min(Number(params.weekly_hours), config.maxWeeklyHours)
    : config.maxWeeklyHours

  const plazo = indefinite
    ? { text: ['La relación laboral es por tiempo indeterminado (art. 90 LCT) y comienza el ', { text: fechaInicio, bold: true }, '. Los primeros tres (3) meses se considerarán período de prueba conforme al art. 92 bis de la LCT.'] }
    : { text: ['El contrato es a plazo fijo (art. 93 LCT), con vigencia desde el ', { text: fechaInicio, bold: true }, ' hasta el ', { text: fechaFin, bold: true }, '.'] }

  const content = [
    { text: 'CONTRATO DE TRABAJO', style: 'docTitle' },
    {
      text: [
        'Entre ', { text: empresa, bold: true },
        ', CUIT N.° ', { text: cuit, bold: true },
        ', con domicilio en ', { text: domicilioEmpresa, bold: true },
        ', representada por ', { text: repLegal, bold: true },
        ', ', { text: `${tipoDocRep} N.° ${docRep}`, bold: true },
        ', en adelante "EL EMPLEADOR"; y ',
        { text: nombre, bold: true },
        ', ', { text: `${tipoDoc} N.° ${numDoc}`, bold: true },
        ', con domicilio en ', { text: domicilio, bold: true },
        ', en adelante "EL TRABAJADOR", se celebra el presente Contrato de Trabajo, regido por la Ley de Contrato de Trabajo N.° 20.744:',
      ],
      style: 'para',
    },

    clause('PRIMERA: OBJETO Y CATEGORÍA', [
      { text: ['EL TRABAJADOR se obliga a prestar servicios en relación de dependencia, desempeñando el cargo/categoría de ', { text: cargo, bold: true }, ', cumpliendo las tareas propias del puesto.'] },
    ]),

    clause('SEGUNDA: NATURALEZA', [
      'La relación es de carácter laboral, bajo dependencia y subordinación, regida por la LCT y, en su caso, por el Convenio Colectivo de Trabajo aplicable a la actividad.',
      'EL EMPLEADOR registrará al TRABAJADOR ante la AFIP y realizará los aportes y contribuciones a la seguridad social y obra social que correspondan.',
    ]),

    clause('TERCERA: PLAZO', plazo),

    clause('CUARTA: REMUNERACIÓN', [
      { text: ['EL EMPLEADOR abonará una remuneración mensual de ', { text: sueldo, bold: true }, ', sujeta a los aportes y retenciones de ley, no inferior al Salario Mínimo Vital y Móvil ni al mínimo del convenio aplicable.'] },
      'La remuneración se abonará dentro de los plazos legales, junto con el aguinaldo (SAC) y demás conceptos que correspondan.',
    ]),

    clause('QUINTA: JORNADA', [
      { text: ['La jornada será de hasta ', { text: `${weeklyHours} horas`, bold: true }, ' semanales, sin exceder el máximo de la Ley N.° 11.544. Las horas suplementarias se abonarán con los recargos legales.'] },
    ]),

    clause('SEXTA: BENEFICIOS', [
      'EL TRABAJADOR gozará de las licencias, vacaciones (art. 150 y ss. LCT) y demás beneficios previstos por la LCT y el convenio colectivo aplicable.',
    ]),

    clause('SÉPTIMA: OBLIGACIONES DEL TRABAJADOR', [
      { ul: [
        'Prestar el servicio con diligencia, colaboración y buena fe (arts. 62 a 63 LCT).',
        'Cumplir las normas de higiene y seguridad y las instrucciones del empleador.',
        'Guardar reserva sobre la información de la empresa.',
      ] },
    ]),

    clause('OCTAVA: EXTINCIÓN',
      'El contrato se extinguirá por las causales previstas en la LCT, con las indemnizaciones que correspondan según el caso.'),

    clause('NOVENA: LEY Y JURISDICCIÓN',
      'Lo no previsto se rige por la Ley de Contrato de Trabajo y normas complementarias de la República Argentina. Las controversias se someterán a la Justicia Nacional del Trabajo competente.'),

    signatureBlock(
      { heading: 'EL EMPLEADOR', lines: [empresa, repLegal, `${tipoDocRep} N.° ${docRep}`] },
      { heading: 'EL TRABAJADOR', lines: [nombre, `${tipoDoc} N.° ${numDoc}`] },
    ),
  ]

  return buildDoc({ title: `Contrato de Trabajo - ${nombre}`, author: empresa, content })
}
