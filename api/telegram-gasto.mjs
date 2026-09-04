// Recebe mensagens de um bot do Telegram (ex: "emp 50 gasolina" ou
// "pess 30,90 lanche") e lança o gasto direto em Gastos Diários — Empresa
// ou Pessoal — deduzindo também do "Valor no Banco" daquele mês, do mesmo
// jeito que o botão "+ Registrar gasto" do CRM já faz. Assim, ao abrir o
// CRM, o Resumo já aparece descontado, sem precisar digitar nada lá.
export const config = { runtime: 'edge' };

const FB_DB = 'https://crm---2026-default-rtdb.firebaseio.com';
// Segredo do banco (Firebase Console → Contas de serviço → Segredos do
// banco de dados), configurado como variável de ambiente no Vercel.
const FB_SECRET = process.env.FB_DB_SECRET || '';
const auth = FB_SECRET ? `?auth=${encodeURIComponent(FB_SECRET)}` : '';

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
// Chat ID do Telegram autorizado a lançar gastos (o seu). Sem isso
// configurado, qualquer pessoa que descobrir o bot poderia lançar gastos.
const ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID || '';
// Segredo opcional enviado pelo Telegram em todo webhook (configurado via
// setWebhook), pra confirmar que a requisição realmente veio do Telegram.
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

const MESES_FIN = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function mesAtual() {
  return MESES_FIN[new Date().getMonth()];
}
function fmtMoney(v) {
  return 'R$ ' + (v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
// Aceita tanto "50,90" (vírgula decimal, com ou sem ponto de milhar) quanto
// "50.90" (ponto decimal, formato mais comum ao digitar rápido no celular).
function parseValor(s) {
  s = s.trim();
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return parseFloat(s);
}
function parseMensagem(text) {
  const m = text.trim().match(/^(emp(?:resa)?|pess(?:oal)?)\s+([\d.,]+)\s+(.+)$/i);
  if (!m) return null;
  const tipo = /^emp/i.test(m[1]) ? 'emp' : 'pess';
  const valor = parseValor(m[2]);
  const desc = m[3].trim();
  if (!valor || valor <= 0 || !desc) return null;
  return { tipo, valor, desc };
}
async function tgReply(chatId, text) {
  if (!TG_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}
async function getJson(path) {
  const res = await fetch(`${FB_DB}${path}.json${auth}`);
  return res.json().catch(() => null);
}
async function putJson(path, value) {
  await fetch(`${FB_DB}${path}.json${auth}`, { method: 'PUT', body: JSON.stringify(value) });
}

async function lancarGastoEmpresa(mes, entry) {
  const [dd, vgAtual, opCards] = await Promise.all([
    getJson(`/crm26/dd/${mes}`),
    getJson(`/crm26/vg/${mes}`),
    getJson(`/dados26/op`),
  ]);
  let vg = vgAtual;
  if (vg === null || vg === undefined) {
    // Mesma lógica do _initFinVG do CRM: começa pela soma das reservas já
    // recebidas nas festas confirmadas daquele mês.
    vg = (Array.isArray(opCards) ? opCards : []).filter(c => c && c.coluna === 'confirmado'
      && (c.tipoExecucao || 'proprio') !== 'sou-freela' && (c.tipoExecucao || 'proprio') !== 'freelancer'
      && c.dataEvento && MESES_FIN[new Date(c.dataEvento + 'T12:00:00').getMonth()] === mes
    ).reduce((s, c) => s + (c.valorReserva || 0), 0);
  }
  vg = vg - entry.v;
  const lista = Array.isArray(dd) ? dd : [];
  lista.push(entry);
  await Promise.all([putJson(`/crm26/dd/${mes}`, lista), putJson(`/crm26/vg/${mes}`, vg)]);
}
async function lancarGastoPessoal(mes, entry) {
  const [dd, vgAtual] = await Promise.all([
    getJson(`/pess26/dd/${mes}`),
    getJson(`/pess26/vg/${mes}`),
  ]);
  let vg = vgAtual;
  if (vg === null || vg === undefined) vg = 0;
  vg = vg - entry.v;
  const lista = Array.isArray(dd) ? dd : [];
  lista.push(entry);
  await Promise.all([putJson(`/pess26/dd/${mes}`, lista), putJson(`/pess26/vg/${mes}`, vg)]);
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  if (WEBHOOK_SECRET) {
    const hdr = req.headers.get('x-telegram-bot-api-secret-token');
    if (hdr !== WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  }

  let update;
  try { update = await req.json(); } catch (e) { return new Response('ok', { status: 200 }); }
  const msg = update?.message;
  if (!msg?.text) return new Response('ok', { status: 200 });
  const chatId = msg.chat.id;

  if (ALLOWED_CHAT_ID && String(chatId) !== String(ALLOWED_CHAT_ID)) {
    await tgReply(chatId, '🚫 Esse bot é de uso pessoal. Se isso for engano, avisa o André.');
    return new Response('ok', { status: 200 });
  }

  const parsed = parseMensagem(msg.text);
  if (!parsed) {
    await tgReply(chatId, 'Não entendi 🤔\n\nManda assim:\n"emp 50 gasolina" → gasto da Empresa\n"pess 30,90 lanche" → gasto Pessoal (André)');
    return new Response('ok', { status: 200 });
  }

  const mes = mesAtual();
  const entry = { dt: new Date().toISOString().slice(0, 10), v: parsed.valor, l: parsed.desc, p: true };

  try {
    if (!FB_SECRET) throw new Error('FB_DB_SECRET ausente');
    if (parsed.tipo === 'emp') await lancarGastoEmpresa(mes, entry);
    else await lancarGastoPessoal(mes, entry);

    await tgReply(chatId, `✅ Gasto registrado!\n\n${parsed.tipo === 'emp' ? '🏢 Empresa' : '👤 Pessoal (André)'}\n💰 ${fmtMoney(parsed.valor)}\n📝 ${parsed.desc}\n📅 ${mes}\n\nJá desconta do Resumo quando você abrir o CRM.`);
  } catch (e) {
    console.error('Erro ao lançar gasto via Telegram:', e);
    await tgReply(chatId, '⚠️ Deu erro ao salvar no CRM. Tenta de novo em instantes ou lança direto pelo app.');
  }

  return new Response('ok', { status: 200 });
}
