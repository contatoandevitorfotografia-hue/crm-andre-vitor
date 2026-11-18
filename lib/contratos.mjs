// Gerador de contratos do CRM (substitui o sistema antigo, hospedado no Lovable).
// Roda no mesmo projeto do CRM no Vercel: /api/public/contracts/* e a página /contrato/<token>.
// Variáveis de ambiente no Vercel:
//   FB_DB_SECRET           (já existe, usada pelas outras funções)
//   GERADOR_SENHA_ADMIN    (a senha que você digita no CRM para criar e excluir contratos)
import crypto from 'node:crypto';

const FB_DB = process.env.FB_DB_URL || 'https://crm---2026-default-rtdb.firebaseio.com';
const FB_SECRET = process.env.FB_DB_SECRET || '';
const auth = FB_SECRET ? `?auth=${encodeURIComponent(FB_SECRET)}` : '';

// Só vira true depois que os textos dos contratos forem conferidos. Enquanto for false,
// o gerador não cria contrato nenhum, para nunca sair contrato com texto provisório.
export const TEXTOS_CONFIRMADOS = false;
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
// PROVISÓRIOS: trocar pelo texto oficial (e depois mudar TEXTOS_CONFIRMADOS para true).
// As chaves {{...}} são preenchidas com os dados do evento na hora de criar o contrato.
export const MODELOS = {
  padrao: {
    titulo: 'Contrato de prestação de serviços fotográficos',
    texto: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS
[TEXTO PROVISÓRIO: substituir pelo texto oficial]

Contratante: {{clienteNome}}, CPF {{clienteCpf}}.
Evento: {{tipoEvento}} de {{nomeCrianca}}, no dia {{dataEvento}}, das {{horaInicio}} às {{horaFim}}.
Local: {{localNome}}, {{localEndereco}}.

1. Serviço: {{plano}}, com cobertura de {{horasCobertura}} horas e tolerância de {{toleranciaMin}} minutos.
2. Entregáveis: {{entregaveis}}. Mínimo de {{minFotos}} fotos tratadas.
3. Prazo de entrega: {{prazoEntregaDias}} dias úteis após o evento.
4. Valor total: {{valorTotal}}. Sinal de {{sinalPercent}}% na contratação.
5. Forma de pagamento: {{formaPagamento}}. {{condicoesPagamento}}

Contrato gerado em {{dataContrato}}.`
  },
  equipe: {
    titulo: 'Contrato de prestação de serviços fotográficos (equipe)',
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
    fotografoEquipe: d.teamPhotographer
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
