// POST /api/push-aviso — manda um aviso (título e texto) para os celulares inscritos em pushSubs.
// Só o login do CRM pode pedir: o navegador manda o token de login em Authorization: Bearer.
// As chaves VAPID ficam no servidor e nunca vão para o navegador.
// Variáveis no Vercel: PUSH_UID_PERMITIDO (UID da conta do André no Firebase Auth), VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY e FB_DB_SECRET (já usada pelas outras funções). FIREBASE_PROJECT_ID é opcional.
import { fbLer, fbApagar, lerCorpo } from '../lib/contratos.mjs';
import { verificaIdToken, enviaParaCelulares, PROJETO_PADRAO } from '../lib/push.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const uidPermitido = (process.env.PUSH_UID_PERMITIDO || '').trim();
  const chavePublica = process.env.VAPID_PUBLIC_KEY || '';
  const chavePrivada = process.env.VAPID_PRIVATE_KEY || '';
  if (!uidPermitido || !chavePublica || !chavePrivada) {
    return res.status(500).json({ error: 'Push não configurado no servidor (PUSH_UID_PERMITIDO, VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).' });
  }

  const bearer = /^Bearer (.+)$/.exec(req.headers?.authorization || '');
  if (!bearer) return res.status(401).json({ error: 'Faça login no CRM para enviar avisos.' });
  let login;
  try {
    login = await verificaIdToken(bearer[1], { projeto: process.env.FIREBASE_PROJECT_ID || PROJETO_PADRAO });
  } catch (e) {
    if (e.codigo === 'certificados_indisponiveis') return res.status(503).json({ error: 'Não consegui conferir o login agora. Tente de novo.' });
    return res.status(401).json({ error: 'Login expirado. Atualize a página e tente de novo.' });
  }
  if (login.sub !== uidPermitido) return res.status(403).json({ error: 'Esta conta não pode enviar avisos.' });

  const corpo = lerCorpo(req);
  const titulo = String(corpo.titulo ?? '').trim().slice(0, 120);
  const texto = String(corpo.corpo ?? '').trim().slice(0, 400);
  if (!titulo) return res.status(400).json({ error: 'Informe o título do aviso.' });

  try {
    const inscricoes = Object.entries((await fbLer('pushSubs')) || {}).filter(([, s]) => s?.endpoint);
    const { enviados, falhas, removidos } = await enviaParaCelulares(inscricoes, { title: titulo, body: texto }, { chavePublica, chavePrivada });
    await Promise.all(removidos.map(id => fbApagar(`pushSubs/${id}`)));
    return res.status(200).json({ enviados, falhas, removidos: removidos.length });
  } catch (e) {
    return res.status(500).json({ error: 'Não consegui enviar o aviso agora.' });
  }
}
