// Gerador de contratos do CRM (substitui o sistema antigo, hospedado no Lovable).
// Roda no mesmo projeto do CRM no Vercel: /api/public/contracts/* e a página /contrato/<token>.
// Variáveis de ambiente no Vercel:
//   FB_DB_SECRET           (já existe, usada pelas outras funções)
//   GERADOR_SENHA_ADMIN    (a senha que você digita no CRM para criar e excluir contratos)
import crypto from 'node:crypto';

const FB_DB = process.env.FB_DB_URL || 'https://crm---2026-default-rtdb.firebaseio.com';
const FB_SECRET = process.env.FB_DB_SECRET || '';
const auth = FB_SECRET ? `?auth=${encodeURIComponent(FB_SECRET)}` : '';

// Cada modelo só cria contrato depois que o texto for conferido (campo `confirmado` em MODELOS).
// Enquanto for false, o gerador não cria contrato desse modelo, para nunca sair texto provisório.
export const VERSAO_TEXTO = 'v1';

export const CAMPOS_OBRIGATORIOS = ['clientName', 'eventDate', 'planName', 'totalAmount', 'contractDate'];
const LIMITES = {
  clientName: 120, clientCpf: 20, childName: 120, eventType: 60, eventDate: 10, startTime: 10, endTime: 10,
  venueName: 160, venueAddress: 300, planName: 160, deliverables: 2000, paymentMethod: 200, paymentTerms: 1000,
  contractDate: 10, teamPhotographer: 120
};
const NUMEROS = ['coverageHours', 'toleranceMinutes', 'minPhotos', 'deliveryBusinessDays', 'totalAmount', 'depositPercent'];
const MODELOS_VALIDOS = ['padrao', 'equipe', 'casamento'];

// ── Textos dos contratos ──────────────────────────────────────────────────────
// As chaves {{...}} são preenchidas com os dados do evento na hora de criar o contrato.
// padrao: texto do contrato de festas (o mesmo do contrato assinado), com os dados do evento nos campos.
// equipe e casamento: ainda PROVISÓRIOS, por isso não criam contrato (confirmado: false).
export const MODELOS = {
  padrao: {
    titulo: 'Contrato de prestação de serviços fotográficos',
    confirmado: false,
    texto: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS

Pelo presente instrumento particular e na melhor forma do direito, de um lado, como:

CONTRATADO: ANDRÉ VITOR ARAÚJO (representante da André Vitor Fotografia), brasileiro, solteiro, fotógrafo/editor de imagens, pessoa física de direito privado inscrito sob nº CPF 413.804.828-0 e portador da cédula de identidade RG 39.736.761-2,

e, de outro lado, como:

CONTRATANTE: {{clienteNome}}, brasileira(o), inscrita(o) sob nº CPF {{clienteCpf}}.

Ajustam a celebração deste contrato de prestação de serviços, que se regerá pelas seguintes cláusulas e condições:

DO OBJETO DO CONTRATO:

Cláusula 1ª. É objeto do presente contrato a prestação de serviços de fotografia, edição de imagens, para os eventos abaixo descritos.

● Produção e edição de fotografias de um evento consistente de um {{tipoEventoMin}} a ser realizada no dia {{dataEventoPonto}}, na {{localEndereco}}, com início às {{horaInicioTexto}} e término no local às {{horaFimTexto}}, com tolerância de {{toleranciaTexto}}, para mais ou para menos além do período ora ajustado.

Parágrafo primeiro - Após assinatura deste contrato, caso seja vontade da CONTRATANTE alterar a data ou horário do evento, ficará a critério da agenda do CONTRATADO a realização do atendimento.

Parágrafo segundo: Não havendo disponibilidade para realização dos serviços contratados em nova data o CONTRATADO fica isento de qualquer responsabilidade pelo cancelamento.

Cláusula 2ª. O presente serviço compreenderá, obrigatoriamente:

Item I: A presença de no mínimo 01 (um) fotógrafo nos locais indicados, podendo o CONTRATADO se fazer substituir por profissionais de sua delegação, ficando ainda responsável pela eventual contratação de assistentes, desde que entenda necessários à fiel execução do serviço, respondendo exclusivamente o fotógrafo pela remuneração desses profissionais;

Item II: A permanência do(s) profissional(is) pelo período mínimo de {{horasCoberturaTexto}} de cobertura, para a cobertura fotográfica;

Item III: A disponibilização das fotos à CONTRATANTE; Entrega de todas as fotos boas selecionadas e tratadas em alta resolução disponibilizadas em uma galeria online, sendo mínimo de {{minFotos}} fotos.

Parágrafo único: Caso por decisão da CONTRATANTE seja solicitada a continuidade do CONTRATADO no local de qualquer evento, se houver disponibilidade do contrato com relação ao tempo de permanência, será devido ao mesmo o valor de hora excedente, no equivalente a 01 (uma) hora/trabalho com base no valor deste contrato.

Cláusula 3ª. O serviço contratado inclui somente tratamento básico de edição e produção digital das fotos, sendo que todas as fotos são editadas e entregues com tratamento de cores, contraste e ajustes técnicos.

Parágrafo único - Para edição específica, como aplicação de mídia destinada a aprimoramento de imagens no que se refere a expressões faciais, sinais, aspectos corporais ou alteração de ambiente, será cobrado valor extra, no montante a ser tratado entre as partes, sempre por escrito, valendo como compromisso mensagens de e-mails, WhatsApps, e outros correlatos.

DA REMUNERAÇÃO:

Cláusula 4ª. O valor desse contrato é de {{valorTotal}} ({{valorExtenso}}).

Parágrafo primeiro: A CONTRATANTE pagará ao CONTRATADO, na mesma data de assinatura do contrato, 50% do valor total do contrato para a reserva da data. O valor restante deverá ser pago em até 05 (cinco) dias antes da data do evento.

Parágrafo segundo: Caso a contratação compreenda confecção de álbum do evento, o valor do mesmo será incluído e pago em conjunto com os serviços acima mencionados.

Parágrafo terceiro: Caso a contratação não compreenda a confecção do álbum do evento, o valor do produto será objeto de contratação adicional em apartado.

Parágrafo quarto: O material contratado somente será entregue a CONTRATANTE após a quitação total do valor deste contrato. Enquanto houver qualquer parcela em aberto, o CONTRATADO não está obrigado a realizar a entrega das fotos, álbuns ou quaisquer materiais contratados.

Cláusula 5ª. Tendo em vista que a confirmação de data e agendamento dos eventos a serem atendidos pelo CONTRATADO a favor da CONTRATANTE implicam em prejuízo quanto a contratação com demais clientes, a desistência ou cancelamento dos serviços deverá ser comunicada ao mesmo com antecedência mínima de 10 (dez) dias.

Parágrafo único: A não observância do prazo acima ajustado implicará no pagamento integral do valor do contrato, além multa pecuniária de 30% (trinta por cento), sem prejuízo de juros de mora de 1% (um por cento) ao mês e correção monetária.

DAS OBRIGAÇÕES DA CONTRATANTE:

Cláusula 6ª. A CONTRATANTE deverá fornecer ao CONTRATADO todas as informações necessárias à realização do serviço, além de conceder livre acesso a este e sua equipe ao local do evento, bem como assegurar a existência de pontos de energia para os equipamentos de fotografia, iluminação e espaço adequado para sua adequada instalação.

DAS OBRIGAÇÕES DO CONTRATADO:

Cláusula 7ª. O CONTRATADO deverá entregar a CONTRATANTE, no prazo de 05 (cinco) dias úteis a partir do evento, um link com as fotos realizadas.

Parágrafo Primeiro: Caso a contratante queira receber o material pelo Correio ou outro transporte, os custos das postagens deverão ser pagos pelo mesmo.

Parágrafo Segundo: Decorrido o prazo de 90 dias corridos o CONTRATADO fica isento da obrigação de qualquer restituição do parágrafo anterior.

Parágrafo Terceiro: O não comparecimento do CONTRATADO implicará no pagamento integral para a CONTRATANTE correspondente ao valor do contrato, além multa pecuniária de 30% (trinta por cento).

Cláusula 8ª. O CONTRATADO não garante a realização de fotos específicas, uma vez que se trata de evento social sobre o qual não possui ingerência na movimentação de pessoas no local.

FORO:

Cláusula 12. As partes elegem o foro da comarca de SÃO PAULO - SP para dirimir quaisquer controvérsias oriundas deste contrato, ficando excluído qualquer outro por mais privilegiado que seja.

E, por acharem em perfeito acordo, em tudo quanto neste instrumento particular foi lavrado, obrigam-se a cumprir o presente contrato, assinando-o em duas vias de igual teor, na presença de 02 (duas) testemunhas.

SÃO PAULO, {{dataContratoExtenso}}.`
  },
  equipe: {
    titulo: 'Contrato de prestação de serviços fotográficos (equipe)',
    confirmado: false,
    texto: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS (EQUIPE)
[TEXTO PROVISÓRIO: substituir pelo texto oficial]

Contratante: {{clienteNome}}, CPF {{clienteCpf}}.
Evento: {{tipoEvento}} de {{nomeCrianca}}, no dia {{dataEvento}}, das {{horaInicio}} às {{horaFim}}.
Local: {{localNome}}, {{localEndereco}}.
Equipe: {{fotografoEquipe}}.

1. Serviço: {{plano}}, com cobertura de {{horasCobertura}} horas e tolerância de {{toleranciaMin}} minutos.
2. Entregáveis: {{entregaveis}}. Mínimo de {{minFotos}} fotos tratadas.
3. Prazo de entrega: {{prazoEntregaDias}} dias úteis após o evento.
4. Valor total: {{valorTotal}}. Sinal de {{sinalPercent}}% na contratação.
5. Forma de pagamento: {{formaPagamento}}. {{condicoesPagamento}}

Contrato gerado em {{dataContrato}}.`
  },
  casamento: {
    titulo: 'Contrato de prestação de serviços fotográficos (casamento)',
    confirmado: false,
    texto: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS (CASAMENTO)
[TEXTO PROVISÓRIO: substituir pelo texto oficial]

Contratante: {{clienteNome}}, CPF {{clienteCpf}}.
Noivos: {{nomeCrianca}}.
Evento: {{tipoEvento}}, no dia {{dataEvento}}, das {{horaInicio}} às {{horaFim}}.
Local: {{localNome}}, {{localEndereco}}.

1. Serviço: {{plano}}, com cobertura de {{horasCobertura}} horas e tolerância de {{toleranciaMin}} minutos.
2. Entregáveis: {{entregaveis}}. Mínimo de {{minFotos}} fotos tratadas.
3. Prazo de entrega: {{prazoEntregaDias}} dias úteis após o evento.
4. Valor total: {{valorTotal}}. Sinal de {{sinalPercent}}% na contratação.
5. Forma de pagamento: {{formaPagamento}}. {{condicoesPagamento}}

Contrato gerado em {{dataContrato}}.`
  }
};

// Libera a criação de contratos de um modelo (só quando o texto dele estiver conferido)
export const modeloLiberado = modelo => MODELOS[modelo]?.confirmado === true;

// ── Números, datas e valores por extenso (para o texto dos contratos) ─────────
const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const HORAS_EXTENSO = ['', '01 (um)', '02 (dois)', '03 (três)', '04 (quatro)', '05 (cinco)', '06 (seis)', '07 (sete)', '08 (oito)', '09 (nove)', '10 (dez)', '11 (onze)', '12 (doze)'];
const MINUTOS_EXTENSO = { 5: 'cinco', 10: 'dez', 15: 'quinze', 20: 'vinte', 30: 'trinta', 45: 'quarenta e cinco', 60: 'sessenta' };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function ateNoventaNove(n) {
  if (n < 20) return UNIDADES[n];
  const u = n % 10;
  return DEZENAS[Math.floor(n / 10)] + (u ? ' e ' + UNIDADES[u] : '');
}
function ateNovecentosNoventaNove(n) {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100), r = n % 100;
  return [c ? CENTENAS[c] : '', r ? ateNoventaNove(r) : ''].filter(Boolean).join(' e ');
}
function inteiroPorExtenso(n) {
  if (n === 0) return 'zero';
  const milhares = Math.floor(n / 1000), resto = n % 1000;
  const partes = [];
  if (milhares) partes.push(milhares === 1 ? 'mil' : `${ateNovecentosNoventaNove(milhares)} mil`);
  if (resto) {
    const liga = milhares && (resto < 100 || resto % 100 === 0) ? 'e ' : '';
    partes.push(liga + ateNovecentosNoventaNove(resto));
  }
  return partes.join(' ');
}
// 1140 → "mil cento e quarenta reais"; 1050.5 → "mil e cinquenta reais e cinquenta centavos"
export function valorPorExtenso(valor) {
  const total = Math.round(Math.max(0, Number(valor) || 0) * 100);
  const reais = Math.floor(total / 100), centavos = total % 100;
  if (reais > 999999) return '';
  let texto = inteiroPorExtenso(reais) + (reais === 1 ? ' real' : ' reais');
  if (centavos) texto += ` e ${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;
  return texto;
}
const dataPonto = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || '');
};
const dataExtenso = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]} DE ${MESES[Number(m[2]) - 1].toUpperCase()} DE ${m[1]}` : String(iso || '');
};
const horaTexto = hhmm => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? `${m[1].padStart(2, '0')}h${m[2]}min` : String(hhmm || '');
};
const horasTexto = n => (Number.isInteger(n) && n >= 1 && n <= 12 ? `${HORAS_EXTENSO[n]} horas` : `${n} horas`);
const toleranciaTexto = n => (MINUTOS_EXTENSO[n] ? `${String(n).padStart(2, '0')} min (${MINUTOS_EXTENSO[n]} minutos)` : `${n} min`);

// ── Utilidades ────────────────────────────────────────────────────────────────
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export const novoToken = () => crypto.randomBytes(18).toString('base64url');
export const novoProtocolo = () =>
  'AV-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
export const tokenValido = t => TOKEN_RE.test(String(t || ''));

export function tokenDe(req) {
  const q = req.query?.token;
  if (q && tokenValido(q)) return String(q);
  const m = /\/contracts\/([^/?#]+)/.exec(req.url || '');
  const t = m ? decodeURIComponent(m[1]) : '';
  return tokenValido(t) ? t : '';
}

// Senha do gerador: compara por HMAC, para não vazar o tamanho nem o conteúdo da senha.
// Devolve true/false, ou 'nao_configurada' se a variável ainda não existe no Vercel.
export function senhaConfere(recebida) {
  const esperada = process.env.GERADOR_SENHA_ADMIN || '';
  if (!esperada) return 'nao_configurada';
  const h = s => crypto.createHmac('sha256', 'gerador-senha').update(String(s)).digest();
  return crypto.timingSafeEqual(h(recebida || ''), h(esperada));
}

export function origemDe(req) {
  if (process.env.GERADOR_URL_PUBLICA) return process.env.GERADOR_URL_PUBLICA.replace(/\/$/, '');
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'crm-andre-vitor.vercel.app';
  return `https://${host}`;
}

export function cors(res, metodos) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', metodos);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
}

export function lerCorpo(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

// ── Banco (Firebase, caminho contratos26/<token>) ─────────────────────────────
const urlFb = caminho => `${FB_DB}/${caminho}.json${auth}`;
export async function fbLer(caminho) {
  const r = await fetch(urlFb(caminho));
  if (!r.ok) throw new Error(`Firebase respondeu ${r.status}`);
  return r.json();
}
export async function fbGravar(caminho, valor) {
  const r = await fetch(urlFb(caminho), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valor) });
  if (!r.ok) throw new Error(`Firebase respondeu ${r.status}`);
}
export async function fbApagar(caminho) {
  const r = await fetch(urlFb(caminho), { method: 'DELETE' });
  if (!r.ok) throw new Error(`Firebase respondeu ${r.status}`);
}

// ── Dados e texto ─────────────────────────────────────────────────────────────
export function limpaDados(body) {
  const d = {};
  for (const [campo, max] of Object.entries(LIMITES)) d[campo] = String(body?.[campo] ?? '').trim().slice(0, max);
  for (const campo of NUMEROS) {
    const n = Number(body?.[campo]);
    d[campo] = Number.isFinite(n) ? n : 0;
  }
  const modelo = String(body?.contractModel || 'padrao');
  d.contractModel = MODELOS_VALIDOS.includes(modelo) ? modelo : 'padrao';
  return d;
}

const dataBR = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
};
const moeda = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');

export function renderizaTexto(modelo, d) {
  const m = MODELOS[modelo] || MODELOS.padrao;
  const v = {
    clienteNome: d.clientName, clienteCpf: d.clientCpf, nomeCrianca: d.childName, tipoEvento: d.eventType,
    dataEvento: dataBR(d.eventDate), horaInicio: d.startTime, horaFim: d.endTime,
    localNome: d.venueName, localEndereco: d.venueAddress, plano: d.planName, entregaveis: d.deliverables,
    horasCobertura: d.coverageHours, toleranciaMin: d.toleranceMinutes, minFotos: d.minPhotos,
    prazoEntregaDias: d.deliveryBusinessDays, valorTotal: moeda(d.totalAmount), sinalPercent: d.depositPercent,
    formaPagamento: d.paymentMethod, condicoesPagamento: d.paymentTerms, dataContrato: dataBR(d.contractDate),
    fotografoEquipe: d.teamPhotographer,
    // campos do texto de festas (padrao)
    tipoEventoMin: String(d.eventType || '').toLowerCase(),
    dataEventoPonto: dataPonto(d.eventDate),
    horaInicioTexto: horaTexto(d.startTime), horaFimTexto: horaTexto(d.endTime),
    horasCoberturaTexto: horasTexto(d.coverageHours),
    toleranciaTexto: toleranciaTexto(d.toleranceMinutes),
    valorExtenso: valorPorExtenso(d.totalAmount),
    dataContratoExtenso: dataExtenso(d.contractDate)
  };
  return m.texto.replace(/\{\{(\w+)\}\}/g, (_, chave) => String(v[chave] ?? ''));
}

// Resposta de status: os nomes são os que o CRM já lê (acceptanceId, summaryPdfUrl...)
export function visaoStatus(reg, origem) {
  const aceito = reg.status === 'accepted';
  return {
    status: reg.status,
    contractVersion: reg.versao,
    contractUrl: `${origem}/contrato/${reg.token}`,
    acceptedAt: reg.aceiteEm || null,
    acceptanceId: reg.protocolo || null,
    imageConsent: reg.usoImagem || null,
    summaryPdfUrl: aceito ? `${origem}/contrato/${reg.token}?impressao=1` : null
  };
}

// O que a página pública do contrato mostra para a cliente
export function visaoContrato(reg) {
  return {
    status: reg.status,
    titulo: (MODELOS[reg.modelo] || MODELOS.padrao).titulo,
    texto: reg.texto,
    versao: reg.versao,
    criadoEm: reg.criadoEm,
    aceiteEm: reg.aceiteEm || null,
    protocolo: reg.protocolo || null,
    usoImagem: reg.usoImagem || null,
    nomeAceite: reg.nomeAceite || null
  };
}
