// PDF do contrato, sem bibliotecas externas: A4, Helvetica (WinAnsi, com acentos), texto quebrado em linhas,
// títulos de seção em negrito, bullets, rodapé com paginação e o registro do aceite quando já foi aceito.
// Entrada: o mesmo objeto que a página pública recebe (visaoContrato). Saída: Buffer com o arquivo.

const PAG_L = 595.28;     // A4 em pontos
const PAG_A = 841.89;
const MARGEM = 56.7;      // 2 cm
const TOPO = 62;          // primeira linha do texto
const BASE = 64;          // limite inferior do texto (o rodapé fica abaixo dele)
const LARG_UTIL = PAG_L - 2 * MARGEM;
const LH = 14.5;          // altura da linha do texto (10,5 pt)
const CABECALHO = /^[A-ZÇÃÕÁÉÍÓÚÂÊÔ ]+:$/;   // mesmo critério da página: "DA REMUNERAÇÃO:"

// Larguras da Helvetica (1/1000 em). Letras acentuadas usam a largura da letra base.
const LARG_ASCII = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333,
  '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
};
const LARG_ESPECIAL = {
  'ß': 611, 'æ': 889, 'Æ': 1000, 'ø': 611, 'Ø': 778, 'ð': 556, 'Ð': 722, 'þ': 556, 'Þ': 667,
  'ª': 370, 'º': 365, '°': 400, ' ': 278, '·': 278, '€': 556, '“': 333, '”': 333, '‘': 222, '’': 222,
  '•': 350, '–': 556, '—': 1000, '…': 1000,
};
// Caracteres do Windows-1252 fora da faixa Latin-1
const WINANSI_EXTRA = {
  '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
};

// Normaliza o texto: o símbolo ● do contrato vira bullet; caracteres de controle somem
const limpa = s => String(s ?? '')
  .normalize('NFC')
  .replace(/●/g, '•')
  .replace(/\r\n?/g, '\n')
  .replace(/\t/g, ' ')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

const larguraGlifo = ch => LARG_ESPECIAL[ch] ?? LARG_ASCII[ch.normalize('NFD')[0]] ?? 556;
const larguraTexto = (s, tam) => {
  let total = 0;
  for (const ch of s) total += larguraGlifo(ch);
  return (total * tam) / 1000;
};

// Bytes do texto em WinAnsi; o que não existe nessa tabela vira "?"
function bytesWinAnsi(s) {
  const saida = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) saida.push(c);
    else saida.push(WINANSI_EXTRA[ch] ?? 0x3f);
  }
  return saida;
}

// String de PDF entre parênteses, só com ASCII (bytes fora dele viram \ddd)
function pdfStr(s) {
  let saida = '(';
  for (const b of bytesWinAnsi(s)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) saida += '\\' + String.fromCharCode(b);
    else if (b >= 0x20 && b < 0x7f) saida += String.fromCharCode(b);
    else saida += '\\' + b.toString(8).padStart(3, '0');
  }
  return saida + ')';
}

// Quebra um parágrafo em linhas que cabem na largura; corta a palavra só se ela for maior que a linha
function quebra(texto, tam, larg) {
  const linhas = [];
  let atual = '';
  for (const palavra of texto.split(' ')) {
    if (!palavra) continue;
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (larguraTexto(teste, tam) <= larg) { atual = teste; continue; }
    if (atual) linhas.push(atual);
    let resto = palavra;
    while (resto && larguraTexto(resto, tam) > larg) {
      let n = 1;
      while (n < resto.length && larguraTexto(resto.slice(0, n + 1), tam) <= larg) n++;
      linhas.push(resto.slice(0, n));
      resto = resto.slice(n);
    }
    atual = resto;
  }
  if (atual || !linhas.length) linhas.push(atual);
  return linhas;
}

const dataHora = iso => (iso
  ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  : '—');

export function contratoEmPdf(visao) {
  const blocos = limpa(visao.texto).split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  let titulo = visao.titulo || 'Contrato';
  if (blocos.length && /^CONTRATO\b/.test(blocos[0]) && blocos[0] === blocos[0].toUpperCase()) titulo = blocos.shift();
  const aceito = visao.status === 'accepted';

  const paginas = [];
  let pag = null;
  let y = 0;
  const abrePagina = () => { pag = { ops: [] }; paginas.push(pag); y = PAG_A - TOPO; };
  const garante = alt => { if (y - alt < BASE) abrePagina(); };
  const escreve = (s, x, yy, tam, negrito, cinza = false) => {
    pag.ops.push(`${cinza ? '0.42' : '0'} g BT /${negrito ? 'F2' : 'F1'} ${tam} Tf 1 0 0 1 ${x.toFixed(2)} ${yy.toFixed(2)} Tm ${pdfStr(s)} Tj ET 0 g`);
  };
  const paragrafo = (s, { negrito = false, tam = 10.5, lh = LH, x = MARGEM, larg = LARG_UTIL, depois = 6, marca = null, cinza = false } = {}) => {
    for (const parte of limpa(s).split('\n').map(p => p.trim()).filter(Boolean)) {
      quebra(parte, tam, larg).forEach((linha, i) => {
        garante(lh);
        if (marca && i === 0) escreve(marca, MARGEM + 6, y, tam, false, cinza);
        escreve(linha, x, y, tam, negrito, cinza);
        y -= lh;
      });
      y -= depois;
    }
  };
  const secao = s => { garante(12 + 2 * LH); y -= 12; paragrafo(s, { negrito: true, depois: 4 }); };

  abrePagina();
  paragrafo(titulo, { negrito: true, tam: 13, lh: 17, depois: 4 });
  paragrafo(aceito ? `Situação: aceito em ${dataHora(visao.aceiteEm)}` : 'Situação: aguardando aceite',
    { tam: 9.5, lh: 13, depois: 14, cinza: true });

  for (const bloco of blocos) {
    if (CABECALHO.test(bloco)) secao(bloco);
    else if (/^•/.test(bloco)) paragrafo(bloco.replace(/^•\s*/, ''), { x: MARGEM + 18, larg: LARG_UTIL - 18, marca: '•', depois: 5 });
    else paragrafo(bloco);
  }

  if (aceito) {
    secao('REGISTRO DO ACEITE');
    paragrafo(`Nome: ${visao.nomeAceite || '—'}`, { depois: 3 });
    paragrafo(`Uso de imagens: ${visao.usoImagem === 'authorized' ? 'Autorizado' : 'Não autorizado'}`, { depois: 3 });
    paragrafo(`Aceito em: ${dataHora(visao.aceiteEm)}`, { depois: 3 });
    paragrafo(`Protocolo: ${visao.protocolo || '—'}`, { depois: 3 });
  }

  const total = paginas.length;
  const rodape = aceito ? `Contrato aceito · protocolo ${visao.protocolo || '—'}` : 'Versão para leitura · o aceite ainda não foi registrado';
  paginas.forEach((p, i) => {
    pag = p;
    escreve(rodape, MARGEM, 30, 8, false, true);
    const direita = `Página ${i + 1} de ${total}`;
    escreve(direita, PAG_L - MARGEM - larguraTexto(direita, 8), 30, 8, false, true);
  });

  // Montagem do arquivo: objetos 1-5 (catálogo, páginas, fontes, informações) e, por página, dicionário + conteúdo
  const idPag = i => 6 + 2 * i;
  const idConteudo = i => 7 + 2 * i;
  const hexTitulo = s => `<FEFF${Buffer.from(String(s), 'utf16le').swap16().toString('hex').toUpperCase()}>`;
  const carimbo = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const posicao = [];
  const objeto = (n, corpo) => { posicao[n] = pdf.length; pdf += `${n} 0 obj\n${corpo}\nendobj\n`; };
  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objeto(2, `<< /Type /Pages /Kids [${paginas.map((_, i) => `${idPag(i)} 0 R`).join(' ')}] /Count ${total} >>`);
  objeto(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objeto(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  objeto(5, `<< /Title ${hexTitulo(titulo)} /Producer (CRM Andre Vitor) /CreationDate (D:${carimbo}Z) >>`);
  paginas.forEach((p, i) => {
    const conteudo = p.ops.join('\n');
    objeto(idPag(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAG_L} ${PAG_A}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /ProcSet [/PDF /Text] >> /Contents ${idConteudo(i)} 0 R >>`);
    objeto(idConteudo(i), `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`);
  });
  const xref = pdf.length;
  const tamanho = 6 + 2 * total;
  let tabela = `xref\n0 ${tamanho}\n0000000000 65535 f \n`;
  for (let n = 1; n < tamanho; n++) tabela += `${String(posicao[n]).padStart(10, '0')} 00000 n \n`;
  pdf += `${tabela}trailer\n<< /Size ${tamanho} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
