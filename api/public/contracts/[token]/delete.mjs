// POST /api/public/contracts/<token>/delete — exclui um contrato PENDENTE (exige a senha do gerador).
// Contrato já aceito não pode ser excluído. Senha errada responde 401, como o CRM espera.
import { cors, tokenDe, fbLer, fbApagar, senhaConfere } from '../../../../lib/contratos.mjs';

export default async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const senha = senhaConfere(req.headers['x-admin-password']);
  if (senha === 'nao_configurada') return res.status(500).json({ error: 'Senha do gerador não configurada no servidor (variável GERADOR_SENHA_ADMIN).' });
  if (senha !== true) return res.status(401).json({ error: 'invalid_password' });

  const token = tokenDe(req);
  if (!token) return res.status(404).json({ error: 'Contrato não encontrado no gerador.' });
  try {
    const reg = await fbLer(`contratos26/${token}`);
    if (!reg) return res.status(404).json({ error: 'Contrato não encontrado no gerador.' });
    if (reg.status === 'accepted') return res.status(409).json({ error: 'Este contrato já foi aceito e não pode ser excluído.' });
    await fbApagar(`contratos26/${token}`);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Não consegui excluir o contrato agora.' });
  }
}
