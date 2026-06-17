// Chile contract templates.
//
//   cl_honorarios_v1 — Contrato de Prestación de Servicios a Honorarios
//                      (Código Civil). Prestador independiente, boleta de
//                      honorarios, sin vínculo de subordinación.
//   cl_trabajo_v1    — Contrato Individual de Trabajo (Código del Trabajo,
//                      DFL N.° 1). Subordinación, remuneración y cotizaciones.

import {
  formatMoney,
  formatSpanishDate,
  resolveMonthlyReference,
  clause,
  signatureBlock,
  buildDoc,
} from './shared.js'

export function buildChileHonorarios({ config, employer, employee, params }) {
  const symbol = config.currencySymbol
  const monthlyRef = resolveMonthlyReference(params, config)

  const empresa = employer.legal_name
  const rut = employer.tax_id
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
    { text: 'CONTRATO DE PRESTACIÓN DE SERVICIOS A HONORARIOS', style: 'docTitle' },
    {
      text: [
        'En Santiago de Chile, comparecen: ',
        { text: empresa, bold: true },
        ', RUT N.° ', { text: rut, bold: true },
        ', con domicilio en ', { text: domicilioEmpresa, bold: true },
        ', representada por ', { text: repLegal, bold: true },
        ', ', { text: `${tipoDocRep} N.° ${docRep}`, bold: true },
        ', en adelante "EL MANDANTE"; y don(ña) ',
        { text: nombre, bold: true },
        ', ', { text: `${tipoDoc} N.° ${numDoc}`, bold: true },
        ', domiciliado(a) en ', { text: domicilio, bold: true },
        ', en adelante "EL PRESTADOR", quienes acuerdan el siguiente contrato de prestación de servicios a honorarios:',
      ],
      style: 'para',
    },

    clause('PRIMERO: OBJETO', [
      { text: ['EL PRESTADOR se obliga a ejecutar, de forma independiente, servicios de apoyo operativo en el área de ', { text: area, bold: true }, ', con sus propios medios y organización.'] },
    ]),

    clause('SEGUNDO: NATURALEZA', [
      'Este contrato se rige por las normas del Código Civil sobre arrendamiento de servicios y NO constituye contrato de trabajo. No existe subordinación ni dependencia.',
      'EL PRESTADOR será responsable de emitir la respectiva boleta de honorarios y de efectuar sus cotizaciones previsionales y de salud conforme a la legislación vigente.',
    ]),

    clause('TERCERO: VIGENCIA',
      { text: ['El contrato regirá desde el ', { text: fechaInicio, bold: true }, ' hasta el ', { text: fechaFin, bold: true }, ', renovable por acuerdo escrito de las partes.'] }),

    clause('CUARTO: HONORARIOS', [
      { text: ['Las partes acuerdan honorarios referenciales mensuales de ', { text: monto, bold: true }, ', equivalentes a una tarifa de ', { text: tarifa, bold: true }, ' por hora efectivamente prestada.'] },
      'El monto a pagar en cada período se determinará según las horas efectivamente registradas, previa emisión de la boleta de honorarios. Sobre el pago se aplicará la retención legal del impuesto cuando corresponda.',
    ]),

    clause('QUINTO: OBLIGACIONES DEL PRESTADOR', [
      { ul: [
        'Ejecutar los servicios con diligencia y buena fe.',
        'Emitir oportunamente la boleta de honorarios electrónica.',
        'Cumplir las normas de higiene y seguridad de las dependencias donde preste servicios.',
        'Mantener reserva sobre la información del MANDANTE.',
      ] },
    ]),

    clause('SEXTO: OBLIGACIONES DEL MANDANTE', [
      { ul: [
        'Pagar los honorarios en los plazos acordados.',
        'Entregar la información necesaria para la ejecución del servicio.',
      ] },
    ]),

    clause('SÉPTIMO: TÉRMINO',
      'Cualquiera de las partes podrá poner término al contrato mediante aviso escrito con a lo menos siete (7) días de anticipación.'),

    clause('OCTAVO: LEY Y JURISDICCIÓN',
      'El presente contrato se rige por las leyes de la República de Chile, sometiéndose las partes a la competencia de los tribunales ordinarios de justicia.'),

    signatureBlock(
      { heading: 'EL MANDANTE', lines: [empresa, repLegal, `${tipoDocRep} N.° ${docRep}`] },
      { heading: 'EL PRESTADOR', lines: [nombre, `${tipoDoc} N.° ${numDoc}`] },
    ),
  ]

  return buildDoc({ title: `Contrato a Honorarios - ${nombre}`, author: empresa, content })
}

export function buildChileTrabajo({ config, employer, employee, params }) {
  const symbol = config.currencySymbol

  const empresa = employer.legal_name
  const rut = employer.tax_id
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
    ? { text: ['El presente contrato es de duración indefinida y rige a partir del ', { text: fechaInicio, bold: true }, '.'] }
    : { text: ['El presente contrato es de plazo fijo, con vigencia desde el ', { text: fechaInicio, bold: true }, ' hasta el ', { text: fechaFin, bold: true }, '.'] }

  const content = [
    { text: 'CONTRATO INDIVIDUAL DE TRABAJO', style: 'docTitle' },
    {
      text: [
        'En Santiago de Chile, entre ',
        { text: empresa, bold: true },
        ', RUT N.° ', { text: rut, bold: true },
        ', con domicilio en ', { text: domicilioEmpresa, bold: true },
        ', representada por ', { text: repLegal, bold: true },
        ', ', { text: `${tipoDocRep} N.° ${docRep}`, bold: true },
        ', en adelante "EL EMPLEADOR"; y don(ña) ',
        { text: nombre, bold: true },
        ', ', { text: `${tipoDoc} N.° ${numDoc}`, bold: true },
        ', domiciliado(a) en ', { text: domicilio, bold: true },
        ', en adelante "EL TRABAJADOR", se conviene el siguiente contrato individual de trabajo, regido por el Código del Trabajo:',
      ],
      style: 'para',
    },

    clause('PRIMERO: NATURALEZA Y CARGO', [
      { text: ['EL TRABAJADOR se obliga a prestar servicios personales bajo subordinación y dependencia del EMPLEADOR, desempeñando el cargo de ', { text: cargo, bold: true }, ', y las funciones inherentes al mismo.'] },
    ]),

    clause('SEGUNDO: LUGAR Y VIGENCIA', [plazo, { text: ['Los servicios se prestarán en el domicilio del EMPLEADOR indicado, o donde éste lo requiera dentro de sus dependencias.'] }, 'Las partes podrán pactar un período de prueba conforme a la ley.']),

    clause('TERCERO: REMUNERACIÓN', [
      { text: ['EL EMPLEADOR pagará al TRABAJADOR una remuneración mensual de ', { text: sueldo, bold: true }, ', de la cual se descontarán las cotizaciones previsionales, de salud y los impuestos legales.'] },
      'La remuneración se pagará por mes vencido y no podrá ser inferior al Ingreso Mínimo Mensual vigente.',
    ]),

    clause('CUARTO: JORNADA', [
      { text: ['La jornada ordinaria será de hasta ', { text: `${weeklyHours} horas`, bold: true }, ' semanales, sin exceder el máximo legal vigente conforme al Código del Trabajo, distribuidas según el horario fijado por EL EMPLEADOR.'] },
      'Las horas extraordinarias se pagarán con el recargo legal correspondiente.',
    ]),

    clause('QUINTO: COTIZACIONES Y BENEFICIOS', [
      'EL EMPLEADOR declarará y pagará las cotizaciones de seguridad social (AFP, salud y seguro de cesantía) conforme a la ley.',
      'EL TRABAJADOR tendrá derecho a feriado anual (vacaciones) y a los demás beneficios establecidos en el Código del Trabajo.',
    ]),

    clause('SEXTO: OBLIGACIONES DEL TRABAJADOR', [
      { ul: [
        'Cumplir sus funciones con diligencia, lealtad y buena fe.',
        'Respetar el Reglamento Interno de Orden, Higiene y Seguridad.',
        'Acatar las instrucciones del EMPLEADOR.',
        'Guardar reserva sobre la información de la empresa.',
      ] },
    ]),

    clause('SÉPTIMO: TÉRMINO',
      'El contrato terminará por las causales establecidas en los artículos 159, 160 y 161 del Código del Trabajo, con los avisos e indemnizaciones que correspondan.'),

    clause('OCTAVO: LEY Y JURISDICCIÓN',
      'Lo no previsto se regirá por el Código del Trabajo de Chile. Las controversias se someterán a los Juzgados de Letras del Trabajo competentes.'),

    {
      text: '\nEl presente contrato se firma en dos (2) ejemplares, quedando uno en poder de cada parte.',
      style: 'para',
    },

    signatureBlock(
      { heading: 'EL EMPLEADOR', lines: [empresa, repLegal, `${tipoDocRep} N.° ${docRep}`] },
      { heading: 'EL TRABAJADOR', lines: [nombre, `${tipoDoc} N.° ${numDoc}`] },
    ),
  ]

  return buildDoc({ title: `Contrato de Trabajo - ${nombre}`, author: empresa, content })
}
