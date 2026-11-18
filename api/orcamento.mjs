// Recebe os pedidos de orçamento (formulário do Instagram, em /orcamento) e guarda na caixa de entrada
// crm26/orcamentosRecebidos. O CRM (desktop) transforma cada pedido num cartão em Oportunidades.
// Variáveis de ambiente no Vercel: FB_DB_SECRET (já usada pelas outras funções) e, opcionalmente,
// VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY (as mesmas do push do Netlify) para o aviso no celular.
import webpush from 'web-push';

const FB_DB = process.env.FB_DB_URL || 'https://crm---2026-default-rtdb.firebaseio.com';
const FB_SECRET = process.env.FB_DB_SECRET || '';
const auth = FB_SECRET ? `?auth=${encodeURIComponent(FB_SECRET)}` : '';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_CONTATO = process.env.VAPID_CONTATO || 'mailto:crm@andrevitorfotografia.com.br';

// campo → tamanho máximo (evita textos gigantes no banco)
const CAMPOS = {
  respondentName: 80, respondentNickname: 60, respondentPhone: 30, eventType: 60,
  birthdayName: 80, birthdayAge: 10, eventSubject: 120, eventTime: 40,
  eventLocation: 160, guestCount: 40, eventNotes: 1500
};
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function texto(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, erro: 'método' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Campo escondido do formulário: robô costuma preencher. Responde OK sem guardar nada.
  if (body._honey) return res.status(200).json({ ok: true });

  const registro = { origem: 'Instagram', criadoEm: Date.now() };
  for (const [campo, max] of Object.entries(CAMPOS)) registro[campo] = texto(body[campo], max);
  const data = texto(body.eventDate, 10);
  registro.dataEvento = DATA_ISO.test(data) ? data : '';

  if (!registro.respondentName || !registro.respondentPhone) {
    return res.status(400).json({ ok: false, erro: 'nome e telefone são obrigatórios' });
  }

  const r = await fetch(`${FB_DB}/crm26/orcamentosRecebidos.json${auth}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registro),
  });
  if (!r.ok) return res.status(502).json({ ok: false, erro: 'banco' });

  await avisarCelulares(registro);
  return res.status(200).json({ ok: true });
}

// Push para os celulares inscritos (pushSubs). Sem as chaves VAPID, só guarda o pedido.
async function avisarCelulares(registro) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    webpush.setVapidDetails(VAPID_CONTATO, VAPID_PUBLIC, VAPID_PRIVATE);
    const subsRes = await fetch(`${FB_DB}/pushSubs.json${auth}`);
    const subsObj = await subsRes.json().catch(() => null);
    const subs = subsObj ? Object.entries(subsObj) : [];
    const payload = JSON.stringify({
      title: '📩 Novo pedido de orçamento',
      body: `${registro.respondentName} pediu orçamento${registro.eventType ? ` (${registro.eventType})` : ''}`,
    });
    const invalidos = [];
    await Promise.all(subs.map(async ([devId, sub]) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) invalidos.push(devId); // assinatura expirada
        else console.warn('push falhou:', e.statusCode, e.message);
      }
    }));
    await Promise.all(invalidos.map(devId =>
      fetch(`${FB_DB}/pushSubs/${devId}.json${auth}`, { method: 'DELETE' })
    ));
  } catch (e) {
    console.warn('aviso no celular falhou:', e && e.message);
  }
}
