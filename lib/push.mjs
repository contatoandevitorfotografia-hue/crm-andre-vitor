// Avisos para os celulares (Web Push). Quem pede precisa estar logado no CRM: o servidor confere o token de login.
// As chaves VAPID ficam só no servidor (variáveis VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).
import crypto from 'node:crypto';
import webpush from 'web-push';

export const PROJETO_PADRAO = 'crm---2026';
const CERTIFICADOS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const CONTATO = 'mailto:crm@andrevitorfotografia.com.br';
const FOLGA_SEG = 300;

// Certificados do Google que conferem a assinatura do login. Ficam em cache pelo tempo que o Google indicar.
export const cacheCertificados = { valor: null, expira: 0 };

const erro = codigo => Object.assign(new Error(codigo), { codigo });

export async function certificadosGoogle() {
  if (cacheCertificados.valor && cacheCertificados.expira > Date.now()) return cacheCertificados.valor;
  const r = await fetch(CERTIFICADOS_URL);
  if (!r.ok) throw erro('certificados_indisponiveis');
  const valor = await r.json();
  const maxAge = Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') || '')?.[1]) || 3600;
  cacheCertificados.valor = valor;
  cacheCertificados.expira = Date.now() + maxAge * 1000;
  return valor;
}

// Confere o token de login (Firebase Auth): assinatura, projeto, validade e identificador do usuário.
export async function verificaIdToken(token, { projeto = PROJETO_PADRAO, certificados } = {}) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) throw erro('token_invalido');
  let cabecalho;
  let corpo;
  try {
    cabecalho = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));
    corpo = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
  } catch {
    throw erro('token_invalido');
  }
  if (cabecalho.alg !== 'RS256' || typeof cabecalho.kid !== 'string') throw erro('token_invalido');
  const chaves = certificados || await certificadosGoogle();
  const certificado = Object.prototype.hasOwnProperty.call(chaves, cabecalho.kid) ? chaves[cabecalho.kid] : null;
  if (!certificado) throw erro('token_invalido');
  const assinatura = Buffer.from(partes[2], 'base64url');
  if (!crypto.createVerify('RSA-SHA256').update(`${partes[0]}.${partes[1]}`).verify(certificado, assinatura)) {
    throw erro('assinatura_invalida');
  }
  const agora = Math.floor(Date.now() / 1000);
  if (corpo.aud !== projeto || corpo.iss !== `https://securetoken.google.com/${projeto}`) throw erro('projeto_errado');
  if (!(Number(corpo.exp) > agora)) throw erro('expirado');
  if (!(Number(corpo.iat) <= agora + FOLGA_SEG) || !(Number(corpo.auth_time) <= agora + FOLGA_SEG)) throw erro('token_invalido');
  if (typeof corpo.sub !== 'string' || !corpo.sub) throw erro('token_invalido');
  return corpo;
}

// Manda o aviso para cada inscrição. Devolve quantos chegaram e quais inscrições expiraram (para apagar).
export async function enviaParaCelulares(inscricoes, aviso, { chavePublica, chavePrivada }) {
  webpush.setVapidDetails(CONTATO, chavePublica, chavePrivada);
  const mensagem = JSON.stringify(aviso);
  const removidos = [];
  let enviados = 0;
  let falhas = 0;
  await Promise.all(inscricoes.map(async ([id, inscricao]) => {
    try {
      await webpush.sendNotification(inscricao, mensagem);
      enviados++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) removidos.push(id); // inscrição expirada
      else falhas++;
    }
  }));
  return { enviados, falhas, removidos };
}
