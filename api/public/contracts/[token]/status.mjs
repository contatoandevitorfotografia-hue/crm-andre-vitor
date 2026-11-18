// GET /api/public/contracts/<token>/status — usado pelo CRM para saber se a cliente já aceitou (sem senha).
import { cors, tokenDe, fbLer, origemDe, visaoStatus } from '../../../../lib/contratos.mjs';

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
    return res.status(200).json(visaoStatus(reg, origemDe(req)));
  } catch (e) {
    return res.status(500).json({ error: 'Não consegui consultar o contrato agora.' });
  }
}
