// Colombia contract templates.
//
//   co_prestacion_v1 — Contrato de Prestación de Servicios (civil/comercial,
//                      Código Civil y de Comercio). Contratista independiente,
//                      sin subordinación, paga sus propios aportes.
//   co_laboral_v1    — Contrato Individual de Trabajo (Código Sustantivo del
//                      Trabajo). Subordinación, salario y prestaciones sociales.

import {
  formatMoney,
  formatSpanishDate,
  resolveMonthlyReference,
  clause,
  signatureBlock,
  buildDoc,
} from './shared.js'

export function buildColombiaPrestacion({ config, employer, employee, params }) {
  const symbol = config.currencySymbol
  const monthlyRef = resolveMonthlyReference(params, config)

  const empresa = employer.legal_name
  const nit = employer.tax_id
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
    { text: 'CONTRATO DE PRESTACIÓN DE SERVICIOS', style: 'docTitle' },
    {
      text: [
        'Entre los suscritos, ',
        { text: empresa, bold: true },
        ', identificada con NIT N.° ', { text: nit, bold: true },
        ', con domicilio en ', { text: domicilioEmpresa, bold: true },
        ', representada legalmente por ', { text: repLegal, bold: true },
        ', identificado con ', { text: `${tipoDocRep} N.° ${docRep}`, bold: true },
        ', quien en adelante se denominará EL CONTRATANTE; y ',
        { text: nombre, bold: true },
        ', identificado con ', { text: `${tipoDoc} N.° ${numDoc}`, bold: true },
        ', con domicilio en ', { text: domicilio, bold: true },
        ', quien en adelante se denominará EL CONTRATISTA, hemos acordado celebrar el presente Contrato de Prestación de Servicios, que se regirá por las siguientes cláusulas:',
      ],
      style: 'para',
    },

    clause('PRIMERA: OBJETO', [
      { text: [
        'EL CONTRATISTA se obliga a prestar, de manera autónoma e independiente, servicios de apoyo operativo en el área de ',
        { text: area, bold: true }, ', con sus propios medios y bajo su responsabilidad.',
      ] },
    ]),

    clause('SEGUNDA: NATURALEZA E INDEPENDENCIA', [
      'El presente contrato es de naturaleza civil/comercial y no genera relación laboral alguna entre las partes. No existe subordinación ni dependencia.',
      'EL CONTRATISTA actúa con plena autonomía técnica, administrativa y financiera, y será el único responsable de su afiliación y pago al Sistema de Seguridad Social Integral (salud, pensión y riesgos laborales) conforme a la Ley 100 de 1993 y normas concordantes.',
    ]),

    clause('TERCERA: PLAZO', [
      { text: [
        'El contrato regirá desde el ',
        { text: fechaInicio, bold: true }, ' hasta el ',
        { text: fechaFin, bold: true },
        ', y podrá prorrogarse por acuerdo escrito entre las partes.',
      ] },
    ]),

    clause('CUARTA: HONORARIOS Y FORMA DE PAGO', [
      { text: [
        'Las partes acuerdan honorarios de referencia mensual por ',
        { text: monto, bold: true },
        ', equivalentes a una tarifa de ', { text: tarifa, bold: true },
        ' por hora efectivamente prestada y aprobada por EL CONTRATANTE.',
      ] },
      'El valor de cada pago se calculará según las horas efectivamente registradas en el período. EL CONTRATISTA presentará la cuenta de cobro o factura correspondiente.',
    ]),

    clause('QUINTA: OBLIGACIONES DEL CONTRATISTA', [
      { ul: [
        'Ejecutar los servicios con calidad, diligencia y buena fe.',
        'Pagar oportunamente sus aportes a la seguridad social.',
        'Cumplir las normas de seguridad e higiene de las instalaciones donde preste el servicio.',
        'Guardar reserva sobre la información del CONTRATANTE.',
      ] },
    ]),

    clause('SEXTA: OBLIGACIONES DEL CONTRATANTE', [
      { ul: [
        'Pagar los honorarios pactados en los plazos acordados.',
        'Suministrar la información necesaria para la ejecución del objeto.',
        'Permitir el acceso a las instalaciones cuando sea necesario.',
      ] },
    ]),

    clause('SÉPTIMA: CONFIDENCIALIDAD',
      'EL CONTRATISTA mantendrá absoluta reserva sobre la información comercial, financiera y operativa del CONTRATANTE, obligación que subsistirá después de terminado el contrato.'),

    clause('OCTAVA: TERMINACIÓN',
      'Cualquiera de las partes podrá dar por terminado el contrato mediante comunicación escrita con una antelación mínima de siete (7) días calendario, sin perjuicio de las obligaciones causadas hasta la fecha de terminación.'),

    clause('NOVENA: LEY APLICABLE Y JURISDICCIÓN',
      'El presente contrato se rige por las leyes de la República de Colombia. Las controversias se someterán a la jurisdicción ordinaria civil competente.'),

    signatureBlock(
      { heading: 'EL CONTRATANTE', lines: [empresa, 'Representante Legal:', repLegal, `${tipoDocRep} N.° ${docRep}`] },
      { heading: 'EL CONTRATISTA', lines: [nombre, `${tipoDoc} N.° ${numDoc}`] },
    ),
  ]

  return buildDoc({ title: `Contrato de Prestación de Servicios - ${nombre}`, author: empresa, content })
}

export function buildColombiaLaboral({ config, employer, employee, params }) {
  const symbol = config.currencySymbol

  const empresa = employer.legal_name
  const nit = employer.tax_id
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
    ? { text: ['El presente contrato es a término indefinido y rige a partir del ', { text: fechaInicio, bold: true }, '.'] }
    : { text: ['El presente contrato es a término fijo, con vigencia desde el ', { text: fechaInicio, bold: true }, ' hasta el ', { text: fechaFin, bold: true }, ', y podrá prorrogarse conforme al artículo 46 del Código Sustantivo del Trabajo.'] }

  const content = [
    { text: 'CONTRATO INDIVIDUAL DE TRABAJO', style: 'docTitle' },
    {
      text: [
        'Entre ', { text: empresa, bold: true },
        ', identificada con NIT N.° ', { text: nit, bold: true },
        ', con domicilio en ', { text: domicilioEmpresa, bold: true },
        ', representada legalmente por ', { text: repLegal, bold: true },
        ', identificado con ', { text: `${tipoDocRep} N.° ${docRep}`, bold: true },
        ', quien en adelante se denominará EL EMPLEADOR; y ',
        { text: nombre, bold: true },
        ', identificado con ', { text: `${tipoDoc} N.° ${numDoc}`, bold: true },
        ', con domicilio en ', { text: domicilio, bold: true },
        ', quien en adelante se denominará EL TRABAJADOR, se ha celebrado el presente Contrato Individual de Trabajo regido por el Código Sustantivo del Trabajo, en los siguientes términos:',
      ],
      style: 'para',
    },

    clause('PRIMERA: OBJETO Y CARGO', [
      { text: ['EL TRABAJADOR se obliga a prestar sus servicios personales, de manera subordinada, desempeñando el cargo de ', { text: cargo, bold: true }, ', así como las funciones conexas y complementarias que le asigne EL EMPLEADOR.'] },
    ]),

    clause('SEGUNDA: NATURALEZA', [
      'La relación es de carácter laboral y se caracteriza por la prestación personal del servicio, la continuada subordinación y el pago de un salario, conforme al artículo 23 del Código Sustantivo del Trabajo.',
      'EL TRABAJADOR será afiliado al Sistema de Seguridad Social Integral (salud, pensión y riesgos laborales) y a la caja de compensación familiar.',
    ]),

    clause('TERCERA: DURACIÓN', [plazo, 'EL TRABAJADOR estará sujeto a un período de prueba de hasta dos (2) meses, conforme a los artículos 76 y siguientes del Código Sustantivo del Trabajo.']),

    clause('CUARTA: SALARIO', [
      { text: ['EL EMPLEADOR pagará al TRABAJADOR un salario mensual de ', { text: sueldo, bold: true }, ', con los descuentos de ley.'] },
      'El salario no podrá ser inferior al Salario Mínimo Legal Mensual Vigente (SMLMV). El pago incluirá el auxilio de transporte cuando corresponda según la ley.',
    ]),

    clause('QUINTA: JORNADA', [
      { text: ['La jornada ordinaria será de hasta ', { text: `${weeklyHours} horas`, bold: true }, ' semanales, sin exceder el máximo legal vigente conforme a la Ley 2101 de 2021, distribuidas según el horario que fije EL EMPLEADOR.'] },
      'El trabajo suplementario, nocturno, dominical y festivo se reconocerá con los recargos legales.',
    ]),

    clause('SEXTA: PRESTACIONES SOCIALES', [
      'EL TRABAJADOR tendrá derecho a las prestaciones sociales legales, entre ellas:',
      { ul: [
        'Prima de servicios.',
        'Cesantías e intereses sobre las cesantías.',
        'Vacaciones remuneradas de quince (15) días hábiles por año.',
        'Dotación de calzado y vestido de labor, cuando corresponda.',
      ] },
    ]),

    clause('SÉPTIMA: OBLIGACIONES DEL TRABAJADOR', [
      { ul: [
        'Cumplir sus funciones con diligencia, lealtad y buena fe.',
        'Observar el Reglamento Interno de Trabajo y las normas de seguridad y salud en el trabajo.',
        'Acatar las órdenes e instrucciones del EMPLEADOR.',
        'Guardar reserva sobre la información de la empresa.',
      ] },
    ]),

    clause('OCTAVA: TERMINACIÓN',
      'El contrato terminará por cualquiera de las causas previstas en los artículos 61 y siguientes del Código Sustantivo del Trabajo, con el reconocimiento de las indemnizaciones a que haya lugar.'),

    clause('NOVENA: LEY APLICABLE Y JURISDICCIÓN',
      'Lo no previsto se regirá por el Código Sustantivo del Trabajo y demás normas laborales de Colombia. Las controversias se someterán a la jurisdicción ordinaria laboral.'),

    signatureBlock(
      { heading: 'EL EMPLEADOR', lines: [empresa, 'Representante Legal:', repLegal, `${tipoDocRep} N.° ${docRep}`] },
      { heading: 'EL TRABAJADOR', lines: [nombre, `${tipoDoc} N.° ${numDoc}`] },
    ),
  ]

  return buildDoc({ title: `Contrato Individual de Trabajo - ${nombre}`, author: empresa, content })
}
