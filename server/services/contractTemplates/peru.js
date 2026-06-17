// Peru contract templates.
//
//   pe_locacion_v1 — Contrato de Locación de Servicios (civil, Código Civil).
//                    Independent contractor, no labor relationship, paid against
//                    an hourly tariff via recibos por honorarios.
//   pe_planilla_v1 — Contrato de Trabajo sujeto a régimen laboral (planilla).
//                    Subordinated employment under D.S. 003-97-TR (LPCL), with
//                    a fixed monthly salary and statutory benefits.

import {
  formatMoney,
  formatSpanishDate,
  resolveMonthlyReference,
  clause,
  signatureBlock,
  buildDoc,
} from './shared.js'

const NUM_WORDS = {
  20: 'veinte', 30: 'treinta', 44: 'cuarenta y cuatro', 45: 'cuarenta y cinco',
  46: 'cuarenta y seis', 47: 'cuarenta y siete', 48: 'cuarenta y ocho',
}
const inWords = (n) => NUM_WORDS[n] || String(n)

// ---- pe_locacion_v1 -------------------------------------------------------

export function buildPeruLocacion({ config, employer, employee, params }) {
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

  const content = [
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

    signatureBlock(
      {
        heading: 'EL CONTRATANTE',
        lines: [empresa, 'Representante Legal:', repLegal, `${tipoDocRep} N.° ${docRep}`],
      },
      {
        heading: 'EL LOCADOR',
        lines: [nombre, `${tipoDoc} N.° ${numDoc}`],
      },
    ),
  ]

  return buildDoc({
    title: `Contrato de Locación de Servicios - ${nombre}`,
    author: empresa,
    content,
  })
}

// ---- pe_planilla_v1 -------------------------------------------------------

export function buildPeruPlanilla({ config, employer, employee, params }) {
  const symbol = config.currencySymbol

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

  const cargo = params.position
  const fechaInicio = formatSpanishDate(params.start_date)
  const indefinite = !params.end_date
  const fechaFin = indefinite ? null : formatSpanishDate(params.end_date)
  const sueldo = formatMoney(params.monthly_salary, symbol)
  const weeklyHours = Number(params.weekly_hours) > 0
    ? Math.min(Number(params.weekly_hours), config.maxWeeklyHours)
    : config.maxWeeklyHours

  const plazoClause = indefinite
    ? clause('CUARTA: PLAZO DEL CONTRATO', [
        { text: [
          'El presente contrato es de duración indeterminada (a plazo indefinido) y rige a partir del ',
          { text: fechaInicio, bold: true }, '.',
        ] },
        'EL TRABAJADOR queda sujeto a un período de prueba de tres (3) meses, conforme al artículo 10° del Texto Único Ordenado del Decreto Legislativo N.° 728, durante el cual cualquiera de las partes podrá dar por concluida la relación laboral sin expresión de causa.',
      ])
    : clause('CUARTA: PLAZO DEL CONTRATO', [
        { text: [
          'El presente contrato es de naturaleza sujeta a modalidad y tendrá vigencia desde el ',
          { text: fechaInicio, bold: true }, ' hasta el ',
          { text: fechaFin, bold: true }, ', pudiendo renovarse por acuerdo escrito de las partes dentro de los límites máximos previstos por la ley.',
        ] },
        'EL TRABAJADOR queda sujeto a un período de prueba de tres (3) meses, conforme al artículo 10° del Texto Único Ordenado del Decreto Legislativo N.° 728.',
      ])

  const content = [
    { text: 'CONTRATO DE TRABAJO', style: 'docTitle' },
    {
      text: [
        'Conste por el presente documento el Contrato de Trabajo que celebran de una parte ',
        { text: empresa, bold: true },
        ', identificado con RUC N.° ', { text: ruc, bold: true },
        ', con domicilio en ', { text: domicilioEmpresa, bold: true },
        ', debidamente representado por ', { text: repLegal, bold: true },
        ', identificado con ', { text: `${tipoDocRep} N.° ${docRep}`, bold: true },
        ', a quien en adelante se le denominará EL EMPLEADOR; y de la otra parte ',
        { text: nombre, bold: true },
        ', identificado con ', { text: `${tipoDoc} N.° ${numDoc}`, bold: true },
        ', con domicilio en ', { text: domicilio, bold: true },
        ', a quien en adelante se le denominará EL TRABAJADOR; en los términos y condiciones siguientes:',
      ],
      style: 'para',
    },

    clause('PRIMERA: ANTECEDENTES', [
      'EL EMPLEADOR es una persona jurídica dedicada a actividades del rubro de restaurantes y servicios de alimentación, que requiere incorporar personal a su planilla para el desarrollo de sus operaciones.',
      'EL TRABAJADOR declara reunir las condiciones, aptitudes y experiencia necesarias para desempeñar el cargo objeto del presente contrato.',
    ]),

    clause('SEGUNDA: OBJETO Y CARGO', [
      { text: [
        'Por el presente contrato, EL TRABAJADOR se obliga a prestar servicios personales, subordinados y remunerados a favor del EMPLEADOR, desempeñando el cargo de ',
        { text: cargo, bold: true }, '.',
      ] },
      'EL TRABAJADOR ejecutará las funciones propias de su cargo, así como aquellas conexas o complementarias que le sean asignadas por EL EMPLEADOR dentro del marco de las facultades de dirección del empleador.',
    ]),

    clause('TERCERA: NATURALEZA DE LA RELACIÓN', [
      'Las partes reconocen que el presente contrato es de naturaleza laboral y se encuentra regulado por el Texto Único Ordenado del Decreto Legislativo N.° 728, Ley de Productividad y Competitividad Laboral (D.S. N.° 003-97-TR), y demás normas del régimen laboral de la actividad privada.',
      'La relación se caracteriza por la prestación personal del servicio, la subordinación y el pago de una remuneración.',
      'EL TRABAJADOR será incorporado a la planilla electrónica del EMPLEADOR y registrado ante las entidades correspondientes (SUNAT, EsSalud y el sistema pensionario que elija).',
    ]),

    plazoClause,

    clause('QUINTA: REMUNERACIÓN', [
      { text: [
        'EL EMPLEADOR abonará al TRABAJADOR una remuneración mensual de ',
        { text: sueldo, bold: true },
        ', sujeta a los descuentos de ley (aportes al sistema pensionario, impuesto a la renta de quinta categoría cuando corresponda y demás retenciones legales).',
      ] },
      'La remuneración será abonada mensualmente, dentro de los plazos de pago establecidos por EL EMPLEADOR, mediante depósito en la cuenta bancaria que designe EL TRABAJADOR.',
      'La remuneración no podrá ser inferior a la Remuneración Mínima Vital vigente.',
    ]),

    clause('SEXTA: JORNADA Y HORARIO DE TRABAJO', [
      { text: [
        'EL TRABAJADOR cumplirá una jornada ordinaria de hasta ',
        { text: `${weeklyHours} (${inWords(weeklyHours)}) horas`, bold: true },
        ' semanales, sin exceder el máximo legal de cuarenta y ocho (48) horas semanales establecido por la Constitución y el Decreto Legislativo N.° 854.',
      ] },
      'El horario de trabajo será establecido por EL EMPLEADOR de acuerdo con las necesidades operativas, respetando el descanso semanal obligatorio y el refrigerio correspondiente.',
      'El trabajo en sobretiempo será voluntario y se remunerará con las sobretasas legales vigentes.',
    ]),

    clause('SÉTIMA: BENEFICIOS SOCIALES', [
      'EL TRABAJADOR tendrá derecho a todos los beneficios sociales que le correspondan conforme al régimen laboral de la actividad privada, entre ellos:',
      { ul: [
        'Compensación por Tiempo de Servicios (CTS).',
        'Gratificaciones legales de Fiestas Patrias y Navidad.',
        'Vacaciones anuales de treinta (30) días calendario por cada año completo de servicios.',
        'Asignación familiar, cuando corresponda.',
        'Seguro Social de Salud (EsSalud) y afiliación al sistema pensionario.',
      ] },
    ]),

    clause('OCTAVA: OBLIGACIONES DEL TRABAJADOR', [
      { ul: [
        'Cumplir sus funciones con diligencia, responsabilidad, lealtad y buena fe.',
        'Observar el Reglamento Interno de Trabajo y las normas de seguridad y salud en el trabajo.',
        'Cumplir las disposiciones e instrucciones impartidas por EL EMPLEADOR en ejercicio de su facultad de dirección.',
        'Cuidar los bienes, equipos, herramientas y uniformes que le sean entregados.',
        'Guardar reserva sobre la información del EMPLEADOR a la que tenga acceso.',
      ] },
    ]),

    clause('NOVENA: OBLIGACIONES DEL EMPLEADOR', [
      { ul: [
        'Pagar puntualmente la remuneración y los beneficios sociales.',
        'Registrar al TRABAJADOR en la planilla electrónica y cumplir las obligaciones de seguridad social.',
        'Proporcionar condiciones de trabajo seguras y los implementos necesarios.',
        'Otorgar los descansos y permisos previstos por ley.',
      ] },
    ]),

    clause('DÉCIMA: SEGURIDAD Y SALUD EN EL TRABAJO',
      'EL EMPLEADOR garantizará condiciones que protejan la vida, la salud y el bienestar del TRABAJADOR, conforme a la Ley N.° 29783, Ley de Seguridad y Salud en el Trabajo, y su reglamento. EL TRABAJADOR se obliga a cumplir las medidas de prevención adoptadas.'),

    clause('DÉCIMA PRIMERA: CONFIDENCIALIDAD',
      'EL TRABAJADOR se obliga a mantener absoluta reserva respecto de la información comercial, financiera, operativa y de clientes del EMPLEADOR, obligación que subsistirá incluso después de extinguido el vínculo laboral.'),

    clause('DÉCIMA SEGUNDA: EXTINCIÓN DEL CONTRATO',
      'El contrato de trabajo se extinguirá por cualquiera de las causas previstas en el Texto Único Ordenado del Decreto Legislativo N.° 728, respetándose el procedimiento y las indemnizaciones que la ley establezca según corresponda.'),

    clause('DÉCIMA TERCERA: DOMICILIO',
      'Las partes señalan como domicilios los indicados en la introducción del presente contrato, donde se tendrán por válidas todas las comunicaciones.'),

    clause('DÉCIMA CUARTA: LEGISLACIÓN APLICABLE Y JURISDICCIÓN', [
      'Para todo lo no previsto en el presente contrato, las partes se someten a las disposiciones del régimen laboral de la actividad privada y demás normas aplicables de la República del Perú.',
      'Cualquier controversia será resuelta ante los juzgados y salas laborales del Distrito Judicial competente.',
    ]),

    {
      text: indefinite
        ? '\nFirmado en señal de conformidad, en dos (2) ejemplares de igual tenor.'
        : '\nFirmado en señal de conformidad, en tres (3) ejemplares de igual tenor (uno de los cuales será presentado ante la Autoridad Administrativa de Trabajo cuando corresponda).',
      style: 'para',
    },

    signatureBlock(
      {
        heading: 'EL EMPLEADOR',
        lines: [empresa, 'Representante Legal:', repLegal, `${tipoDocRep} N.° ${docRep}`],
      },
      {
        heading: 'EL TRABAJADOR',
        lines: [nombre, `${tipoDoc} N.° ${numDoc}`],
      },
    ),
  ]

  return buildDoc({
    title: `Contrato de Trabajo - ${nombre}`,
    author: empresa,
    content,
  })
}
