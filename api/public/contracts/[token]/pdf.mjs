// GET /api/public/contracts/<token>/pdf — o contrato em PDF para baixar (sem senha, como a página pública).
import { cors, tokenDe, fbLer, visaoContrato } from '../../../../lib/contratos.mjs';
import { contratoEmPdf } from '../../../../lib/pdf.mjs';

// Nome do arquivo sem acento e sem espaço: contrato-maria-da-silva-2026-12-20.pdf
const parte = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
const nomeArquivo = reg => `${['contrato', parte(reg.dados?.clientName), parte(reg.dados?.eventDate)].filter(Boolean).join('-')}.pdf`;

export default async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const token = tokenDe(req);
  if (!token) return res.status(404).json({ error: 'Contrato não encontrado no gerador.' });
  try {
    const reg = await fbLer(`contratos26/${token}`);
    if (!reg) return res.status(404).json({ error: 'Contrato não encontrado no gerador.' });
    const pdf = contratoEmPdf(visaoContrato(reg));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo(reg)}"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).end(pdf);
  } catch (e) {
    return res.status(500).json({ error: 'Não consegui gerar o PDF agora.' });
  }
}
