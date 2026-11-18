// GET /api/public/contracts/<token>/view — o texto do contrato para a página que a cliente abre (sem senha).
import { cors, tokenDe, fbLer, visaoContrato } from '../../../../lib/contratos.mjs';

export default async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const token = tokenDe(req);
  if (!token) return res.status(404).json({ error: 'Contrato não encontrado no gerador.' });
  try {
    const reg = await fbLer(`contratos26/${token}`);
    if (!reg) return res.status(404).json({ error: 'Contrato não encontrado no gerador.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(visaoContrato(reg));
  } catch (e) {
    return res.status(500).json({ error: 'Não consegui abrir o contrato agora.' });
  }
}
