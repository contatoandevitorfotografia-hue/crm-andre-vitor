// Recebe as respostas do questionário pré-festa (formulario-da-festa/formulario.html),
// guarda em respostasFesta/<id do cliente> no Firebase e avisa os celulares inscritos.
// Variáveis de ambiente no Vercel: FB_DB_SECRET (já usada pela função do Telegram),
// VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY (as mesmas do push do Netlify).
import webpush from 'web-push';

const FB_DB = process.env.FB_DB_URL || 'https://crm---2026-default-rtdb.firebaseio.com';
const FB_SECRET = process.env.FB_DB_SECRET || '';
const auth = FB_SECRET ? `?auth=${encodeURIComponent(FB_SECRET)}` : '';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_CONTATO = process.env.VAPID_CONTATO || 'mailto:crm@andrevitorfotografia.com.br';

// id do cliente no CRM: só letras, números, "_" e "-" (evita caminhos estranhos no banco)
const ID_RE = /^[A-Za-z0-9_-]{3,60}$/;
const CAMPOS = ['respondentName', 'respondentRole', 'spouseName', 'importantPeople', 'specialEvent', 'guestPhotos', 'guestPhotoStyle', 'finalNotes'];

function texto(v, max = 1500) {
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

  const cardId = texto(body.cardId, 60);
  if (!ID_RE.test(cardId)) return res.status(400).json({ ok: false, erro: 'link sem cadastro' });

  const registro = { cardId, child: texto(body.child, 80), recebidoEm: Date.now() };
  for (const campo of CAMPOS) registro[campo] = texto(body[campo]);

  const r = await fetch(`${FB_DB}/respostasFesta/${cardId}.json${auth}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registro),
  });
  if (!r.ok) return res.status(502).json({ ok: false, erro: 'banco' });

  await avisarCelulares(registro);
  return res.status(200).json({ ok: true });
}

// Push para os celulares inscritos (pushSubs). Sem as chaves VAPID, só guarda a resposta.
async function avisarCelulares(registro) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    webpush.setVapidDetails(VAPID_CONTATO, VAPID_PUBLIC, VAPID_PRIVATE);
    const subsRes = await fetch(`${FB_DB}/pushSubs.json${auth}`);
    const subsObj = await subsRes.json().catch(() => null);
    const subs = subsObj ? Object.entries(subsObj) : [];
    const payload = JSON.stringify({
      title: '📝 Questionário respondido',
      body: `${registro.child || 'Cliente'}: ${registro.respondentName || 'alguém'} respondeu o questionário pré-festa`,
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
