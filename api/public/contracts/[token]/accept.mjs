// POST /api/public/contracts/<token>/accept — a cliente aceita o contrato (sem senha).
// Guarda nome, CPF (se ela preencher), a escolha de uso de imagens, a data e um número de protocolo.
import { cors, lerCorpo, tokenDe, fbLer, fbGravar, novoProtocolo } from '../../../../lib/contratos.mjs';

export default async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const token = tokenDe(req);
  if (!token) return res.status(404).json({ error: 'Contrato não encontrado no gerador.' });

  const corpo = lerCorpo(req);
  const nome = String(corpo.nome || '').trim().slice(0, 120);
  const cpf = String(corpo.cpf || '').trim().slice(0, 20);
  const usoImagem = corpo.usoImagem;
  if (nome.length < 5) return res.status(400).json({ error: 'Digite seu nome completo para aceitar.' });
  if (!['authorized', 'not_authorized'].includes(usoImagem)) return res.status(400).json({ error: 'Escolha se autoriza ou não o uso de imagens.' });
  if (corpo.confirmo !== true) return res.status(400).json({ error: 'Confirme que leu o contrato para aceitar.' });

  try {
    const reg = await fbLer(`contratos26/${token}`);
    if (!reg) return res.status(404).json({ error: 'Contrato não encontrado no gerador.' });
    if (reg.status === 'accepted') return res.status(409).json({ error: 'Este contrato já foi aceito.' });

    const agora = new Date().toISOString();
    const protocolo = novoProtocolo();
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    const atualizado = {
      ...reg,
      status: 'accepted',
      aceiteEm: agora,
      protocolo,
      nomeAceite: nome,
      cpfAceite: cpf,
      usoImagem,
      aceiteIp: ip,
      aceiteAgente: String(req.headers['user-agent'] || '').slice(0, 200)
    };
    await fbGravar(`contratos26/${token}`, atualizado);
    return res.status(200).json({ ok: true, acceptanceId: protocolo, acceptedAt: agora });
  } catch (e) {
    return res.status(500).json({ error: 'Não consegui registrar o aceite. Tente de novo.' });
  }
}
