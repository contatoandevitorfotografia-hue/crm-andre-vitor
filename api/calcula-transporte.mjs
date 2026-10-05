// Calcula a distância do local de uma festa até a estação de metrô/CPTM
// mais próxima, e estima o valor do Uber dessa "última perna" (estação →
// local e volta) — usado pra completar automaticamente o orçamento padrão
// de transporte de cada festa nova, que hoje assume que o local já fica
// perto do metrô (não é o caso de festas em cidades mais distantes, tipo
// Osasco).
export const config = { runtime: 'edge' };

const ORS_KEY = process.env.ORS_API_KEY || '';

// Lista das estações de Metrô + CPTM da Grande São Paulo (nome, linha,
// latitude, longitude). Coordenadas aproximadas — o suficiente pra achar
// qual é a mais próxima do endereço da festa; a distância real até ela é
// calculada depois via rota de carro, não em linha reta.
const ESTACOES = [
  // Linha 1-Azul
  ['Tucuruvi','1-Azul',-23.4814,-46.6030],['Parada Inglesa','1-Azul',-23.4903,-46.6115],
  ['Jardim São Paulo-Ayrton Senna','1-Azul',-23.4960,-46.6150],['Santana','1-Azul',-23.5035,-46.6243],
  ['Carandiru','1-Azul',-23.5090,-46.6255],['Portuguesa-Tietê','1-Azul',-23.5150,-46.6260],
  ['Armênia','1-Azul',-23.5230,-46.6295],['Tiradentes','1-Azul',-23.5290,-46.6295],
  ['Luz','1-Azul',-23.5355,-46.6333],['São Bento','1-Azul',-23.5432,-46.6333],
  ['Sé','1-Azul',-23.5503,-46.6335],['Liberdade','1-Azul',-23.5580,-46.6345],
  ['São Joaquim','1-Azul',-23.5635,-46.6330],['Vergueiro','1-Azul',-23.5705,-46.6345],
  ['Paraíso','1-Azul',-23.5745,-46.6400],['Ana Rosa','1-Azul',-23.5807,-46.6383],
  ['Vila Mariana','1-Azul',-23.5890,-46.6345],['Santa Cruz','1-Azul',-23.5950,-46.6355],
  ['Praça da Árvore','1-Azul',-23.6030,-46.6355],['Saúde','1-Azul',-23.6110,-46.6345],
  ['São Judas','1-Azul',-23.6185,-46.6310],['Conceição','1-Azul',-23.6255,-46.6290],
  ['Jabaquara','1-Azul',-23.6440,-46.6420],
  // Linha 2-Verde
  ['Vila Madalena','2-Verde',-23.5460,-46.6900],['Sumaré','2-Verde',-23.5505,-46.6790],
  ['Clínicas','2-Verde',-23.5555,-46.6710],['Consolação','2-Verde',-23.5570,-46.6610],
  ['Trianon-Masp','2-Verde',-23.5615,-46.6555],['Brigadeiro','2-Verde',-23.5670,-46.6495],
  ['Chácara Klabin','2-Verde',-23.5890,-46.6150],['Ipiranga (Alto do Ipiranga)','2-Verde',-23.5945,-46.6060],
  ['Sacomã','2-Verde',-23.6010,-46.5985],['Alto do Ipiranga','2-Verde',-23.5945,-46.6060],
  ['Tamanduateí','2-Verde',-23.6100,-46.5985],['Vila Prudente','2-Verde',-23.5870,-46.5790],
  // Linha 3-Vermelha
  ['Palmeiras-Barra Funda','3-Vermelha',-23.5270,-46.6660],['Marechal Deodoro','3-Vermelha',-23.5315,-46.6490],
  ['Santa Cecília','3-Vermelha',-23.5365,-46.6460],['República','3-Vermelha',-23.5440,-46.6425],
  ['Anhangabaú','3-Vermelha',-23.5460,-46.6370],['Pedro II','3-Vermelha',-23.5475,-46.6250],
  ['Brás','3-Vermelha',-23.5285,-46.6075],['Bresser-Mooca','3-Vermelha',-23.5440,-46.5985],
  ['Belém','3-Vermelha',-23.5390,-46.5890],['Tatuapé','3-Vermelha',-23.5405,-46.5765],
  ['Carrão','3-Vermelha',-23.5440,-46.5660],['Penha','3-Vermelha',-23.5370,-46.5495],
  ['Vila Matilde','3-Vermelha',-23.5405,-46.5375],['Guilhermina-Esperança','3-Vermelha',-23.5420,-46.5265],
  ['Patriarca','3-Vermelha',-23.5420,-46.5155],['Artur Alvim','3-Vermelha',-23.5420,-46.5045],
  ['Corinthians-Itaquera','3-Vermelha',-23.5365,-46.4740],
  // Linha 4-Amarela
  ['Luz (Amarela)','4-Amarela',-23.5355,-46.6333],['República (Amarela)','4-Amarela',-23.5440,-46.6425],
  ['Higienópolis-Mackenzie','4-Amarela',-23.5405,-46.6540],['Paulista','4-Amarela',-23.5570,-46.6625],
  ['Oscar Freire','4-Amarela',-23.5635,-46.6700],['Fradique Coutinho','4-Amarela',-23.5675,-46.6830],
  ['Faria Lima','4-Amarela',-23.5680,-46.6905],['Pinheiros','4-Amarela',-23.5670,-46.7020],
  ['Butantã','4-Amarela',-23.5715,-46.7090],['São Paulo-Morumbi','4-Amarela',-23.5940,-46.7210],
  ['Vila Sônia','4-Amarela',-23.5895,-46.7320],
  // Linha 5-Lilás
  ['Capão Redondo','5-Lilás',-23.6680,-46.7720],['Campo Limpo','5-Lilás',-23.6540,-46.7640],
  ['Vila das Belezas','5-Lilás',-23.6470,-46.7560],['Giovanni Gronchi','5-Lilás',-23.6190,-46.7290],
  ['Santo Amaro','5-Lilás',-23.6545,-46.7120],['Largo Treze','5-Lilás',-23.6415,-46.7090],
  ['Adolfo Pinheiro','5-Lilás',-23.6350,-46.7075],['Alto da Boa Vista','5-Lilás',-23.6280,-46.7010],
  ['Borba Gato','5-Lilás',-23.6215,-46.6950],['Brooklin','5-Lilás',-23.6155,-46.6900],
  ['Campo Belo','5-Lilás',-23.6115,-46.6755],['Eucaliptos','5-Lilás',-23.6080,-46.6718],
  ['Moema','5-Lilás',-23.6020,-46.6675],['AACD-Servidor','5-Lilás',-23.6010,-46.6645],
  ['Hospital São Paulo','5-Lilás',-23.5970,-46.6490],['Santa Cruz (Lilás)','5-Lilás',-23.5950,-46.6355],
  ['Chácara Klabin (Lilás)','5-Lilás',-23.5890,-46.6150],
  // Linha 15-Prata (Monotrilho)
  ['Vila Prudente (Prata)','15-Prata',-23.5870,-46.5790],['Oratório','15-Prata',-23.5765,-46.5700],
  ['São Lucas','15-Prata',-23.5800,-46.5600],['Camilo Haddad','15-Prata',-23.5830,-46.5490],
  ['Vila Tolstói','15-Prata',-23.5885,-46.5420],['Vila União','15-Prata',-23.5920,-46.5350],
  ['Jardim Planalto','15-Prata',-23.5570,-46.4875],['Sapopemba','15-Prata',-23.5990,-46.5230],
  ['São Mateus','15-Prata',-23.6000,-46.4520],
  // CPTM Linha 7-Rubi (Luz → Jundiaí)
  ['Água Branca','7-Rubi',-23.5240,-46.6655],['Lapa','7-Rubi',-23.5280,-46.7000],
  ['Piqueri','7-Rubi',-23.5165,-46.7055],['Pirituba','7-Rubi',-23.4855,-46.7185],
  ['Vila Clarice','7-Rubi',-23.4720,-46.7225],['Jaraguá','7-Rubi',-23.4610,-46.7445],
  ['Perus','7-Rubi',-23.4015,-46.7580],['Caieiras','7-Rubi',-23.3640,-46.7405],
  ['Franco da Rocha','7-Rubi',-23.3310,-46.7260],['Francisco Morato','7-Rubi',-23.2820,-46.7450],
  ['Campo Limpo Paulista','7-Rubi',-23.2070,-46.7905],['Várzea Paulista','7-Rubi',-23.2135,-46.8215],
  ['Jundiaí','7-Rubi',-23.1865,-46.8975],
  // CPTM Linha 8-Diamante (Júlio Prestes → Itapevi/Amador Bueno) — a linha do Osasco
  ['Júlio Prestes','8-Diamante',-23.5355,-46.6395],['Palmeiras-Barra Funda (CPTM)','8-Diamante',-23.5270,-46.6660],
  ['Água Branca (CPTM)','8-Diamante',-23.5240,-46.6655],['Osasco','8-Diamante',-23.5325,-46.7920],
  ['Comandante Sampaio','8-Diamante',-23.5245,-46.8010],['Quitaúna','8-Diamante',-23.5235,-46.8140],
  ['General Miguel Costa','8-Diamante',-23.5185,-46.8295],['Carapicuíba','8-Diamante',-23.5225,-46.8360],
  ['Santa Terezinha','8-Diamante',-23.5245,-46.8445],['Antônio João','8-Diamante',-23.5205,-46.8545],
  ['Barueri','8-Diamante',-23.5110,-46.8760],['Jardim Belval','8-Diamante',-23.5050,-46.8820],
  ['Jardim Silveira','8-Diamante',-23.4990,-46.8880],['Jandira','8-Diamante',-23.5275,-46.9040],
  ['Sagrado Coração','8-Diamante',-23.5320,-46.9090],['Engenheiro Cardoso','8-Diamante',-23.5355,-46.9145],
  ['Itapevi','8-Diamante',-23.5485,-46.9330],
  // CPTM Linha 9-Esmeralda (Osasco/Presidente Altino → Grajaú)
  ['Presidente Altino','9-Esmeralda',-23.5265,-46.7715],['Villa-Lobos-Jaguaré','9-Esmeralda',-23.5390,-46.7355],
  ['Cidade Universitária','9-Esmeralda',-23.5560,-46.7215],['Pinheiros (CPTM)','9-Esmeralda',-23.5670,-46.7020],
  ['Hebraica-Rebouças','9-Esmeralda',-23.5775,-46.6975],['Cidade Jardim','9-Esmeralda',-23.5945,-46.6855],
  ['Vila Olímpia','9-Esmeralda',-23.5955,-46.6815],['Berrini','9-Esmeralda',-23.6075,-46.6940],
  ['Morumbi','9-Esmeralda',-23.6195,-46.6975],['Granja Julieta','9-Esmeralda',-23.6350,-46.7045],
  ['Santo Amaro (CPTM)','9-Esmeralda',-23.6545,-46.7120],['Socorro','9-Esmeralda',-23.6540,-46.7195],
  ['Jurubatuba','9-Esmeralda',-23.6670,-46.7030],['Autódromo','9-Esmeralda',-23.6845,-46.6990],
  ['Interlagos','9-Esmeralda',-23.7025,-46.6935],['Grajaú','9-Esmeralda',-23.7715,-46.6975],
  // CPTM Linha 10-Turquesa (Brás → Rio Grande da Serra)
  ['Brás (CPTM)','10-Turquesa',-23.5285,-46.6075],['Mooca','10-Turquesa',-23.5565,-46.6005],
  ['Ipiranga','10-Turquesa',-23.5880,-46.6080],['Tamanduateí (CPTM)','10-Turquesa',-23.6100,-46.5985],
  ['São Caetano do Sul','10-Turquesa',-23.6180,-46.5660],['Utinga','10-Turquesa',-23.6480,-46.5300],
  ['Prefeito Saladino','10-Turquesa',-23.6650,-46.5235],['Santo André','10-Turquesa',-23.6535,-46.5320],
  ['Capuava','10-Turquesa',-23.6475,-46.4850],['Mauá','10-Turquesa',-23.6675,-46.4620],
  ['Guapituba','10-Turquesa',-23.6960,-46.4610],['Ribeirão Pires','10-Turquesa',-23.7140,-46.4100],
  ['Rio Grande da Serra','10-Turquesa',-23.7445,-46.3935],
  // CPTM Linha 11-Coral (Luz → Estudantes/Mogi)
  ['Tatuapé (CPTM)','11-Coral',-23.5405,-46.5765],['Corinthians-Itaquera (CPTM)','11-Coral',-23.5365,-46.4740],
  ['Dom Bosco','11-Coral',-23.5450,-46.4580],['José Bonifácio','11-Coral',-23.5520,-46.4440],
  ['Guaianases','11-Coral',-23.5435,-46.4195],['Antonio Gianetti Neto','11-Coral',-23.5340,-46.4000],
  ['Ferraz de Vasconcelos','11-Coral',-23.5410,-46.3685],['Poá','11-Coral',-23.5345,-46.3450],
  ['Calmon Viana','11-Coral',-23.5320,-46.3320],['Suzano','11-Coral',-23.5425,-46.3105],
  ['Jundiapeba','11-Coral',-23.5340,-46.2545],['Mogi das Cruzes','11-Coral',-23.5225,-46.1925],
  ['Estudantes','11-Coral',-23.5280,-46.1755],
  // CPTM Linha 12-Safira (Brás → Calmon Viana)
  ['Engenheiro Goulart','12-Safira',-23.5055,-46.4740],['USP Leste','12-Safira',-23.4870,-46.4785],
  ['São Miguel Paulista','12-Safira',-23.4970,-46.4455],['Jardim Helena-Vila Mara','12-Safira',-23.4930,-46.4270],
  ['Itaim Paulista','12-Safira',-23.5000,-46.4015],['Jardim Romano','12-Safira',-23.4870,-46.4120],
  ['Engenheiro Manoel Feio','12-Safira',-23.4990,-46.3765],['Itaquaquecetuba','12-Safira',-23.4870,-46.3485],
  // CPTM Linha 13-Jade (Engenheiro Goulart → Aeroporto Guarulhos)
  ['Aeroporto-Guarulhos','13-Jade',-23.4335,-46.4740],['Guarulhos-Cecap','13-Jade',-23.4555,-46.4770],
];

function toRad(d){return d*Math.PI/180;}
function haversineKm(lat1,lon1,lat2,lon2){
  const R=6371;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function estacaoMaisProxima(lat,lon){
  let melhor=null,menorDist=Infinity;
  for(const [nome,linha,eLat,eLon] of ESTACOES){
    const d=haversineKm(lat,lon,eLat,eLon);
    if(d<menorDist){menorDist=d;melhor={nome,linha,lat:eLat,lon:eLon};}
  }
  return melhor;
}
// Distância que dá pra andar a pé em ~10 minutos (velocidade média de
// caminhada ~4.8km/h). Abaixo disso não vale a pena pedir Uber.
const DISTANCIA_MAX_A_PE_KM=0.8;
// Base + R$/km de um UberX em SP (aproximado) + 15% de margem de segurança
// (a André prefere sempre arredondar pra cima), arredondado pra cima pro
// múltiplo de R$5 mais próximo.
function estimaUber(distanciaKm){
  const base=7,perKm=2.2;
  const bruto=base+perKm*distanciaKm;
  const comMargem=bruto*1.15;
  return Math.ceil(comMargem/5)*5;
}

async function geocodifica(endereco){
  // Quando ela digita só o nome do espaço (sem bairro/cidade), dá pra geocodificar
  // errado — completa com "São Paulo, SP, Brasil" pra ajudar a desambiguar, e usa
  // um raio de 80km ao redor de São Paulo como filtro DURO (não só preferência),
  // já que nenhuma festa dela fica fora da Grande SP / Jacareí.
  const textoCompleto=/s(ã|a)o paulo|,\s*sp\b|brasil/i.test(endereco)?endereco:`${endereco}, São Paulo, SP, Brasil`;
  const url=`https://api.openrouteservice.org/geocode/search?api_key=${encodeURIComponent(ORS_KEY)}&text=${encodeURIComponent(textoCompleto)}&boundary.country=BR&boundary.circle.lon=-46.6333&boundary.circle.lat=-23.5505&boundary.circle.radius=80&focus.point.lon=-46.6333&focus.point.lat=-23.5505&size=1`;
  const res=await fetch(url);
  if(!res.ok)throw new Error('geocode_falhou');
  const data=await res.json();
  const feat=data?.features?.[0];
  if(!feat)return null;
  const [lon,lat]=feat.geometry.coordinates;
  return {lat,lon,label:feat.properties?.label||endereco};
}
// Distância de rota (carro) entre dois pontos — mais realista pro Uber do
// que linha reta. Se a API de rotas falhar, cai pra linha reta × 1.3 (fator
// de correção pra ruas de verdade) em vez de travar o cálculo inteiro.
async function distanciaRota(lat1,lon1,lat2,lon2){
  try{
    const res=await fetch(`https://api.openrouteservice.org/v2/directions/driving-car`,{
      method:'POST',
      headers:{'Authorization':ORS_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({coordinates:[[lon1,lat1],[lon2,lat2]]}),
    });
    if(!res.ok)throw new Error('directions_falhou');
    const data=await res.json();
    const metros=data?.routes?.[0]?.summary?.distance;
    if(typeof metros==='number')return metros/1000;
  }catch(e){/* cai no fallback abaixo */}
  return haversineKm(lat1,lon1,lat2,lon2)*1.3;
}

export default async function handler(req){
  if(req.method!=='POST')return new Response(JSON.stringify({ok:false,error:'method_not_allowed'}),{status:405});
  if(!ORS_KEY)return new Response(JSON.stringify({ok:false,error:'sem_api_key_configurada'}),{status:500});
  let body;
  try{body=await req.json();}catch{return new Response(JSON.stringify({ok:false,error:'body_invalido'}),{status:400});}
  const endereco=(body?.endereco||'').trim();
  if(!endereco)return new Response(JSON.stringify({ok:false,error:'sem_endereco'}),{status:400});
  try{
    const ponto=await geocodifica(endereco);
    if(!ponto)return new Response(JSON.stringify({ok:false,error:'endereco_nao_encontrado'}),{status:200});
    const estacao=estacaoMaisProxima(ponto.lat,ponto.lon);
    const distanciaKm=await distanciaRota(ponto.lat,ponto.lon,estacao.lat,estacao.lon);
    const aPe=distanciaKm<=DISTANCIA_MAX_A_PE_KM;
    const estimativa=aPe?0:estimaUber(distanciaKm);
    return new Response(JSON.stringify({
      ok:true,
      aPe,
      enderecoEncontrado:ponto.label,
      lat:ponto.lat,
      lon:ponto.lon,
      estacao:estacao.nome,
      linha:estacao.linha,
      distanciaKm:parseFloat(distanciaKm.toFixed(1)),
      estimativa,
    }),{status:200,headers:{'Content-Type':'application/json'}});
  }catch(e){
    return new Response(JSON.stringify({ok:false,error:'falha_no_calculo',detalhe:String(e?.message||e)}),{status:200});
  }
}
