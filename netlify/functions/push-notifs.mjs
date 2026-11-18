import webpush from 'web-push';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const FB_DB  = 'https://crm---2026-default-rtdb.firebaseio.com';
// Segredo do banco (Firebase Console → Contas de serviço → Segredos do
// banco de dados) guardado como variável de ambiente no Netlify. Sem ele,
// as regras fechadas do Realtime Database bloqueiam esta função.
const FB_SECRET = process.env.FB_DB_SECRET || '';
const auth = FB_SECRET ? `?auth=${encodeURIComponent(FB_SECRET)}` : '';
const AVISO_MIN = {'na-hora':0,'15min':15,'30min':30,'1h':60,'2h':120,'1dia':1440};
// Os horários digitados nos celulares são de Brasília (UTC-3; o país não tem
// horário de verão desde 2019). Este servidor roda em UTC, então a conta
// precisa dizer o fuso; sem ele, os avisos saíam 3 horas fora do horário.
const FUSO = '-03:00';
const instante = (data, hora) => new Date(`${data}T${hora || '09:00'}:00${FUSO}`).getTime();
// O Firebase devolve uma lista com buracos como objeto: aceita os dois formatos
const comoLista = v => (Array.isArray(v) ? v : Object.values(v || {})).filter(Boolean);

export default async (req, context) => {
  if(!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error('⚠️ Chaves VAPID não configuradas');
    return new Response('Chaves VAPID ausentes', {status:500});
  }

  webpush.setVapidDetails('mailto:crm@andrevitorfotografia.com.br', VAPID_PUBLIC, VAPID_PRIVATE);

  // Buscar lembretes da agenda, itens do Pessoal, marcas de aviso já enviado e assinaturas
  if(!FB_SECRET) console.warn('⚠️ FB_DB_SECRET ausente — o banco vai recusar a leitura');

  const [lemRes, subsRes, pesRes, avisosRes] = await Promise.all([
    fetch(`${FB_DB}/dados26/lem.json${auth}`),
    fetch(`${FB_DB}/pushSubs.json${auth}`),
    fetch(`${FB_DB}/dados26/pessoais.json${auth}`),
    fetch(`${FB_DB}/pessoalAvisos.json${auth}`)
  ]);

  const lembretes = comoLista(await lemRes.json().catch(() => null));
  const subsObj   = await subsRes.json().catch(() => null);
  const subs      = subsObj ? Object.entries(subsObj) : [];
  const pessoais  = comoLista(await pesRes.json().catch(() => null));
  const marcas    = (await avisosRes.json().catch(() => null)) || {};

  console.log(`📋 ${lembretes.length} lembretes | 🗒️ ${pessoais.length} itens do Pessoal | 📱 ${subs.length} dispositivos`);

  if(!subs.length) return new Response('Sem dispositivos inscritos', {status:200});

  // Janela de 8 min (função roda a cada 15 min, com margem de segurança)
  const now      = Date.now();
  const JANELA   = 8 * 60 * 1000;

  const paraEnviar = lembretes.filter(lem => {
    if(!lem?.aviso || lem.aviso === 'nunca' || !lem.data) return false;
    const notifTs = instante(lem.data, lem.hora) - (AVISO_MIN[lem.aviso] ?? 0) * 60000;
    return Math.abs(notifTs - now) <= JANELA;
  });

  // Pendências ("fazer") e consultas do Pessoal: só com data, sem estar feitas e com aviso.
  // A marca em pessoalAvisos/<id> guarda o horário já avisado, então nada se repete.
  const pesParaEnviar = pessoais
    .filter(p => p.id && !p.done && p.data && p.aviso && p.aviso !== 'nunca' && (p.lista === 'fazer' || p.lista === 'consultas'))
    .map(p => ({ p, notifTs: instante(p.data, p.hora) - (AVISO_MIN[p.aviso] ?? 0) * 60000 }))
    .filter(({ p, notifTs }) => Math.abs(notifTs - now) <= JANELA && marcas[p.id] !== notifTs);

  const invalidos = [];
  const marcasNovas = [];
  let enviados = 0;

  for(const lem of paraEnviar) {
    const body    = [lem.hora, lem.local].filter(Boolean).join(' · ') || lem.obs || '';
    const payload = JSON.stringify({title: '🔔 ' + lem.titulo, body});

    for(const [devId, sub] of subs) {
      try {
        await webpush.sendNotification(sub, payload);
        enviados++;
        console.log(`✅ Enviado para ${devId.slice(0,12)}`);
      } catch(e) {
        if(e.statusCode === 404 || e.statusCode === 410) {
          invalidos.push(devId); // assinatura expirada
        } else {
          console.warn(`⚠️ Falha ${e.statusCode} para ${devId.slice(0,12)}`);
        }
      }
    }
  }

  for(const {p, notifTs} of pesParaEnviar) {
    const ehConsulta = p.lista === 'consultas';
    const title   = (ehConsulta ? '🩺 Consulta: ' : '📌 Pendência: ') + p.texto;
    const body    = ehConsulta
      ? [p.hora, p.local].filter(Boolean).join(' · ')
      : 'Para ' + String(p.data).split('-').reverse().join('/');
    const payload = JSON.stringify({title, body});
    let chegou = false;

    for(const [devId, sub] of subs) {
      try {
        await webpush.sendNotification(sub, payload);
        enviados++;
        chegou = true;
      } catch(e) {
        if(e.statusCode === 404 || e.statusCode === 410) {
          invalidos.push(devId);
        } else {
          console.warn(`⚠️ Falha ${e.statusCode} para ${devId.slice(0,12)}`);
        }
      }
    }
    // Só marca como avisado se chegou em algum aparelho; senão tenta de novo na próxima rodada
    if(chegou) marcasNovas.push({id: p.id, notifTs});
  }

  // Grava as marcas dos avisos que chegaram
  if(marcasNovas.length) {
    await Promise.all(marcasNovas.map(m =>
      fetch(`${FB_DB}/pessoalAvisos/${encodeURIComponent(m.id)}.json${auth}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(m.notifTs)
      })
    ));
  }

  // Limpar assinaturas inválidas
  if(invalidos.length) {
    await Promise.all(invalidos.map(devId =>
      fetch(`${FB_DB}/pushSubs/${devId}.json${auth}`, {method:'DELETE'})
    ));
    console.log(`🗑️ ${invalidos.length} assinaturas removidas`);
  }

  const msg = `✅ ${enviados} notificações enviadas | ${paraEnviar.length + pesParaEnviar.length} avisos no horário | ${subs.length} dispositivos`;
  console.log(msg);
  return new Response(msg, {status:200});
};

export const config = {
  schedule: "*/15 * * * *"   // roda a cada 15 minutos
};
