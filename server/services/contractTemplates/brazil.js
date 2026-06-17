// Brazil contract templates (Portuguese).
//
//   br_prestacao_v1 — Contrato de Prestação de Serviços (Código Civil).
//                     Prestador autônomo, sem vínculo empregatício.
//   br_clt_v1       — Contrato Individual de Trabalho (CLT, Decreto-Lei
//                     N.º 5.452/1943). Vínculo empregatício, carteira assinada.

import {
  formatMoney,
  formatPortugueseDate,
  resolveMonthlyReference,
  clause,
  signatureBlock,
  buildDoc,
} from './shared.js'

export function buildBrazilPrestacao({ config, employer, employee, params }) {
  const symbol = config.currencySymbol
  const monthlyRef = resolveMonthlyReference(params, config)

  const empresa = employer.legal_name
  const cnpj = employer.tax_id
  const enderecoEmpresa = employer.address
  const repLegal = employer.rep_name
  const tipoDocRep = employer.rep_doc_type
  const docRep = employer.rep_doc_number

  const nome = employee.name
  const tipoDoc = employee.document_type
  const numDoc = employee.document_number
  const endereco = employee.address

  const area = params.area_servicio
  const dataInicio = formatPortugueseDate(params.start_date)
  const dataFim = formatPortugueseDate(params.end_date)
  const tarifa = formatMoney(params.hourly_rate, symbol)
  const valor = formatMoney(monthlyRef, symbol)

  const content = [
    { text: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS', style: 'docTitle' },
    {
      text: [
        'Pelo presente instrumento particular, de um lado ',
        { text: empresa, bold: true },
        ', inscrita no CNPJ sob o n.º ', { text: cnpj, bold: true },
        ', com sede em ', { text: enderecoEmpresa, bold: true },
        ', neste ato representada por ', { text: repLegal, bold: true },
        ', portador do ', { text: `${tipoDocRep} n.º ${docRep}`, bold: true },
        ', doravante denominada CONTRATANTE; e de outro lado ',
        { text: nome, bold: true },
        ', portador do ', { text: `${tipoDoc} n.º ${numDoc}`, bold: true },
        ', residente em ', { text: endereco, bold: true },
        ', doravante denominado CONTRATADO, têm entre si justo e contratado o presente Contrato de Prestação de Serviços, regido pelo Código Civil, mediante as cláusulas seguintes:',
      ],
      style: 'para',
    },

    clause('CLÁUSULA PRIMEIRA — OBJETO', [
      { text: ['O CONTRATADO obriga-se a prestar, de forma autônoma e independente, serviços de apoio operacional na área de ', { text: area, bold: true }, ', com seus próprios meios.'] },
    ]),

    clause('CLÁUSULA SEGUNDA — NATUREZA', [
      'O presente contrato é de natureza civil e NÃO gera vínculo empregatício, nos termos do art. 3.º da CLT, inexistindo subordinação, pessoalidade obrigatória, habitualidade típica de emprego ou exclusividade.',
      'O CONTRATADO é o único responsável pelo recolhimento de seus tributos e contribuições previdenciárias (INSS, ISS e demais) decorrentes desta prestação.',
    ]),

    clause('CLÁUSULA TERCEIRA — PRAZO',
      { text: ['O contrato vigorará de ', { text: dataInicio, bold: true }, ' a ', { text: dataFim, bold: true }, ', podendo ser renovado mediante acordo escrito entre as partes.'] }),

    clause('CLÁUSULA QUARTA — REMUNERAÇÃO', [
      { text: ['As partes ajustam remuneração de referência mensal de ', { text: valor, bold: true }, ', equivalente à tarifa de ', { text: tarifa, bold: true }, ' por hora efetivamente prestada.'] },
      'O valor de cada período será apurado conforme as horas efetivamente registradas, mediante apresentação da respectiva nota fiscal / recibo pelo CONTRATADO.',
    ]),

    clause('CLÁUSULA QUINTA — OBRIGAÇÕES DO CONTRATADO', [
      { ul: [
        'Executar os serviços com diligência, zelo e boa-fé.',
        'Emitir os documentos fiscais cabíveis.',
        'Cumprir as normas de higiene e segurança dos locais onde prestar serviços.',
        'Manter sigilo sobre as informações da CONTRATANTE.',
      ] },
    ]),

    clause('CLÁUSULA SEXTA — OBRIGAÇÕES DA CONTRATANTE', [
      { ul: [
        'Efetuar os pagamentos nos prazos ajustados.',
        'Fornecer as informações necessárias à execução dos serviços.',
      ] },
    ]),

    clause('CLÁUSULA SÉTIMA — RESCISÃO',
      'Qualquer das partes poderá rescindir o contrato mediante aviso escrito com antecedência mínima de sete (7) dias.'),

    clause('CLÁUSULA OITAVA — FORO',
      'Fica eleito o foro da comarca da sede da CONTRATANTE para dirimir as questões oriundas deste contrato, regido pelas leis da República Federativa do Brasil.'),

    signatureBlock(
      { heading: 'CONTRATANTE', lines: [empresa, repLegal, `${tipoDocRep} n.º ${docRep}`] },
      { heading: 'CONTRATADO', lines: [nome, `${tipoDoc} n.º ${numDoc}`] },
      'Assinatura',
    ),
  ]

  return buildDoc({ title: `Contrato de Prestação de Serviços - ${nome}`, author: empresa, content })
}

export function buildBrazilClt({ config, employer, employee, params }) {
  const symbol = config.currencySymbol

  const empresa = employer.legal_name
  const cnpj = employer.tax_id
  const enderecoEmpresa = employer.address
  const repLegal = employer.rep_name
  const tipoDocRep = employer.rep_doc_type
  const docRep = employer.rep_doc_number

  const nome = employee.name
  const tipoDoc = employee.document_type
  const numDoc = employee.document_number
  const endereco = employee.address

  const cargo = params.position
  const dataInicio = formatPortugueseDate(params.start_date)
  const indeterminado = !params.end_date
  const dataFim = indeterminado ? null : formatPortugueseDate(params.end_date)
  const salario = formatMoney(params.monthly_salary, symbol)
  const weeklyHours = Number(params.weekly_hours) > 0
    ? Math.min(Number(params.weekly_hours), config.maxWeeklyHours)
    : config.maxWeeklyHours

  const prazo = indeterminado
    ? { text: ['O presente contrato é por prazo indeterminado, com início em ', { text: dataInicio, bold: true }, ', sujeitando-se o empregado a contrato de experiência de até 90 (noventa) dias, nos termos do art. 445, parágrafo único, da CLT.'] }
    : { text: ['O presente contrato é por prazo determinado, vigorando de ', { text: dataInicio, bold: true }, ' a ', { text: dataFim, bold: true }, ', nos termos do art. 443 da CLT.'] }

  const content = [
    { text: 'CONTRATO INDIVIDUAL DE TRABALHO', style: 'docTitle' },
    {
      text: [
        'Pelo presente instrumento, de um lado ',
        { text: empresa, bold: true },
        ', inscrita no CNPJ sob o n.º ', { text: cnpj, bold: true },
        ', com sede em ', { text: enderecoEmpresa, bold: true },
        ', neste ato representada por ', { text: repLegal, bold: true },
        ', portador do ', { text: `${tipoDocRep} n.º ${docRep}`, bold: true },
        ', doravante denominada EMPREGADORA; e de outro lado ',
        { text: nome, bold: true },
        ', portador do ', { text: `${tipoDoc} n.º ${numDoc}`, bold: true },
        ', residente em ', { text: endereco, bold: true },
        ', doravante denominado EMPREGADO, celebram o presente Contrato Individual de Trabalho, regido pela Consolidação das Leis do Trabalho (CLT), mediante as cláusulas seguintes:',
      ],
      style: 'para',
    },

    clause('CLÁUSULA PRIMEIRA — FUNÇÃO', [
      { text: ['O EMPREGADO é admitido para exercer a função de ', { text: cargo, bold: true }, ', comprometendo-se a executar as tarefas inerentes ao cargo e as atividades correlatas determinadas pela EMPREGADORA.'] },
    ]),

    clause('CLÁUSULA SEGUNDA — NATUREZA E REGISTRO', [
      'A relação é de emprego, caracterizada por pessoalidade, subordinação, habitualidade e onerosidade, nos termos dos arts. 2.º e 3.º da CLT.',
      'A EMPREGADORA procederá à anotação na Carteira de Trabalho e Previdência Social (CTPS) e ao registro do empregado, recolhendo o FGTS e as contribuições previdenciárias devidas.',
    ]),

    clause('CLÁUSULA TERCEIRA — PRAZO', prazo),

    clause('CLÁUSULA QUARTA — REMUNERAÇÃO', [
      { text: ['O EMPREGADO perceberá salário mensal de ', { text: salario, bold: true }, ', com os descontos legais (INSS, IRRF quando aplicável e demais).'] },
      'O salário será pago até o 5.º dia útil do mês subsequente ao vencido e não será inferior ao salário mínimo ou ao piso da categoria.',
    ]),

    clause('CLÁUSULA QUINTA — JORNADA', [
      { text: ['A jornada será de até ', { text: `${weeklyHours} horas`, bold: true }, ' semanais, não excedendo o limite constitucional de 44 (quarenta e quatro) horas, conforme horário definido pela EMPREGADORA.'] },
      'As horas extraordinárias serão remuneradas com o adicional legal mínimo de 50% (cinquenta por cento).',
    ]),

    clause('CLÁUSULA SEXTA — BENEFÍCIOS E DIREITOS', [
      'O EMPREGADO fará jus aos direitos assegurados pela CLT e pela Constituição Federal, entre eles:',
      { ul: [
        'Férias anuais remuneradas acrescidas de 1/3.',
        '13.º salário.',
        'Repouso semanal remunerado.',
        'Depósitos do FGTS.',
        'Demais benefícios previstos em convenção ou acordo coletivo.',
      ] },
    ]),

    clause('CLÁUSULA SÉTIMA — OBRIGAÇÕES DO EMPREGADO', [
      { ul: [
        'Cumprir suas funções com diligência, lealdade e boa-fé.',
        'Observar o regulamento interno e as normas de segurança e medicina do trabalho.',
        'Acatar as ordens e instruções da EMPREGADORA.',
        'Manter sigilo sobre as informações da empresa.',
      ] },
    ]),

    clause('CLÁUSULA OITAVA — RESCISÃO',
      'A rescisão observará as hipóteses e verbas previstas na CLT, com a quitação das parcelas rescisórias cabíveis.'),

    clause('CLÁUSULA NONA — FORO',
      'As partes elegem o foro da Justiça do Trabalho competente para dirimir eventuais controvérsias, nos termos da legislação trabalhista brasileira.'),

    {
      text: '\nE, por estarem assim justos e contratados, firmam o presente em 2 (duas) vias de igual teor.',
      style: 'para',
    },

    signatureBlock(
      { heading: 'EMPREGADORA', lines: [empresa, repLegal, `${tipoDocRep} n.º ${docRep}`] },
      { heading: 'EMPREGADO', lines: [nome, `${tipoDoc} n.º ${numDoc}`] },
      'Assinatura',
    ),
  ]

  return buildDoc({ title: `Contrato Individual de Trabalho - ${nome}`, author: empresa, content })
}
