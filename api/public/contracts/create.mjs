// POST /api/public/contracts/create — o CRM manda os dados do evento e a senha do gerador (cabeçalho X-Admin-Password).
import { cors, lerCorpo, limpaDados, CAMPOS_OBRIGATORIOS, renderizaTexto, novoToken, senhaConfere, fbGravar, origemDe, modeloLiberado, VERSAO_TEXTO } from '../../../lib/contratos.mjs';

export default async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const senha = senhaConfere(req.headers['x-admin-password']);
  if (senha === 'nao_configurada') return res.status(500).json({ error: 'Senha do gerador não configurada no servidor (variável GERADOR_SENHA_ADMIN).' });
  if (senha !== true) return res.status(403).json({ error: 'invalid_password' });

  const dados = limpaDados(lerCorpo(req));
  if (!modeloLiberado(dados.contractModel)) return res.status(503).json({ error: 'Este modelo de contrato ainda está em revisão. Nenhum contrato foi criado.' });
  if (!dados.clientSex) return res.status(400).json({ error: 'Informe o sexo da contratante (feminino ou masculino).' });
  const faltando = CAMPOS_OBRIGATORIOS.filter(c => !dados[c]);
  if (faltando.length) return res.status(400).json({ error: 'Campos obrigatórios faltando: ' + faltando.join(', ') });

  try {
    const token = novoToken();
    const reg = {
      token,
      status: 'pending',
      modelo: dados.contractModel,
      versao: VERSAO_TEXTO,
      criadoEm: new Date().toISOString(),
      dados,
      texto: renderizaTexto(dados.contractModel, dados)   // o texto fica congelado no momento da criação
    };
    await fbGravar(`contratos26/${token}`, reg);
    const origem = origemDe(req);
    return res.status(200).json({ token, contractUrl: `${origem}/contrato/${token}`, contractVersion: VERSAO_TEXTO });
  } catch (e) {
    return res.status(500).json({ error: 'Não consegui salvar o contrato. Tente de novo.' });
  }
}
