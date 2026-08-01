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

export default async (req, context) => {
  if(!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error('⚠️ Chaves VAPID não configuradas');
    return new Response('Chaves VAPID ausentes', {status:500});
  }

  webpush.setVapidDetails('mailto:crm@andrevitorfotografia.com.br', VAPID_PUBLIC, VAPID_PRIVATE);

  // Buscar lembretes e assinaturas do Firebase
  if(!FB_SECRET) console.warn('⚠️ FB_DB_SECRET ausente — o banco vai recusar a leitura');

  const [lemRes, subsRes] = await Promise.all([
    fetch(`${FB_DB}/dados26/lem.json${auth}`),
    fetch(`${FB_DB}/pushSubs.json${auth}`)
  ]);

  const lembretes = await lemRes.json().catch(() => []) || [];
  const subsObj   = await subsRes.json().catch(() => null);
  const subs      = subsObj ? Object.entries(subsObj) : [];

  console.log(`📋 ${Array.isArray(lembretes)?lembretes.length:0} lembretes | 📱 ${subs.length} dispositivos`);

  if(!subs.length) return new Response('Sem dispositivos inscritos', {status:200});

  // Janela de 8 min (função roda a cada 15 min, com margem de segurança)
  const now      = Date.now();
  const JANELA   = 8 * 60 * 1000;

  const paraEnviar = (Array.isArray(lembretes) ? lembretes : []).filter(lem => {
    if(!lem?.aviso || lem.aviso === 'nunca' || !lem.data) return false;
    const evDt     = new Date(lem.data + 'T' + (lem.hora || '09:00'));
    const notifTs  = evDt.getTime() - (AVISO_MIN[lem.aviso] ?? 0) * 60000;
    return Math.abs(notifTs - now) <= JANELA;
  });

  const invalidos = [];
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

  // Limpar assinaturas inválidas
  if(invalidos.length) {
    await Promise.all(invalidos.map(devId =>
      fetch(`${FB_DB}/pushSubs/${devId}.json${auth}`, {method:'DELETE'})
    ));
    console.log(`🗑️ ${invalidos.length} assinaturas removidas`);
  }

  const msg = `✅ ${enviados} notificações enviadas | ${paraEnviar.length} lembretes no horário | ${subs.length} dispositivos`;
  console.log(msg);
  return new Response(msg, {status:200});
};

export const config = {
  schedule: "*/15 * * * *"   // roda a cada 15 minutos
};
