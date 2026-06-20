// Peru contract templates.
//
//   pe_locacion_v1     — Contrato de Locación de Servicios (civil, Código Civil).
//                        Independent contractor, no labor relationship, paid against
//                        an hourly tariff via recibos por honorarios.
//   pe_planilla_v1     — Contrato de Trabajo sujeto a régimen laboral general
//                        (planilla). Subordinated employment under D.S. 003-97-TR
//                        (LPCL), with full statutory benefits (CTS, gratificaciones,
//                        30 días de vacaciones).
//   pe_microempresa_v1 — Contrato de Trabajo de Microempresa (Régimen Laboral
//                        Especial, D.Leg. 1086 / D.S. 013-2013-PRODUCE, REMYPE).
//                        Subordinated employment with reduced benefits: 15 días de
//                        vacaciones, sin CTS ni gratificaciones.

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

// ---- pe_microempresa_v1 ---------------------------------------------------

export function buildPeruMicroempresa({ config, employer, employee, params }) {
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
    ? clause('SÉTIMA: DEL PLAZO DEL CONTRATO', [
        { text: [
          'El presente contrato es de duración indeterminada (a plazo indefinido) y rige a partir del ',
          { text: fechaInicio, bold: true }, '.',
        ] },
      ])
    : clause('SÉTIMA: DEL PLAZO DEL CONTRATO', [
        { text: [
          'El presente contrato se celebra bajo la modalidad de inicio de actividad y tendrá una vigencia desde el ',
          { text: fechaInicio, bold: true }, ' hasta el ',
          { text: fechaFin, bold: true },
          ', fecha en la que concluirá sin necesidad de previo aviso, pudiendo renovarse por acuerdo escrito de las partes dentro de los límites máximos previstos por la ley.',
        ] },
        'La causa objetiva de la presente contratación es la necesidad del EMPLEADOR de cubrir las actividades vinculadas al inicio y desarrollo de su giro de negocio.',
      ])

  const content = [
    { text: 'CONTRATO DE TRABAJO DE MICROEMPRESA', style: 'docTitle' },
    {
      text: [
        'Conste por el presente documento el contrato de trabajo sujeto al Régimen Laboral Especial de la Microempresa que celebran, de una parte, ',
        { text: empresa, bold: true },
        ', identificada con RUC N.° ', { text: ruc, bold: true },
        ', con domicilio en ', { text: domicilioEmpresa, bold: true },
        ', debidamente representada por ', { text: repLegal, bold: true },
        ', identificado(a) con ', { text: `${tipoDocRep} N.° ${docRep}`, bold: true },
        ', a quien en adelante se le denominará EL EMPLEADOR; y, de la otra parte, ',
        { text: nombre, bold: true },
        ', identificado(a) con ', { text: `${tipoDoc} N.° ${numDoc}`, bold: true },
        ', con domicilio en ', { text: domicilio, bold: true },
        ', a quien en adelante se le denominará EL TRABAJADOR; en los términos y condiciones siguientes:',
      ],
      style: 'para',
    },

    clause('PRIMERA: DEL EMPLEADOR Y LA CAUSA OBJETIVA DE LA CONTRATACIÓN', [
      'EL EMPLEADOR es una persona jurídica de derecho privado que se dedica a la actividad económica de servicios gastronómicos, preparación y expendio de alimentos y bebidas.',
      { text: [
        'Por ello, EL EMPLEADOR requiere contar con personal idóneo y calificado, motivo por el cual procede a la contratación de EL TRABAJADOR para que se desempeñe como ',
        { text: cargo, bold: true }, '.',
      ] },
    ]),

    clause('SEGUNDA: DEL OBJETO DEL CONTRATO', [
      { text: [
        'EL EMPLEADOR contrata a EL TRABAJADOR para que se desempeñe como ',
        { text: cargo, bold: true },
        ', de acuerdo con los términos y condiciones señalados en el presente contrato y bajo los lineamientos y directivas impartidas por EL EMPLEADOR durante la relación laboral, asumiendo las obligaciones propias de dicho puesto.',
      ] },
      'EL EMPLEADOR, en ejercicio de las facultades conferidas por el artículo 9° de la Ley de Productividad y Competitividad Laboral (LPCL), se encuentra facultado a efectuar modificaciones razonables en la prestación de los servicios de EL TRABAJADOR, en función de su capacidad y aptitud y de las necesidades del EMPLEADOR, sin que ello signifique menoscabo de categoría y/o remuneración.',
    ]),

    clause('TERCERA: DEL RÉGIMEN LABORAL DE MICROEMPRESA', [
      'Ambas partes declaran conocer que EL EMPLEADOR se encuentra debidamente inscrito en el Registro de la Micro y Pequeña Empresa (REMYPE), por lo que el presente contrato se rige de forma exclusiva bajo los beneficios correspondientes al Régimen Laboral Especial de la Microempresa, regulado por el Decreto Legislativo N.° 1086 y el Texto Único Ordenado aprobado por Decreto Supremo N.° 013-2013-PRODUCE.',
    ]),

    clause('CUARTA: DE LOS BENEFICIOS LABORALES', [
      'En virtud del régimen especial aplicable mencionado en la cláusula anterior, EL TRABAJADOR tiene derecho a:',
      { ul: [
        'Una jornada de trabajo de ocho (8) horas diarias o cuarenta y ocho (48) horas semanales.',
        'Un descanso mínimo de veinticuatro (24) horas consecutivas por semana.',
        'Quince (15) días de descanso vacacional remunerado por cada año completo de servicios.',
        'Afiliación al régimen de salud (SIS Microempresarial o EsSalud, según corresponda) y al sistema de pensiones (ONP o AFP).',
      ] },
      'EL TRABAJADOR acepta y declara conocer que, bajo este régimen, no le corresponde el pago de Compensación por Tiempo de Servicios (CTS) ni Gratificaciones de Fiestas Patrias y Navidad.',
    ]),

    clause('QUINTA: DE LA JORNADA Y HORARIO DE TRABAJO', [
      { text: [
        'EL TRABAJADOR cumplirá una jornada de trabajo de hasta ',
        { text: `${weeklyHours} (${inWords(weeklyHours)}) horas`, bold: true },
        ' semanales, sin exceder el máximo legal de cuarenta y ocho (48) horas semanales, con un tiempo de refrigerio mínimo de cuarenta y cinco (45) minutos, el cual no forma parte de la jornada de trabajo.',
      ] },
      'EL EMPLEADOR está facultado a establecer y variar los turnos y horarios de acuerdo con las necesidades operativas del establecimiento, respetando el descanso semanal obligatorio.',
    ]),

    clause('SEXTA: DE LA REMUNERACIÓN', [
      { text: [
        'Como contraprestación por sus servicios, EL TRABAJADOR percibirá una remuneración mensual de ',
        { text: sueldo, bold: true },
        ', la cual estará sujeta a los descuentos de ley por concepto de pensiones (AFP u ONP) y demás retenciones legales que correspondan.',
      ] },
      'La remuneración no podrá ser inferior a la Remuneración Mínima Vital vigente y será abonada dentro de los plazos de pago establecidos por EL EMPLEADOR.',
    ]),

    plazoClause,

    clause('OCTAVA: DEL PERÍODO DE PRUEBA',
      'En observancia de lo dispuesto por el artículo 10° de la LPCL, las partes convienen que EL TRABAJADOR estará sujeto a un período de prueba de tres (3) meses, contados a partir del inicio de sus labores, durante el cual cualquiera de las partes podrá dar por concluida la relación laboral sin expresión de causa.'),

    clause('NOVENA: OBLIGACIONES DEL TRABAJADOR', [
      'EL TRABAJADOR se obliga a:',
      { ul: [
        'Cumplir con los reglamentos, prácticas y políticas de EL EMPLEADOR, poniendo el mayor cuidado, lealtad y eficiencia en el desempeño de sus funciones.',
        'Ejecutar las labores encomendadas, siendo responsable por el logro de los objetivos previstos para su puesto.',
        'Participar activamente en las reuniones de trabajo, charlas, seminarios o cursos de capacitación que le sean encomendados.',
        'Observar y cumplir las normas de seguridad y salud en el trabajo, así como velar por el orden y la limpieza del área de trabajo.',
        'Colaborar en cualquier otra actividad complementaria afín a su puesto que le sea encomendada por su jefe inmediato.',
      ] },
    ]),

    clause('DÉCIMA: DEL INCUMPLIMIENTO',
      'El incumplimiento total o parcial por parte de EL TRABAJADOR de cualquiera de las obligaciones asumidas en el presente contrato se considerará falta grave y, por lo tanto, causa justificada de despido, conforme a la legislación vigente.'),

    clause('DÉCIMA PRIMERA: DE LA BUENA FE LABORAL',
      'EL TRABAJADOR se obliga a cumplir las normas propias del centro de trabajo y la normativa interna de EL EMPLEADOR, y a poner al servicio de este toda su capacidad y lealtad, comprometiéndose a obrar de buena fe en relación con su empleo, de conformidad con el artículo 9° de la LPCL.'),

    clause('DÉCIMA SEGUNDA: DEL PODER DE DIRECCIÓN',
      'Las partes acuerdan que EL EMPLEADOR podrá, de acuerdo con sus necesidades de funcionamiento y las facultades de dirección establecidas en el artículo 9° de la LPCL, disponer modificaciones razonables en el tiempo, la forma, la modalidad, el lugar y las directrices de trabajo.'),

    clause('DÉCIMA TERCERA: DE LA EXCLUSIVIDAD', [
      'Durante el tiempo que preste sus servicios a EL EMPLEADOR, EL TRABAJADOR no podrá realizar actividades de trabajo para personas o entidades distintas, ni desarrollar actividades similares a las contratadas para otros empleadores, sin la previa autorización por escrito de EL EMPLEADOR.',
      'EL TRABAJADOR deberá dedicar todo su tiempo y atención al cumplimiento diligente y oportuno de sus obligaciones bajo este contrato.',
    ]),

    clause('DÉCIMA CUARTA: DE LA SEGURIDAD Y SALUD EN EL TRABAJO',
      'EL TRABAJADOR asume el compromiso expreso de respetar la política de seguridad y salud en el trabajo establecida por EL EMPLEADOR, conforme a la Ley N.° 29783, dejándose constancia de que este último ha cumplido con informarle las recomendaciones que se detallan en el ANEXO 1, el cual forma parte integrante del presente contrato.'),

    clause('DÉCIMA QUINTA: DEL COMPROMISO DEL TRABAJADOR',
      'EL TRABAJADOR declara conocer y someterse a las disposiciones contenidas en el Reglamento Interno de Trabajo de EL EMPLEADOR, así como a los demás reglamentos, prácticas y políticas vigentes, las cuales se obliga a cumplir fielmente.'),

    clause('DÉCIMA SEXTA: DE LA CONFIDENCIALIDAD', [
      'EL TRABAJADOR se compromete a mantener reserva y confidencialidad absoluta respecto de la información y documentación obtenida con ocasión de su trabajo para EL EMPLEADOR, obligándose a no revelarla ni usarla, en provecho propio o de terceros, para ningún propósito distinto a la ejecución del presente contrato.',
      'Esta obligación subsistirá incluso después de concluida la relación laboral. Al cese, EL TRABAJADOR devolverá toda documentación o material que contenga información confidencial o de propiedad de EL EMPLEADOR.',
    ]),

    clause('DÉCIMA SÉTIMA: DEL TRATAMIENTO DE DATOS PERSONALES', [
      'EL TRABAJADOR autoriza a EL EMPLEADOR a tratar, recolectar, conservar, utilizar y transferir a terceros, dentro o fuera del país, su información personal —incluyendo datos sensibles— para efectos de la gestión de la relación laboral, el manejo de planillas y compensaciones y la toma de decisiones vinculadas al puesto de trabajo.',
      'Dicho tratamiento se efectuará dentro de los márgenes permitidos por la Ley N.° 29733, Ley de Protección de Datos Personales, garantizando EL EMPLEADOR la adopción de las medidas necesarias para su protección. EL TRABAJADOR podrá ejercer sus derechos de acceso, rectificación, cancelación y oposición mediante escrito dirigido a EL EMPLEADOR.',
    ]),

    clause('DÉCIMA OCTAVA: DE LA PROPIEDAD INTELECTUAL',
      'EL TRABAJADOR cede y transfiere a EL EMPLEADOR, en forma total, íntegra y exclusiva, los derechos patrimoniales derivados de los trabajos e informes realizados en cumplimiento del presente contrato. Toda información así creada es de propiedad exclusiva de EL EMPLEADOR, quedando prohibida su reproducción, venta o suministro a terceros sin autorización escrita.'),

    clause('DÉCIMA NOVENA: DE LA DEVOLUCIÓN DE MATERIALES',
      'Al terminar la relación laboral por cualquier causa, EL TRABAJADOR se obliga a entregar de forma inmediata y ordenada a EL EMPLEADOR toda la documentación y cualquier otro bien de su propiedad que tuviera en su poder, así como a trasladar sus funciones a la persona que EL EMPLEADOR designe.'),

    clause('VIGÉSIMA: DE LA LEGISLACIÓN APLICABLE',
      'En todo lo no previsto expresamente en el presente contrato regirán las normas del Régimen Laboral Especial de la Microempresa y, supletoriamente, las demás normas legales vigentes en la República del Perú al momento de producirse el hecho que las regule.'),

    clause('VIGÉSIMA PRIMERA: DEL DOMICILIO Y LA JURISDICCIÓN', [
      'EL TRABAJADOR señala como domicilio, para todos los efectos del presente contrato, el indicado en la parte introductoria de este documento, donde se tendrán por válidamente efectuadas todas las notificaciones que EL EMPLEADOR le remita. Todo cambio de domicilio deberá ser comunicado por escrito dentro de un plazo máximo de siete (7) días hábiles.',
      'Las partes renuncian expresamente al fuero de sus domicilios y se someten a la jurisdicción de los jueces y tribunales del Distrito Judicial de Lima.',
    ]),

    { text: '\nFirmado por las partes, en señal de conformidad, en dos (2) ejemplares de idéntico tenor.', style: 'para' },

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

    { text: 'ANEXO 1', style: 'docTitle', pageBreak: 'before' },
    { text: 'RECOMENDACIONES EN MATERIA DE SEGURIDAD Y SALUD EN EL TRABAJO', style: 'clauseTitle', alignment: 'center' },
    { text: 'EL EMPLEADOR, reconociendo la necesidad de fomentar una cultura de prevención de riesgos laborales, formula a EL TRABAJADOR las siguientes recomendaciones:', style: 'para', margin: [0, 4, 0, 6] },
    { ul: [
      'Cumplir las normas e instrucciones del programa de seguridad y salud en el trabajo.',
      'Recibir y observar el Reglamento Interno de Seguridad y Salud en el Trabajo.',
      'Observar la señalización de seguridad e identificar las zonas seguras y las rutas de evacuación.',
      'Guardar la calma en casos de evacuación por sismo o incendio.',
      'Mantener el área y el puesto de trabajo limpios y ordenados.',
      'Utilizar de manera adecuada los equipos de protección personal proporcionados por EL EMPLEADOR.',
      'Operar únicamente los equipos, maquinarias y herramientas para los que haya recibido capacitación y/o autorización.',
      'Reportar de manera inmediata cualquier incidente, accidente de trabajo o enfermedad profesional.',
      'Someterse a los exámenes médicos que EL EMPLEADOR determine en función del riesgo laboral.',
      'Participar en los simulacros, capacitaciones y campañas de salud organizados por EL EMPLEADOR.',
    ], style: 'para', margin: [10, 2, 0, 4] },
  ]

  return buildDoc({
    title: `Contrato de Trabajo de Microempresa - ${nombre}`,
    author: empresa,
    content,
  })
}
