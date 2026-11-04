// Funções puras compartilhadas (content scripts, service worker e testes em Node).
// Não acessam DOM nem APIs do Chrome.
(function (g) {
  'use strict';
  const FZ = g.FZ || (g.FZ = {});

  FZ.CONFIG_PADRAO = {
    farmacia: 'Farmácia Municipal de São Leopoldo',
    autoEnviar: true,
    template:
      'Olá, {primeiro_nome}! 👋\n\n' +
      'Aqui é da *{farmacia}*.\n\n' +
      'Os medicamentos que você retirou devem durar até:\n\n' +
      '{lista}\n\n' +
      'Volte para retirar novamente até essas datas. 💊\n\n' +
      '_Mensagem automática, não é necessário responder._',
    linhaLista: '• {medicamento} — até *{termino}*'
  };

  // ---------- texto ----------

  FZ.normalizar = function (s) {
    return String(s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/�/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const CONECTORES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

  FZ.capitalizarNome = function (s) {
    return String(s ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((p, i) => (i > 0 && CONECTORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(' ');
  };

  FZ.primeiroNome = function (s) {
    return FZ.capitalizarNome(s).split(' ')[0] || '';
  };

  // "MARIA DA SILVA (123456) - Sexo: ..." -> "MARIA DA SILVA"
  FZ.nomePacienteLimpo = function (s) {
    return String(s ?? '').split(/\s*\(\d|\s+-\s+/)[0].replace(/\s+/g, ' ').trim();
  };

  // "LOSARTANA 50MG COMP (123.4)" -> "LOSARTANA 50MG COMP"
  FZ.nomeMedicamento = function (s) {
    return String(s ?? '').replace(/\s*\(\s*[\d.,]+\s*\)\s*$/, '').replace(/\s+/g, ' ').trim();
  };

  // ---------- datas ----------

  FZ.dataBR = function (s) {
    const m = String(s ?? '').match(/\d{2}\/\d{2}\/\d{4}/);
    return m ? m[0] : null;
  };

  FZ.parseDataBR = function (s) {
    const m = String(s ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d.getTime()) ? null : d;
  };

  // ---------- telefone ----------

  // Retorna no formato E.164 sem "+": 55 + DDD + número. null se não parecer telefone BR.
  FZ.normalizarTelefone = function (raw) {
    const d = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
    if (d.length === 10 || d.length === 11) return '55' + d;
    return null;
  };

  FZ.formatarTelefone = function (e164) {
    const m = String(e164 ?? '').match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    return m ? `(${m[1]}) ${m[2]}-${m[3]}` : String(e164 ?? '');
  };

  FZ.ehCelular = function (e164) {
    return /^55\d{2}9\d{8}$/.test(String(e164 ?? ''));
  };

  // Procura telefones rotulados no texto do modal "Dados do paciente".
  // Só considera números precedidos de rótulo (Telefone/Celular/Fone/Contato/WhatsApp)
  // para não confundir com CPF/CNS.
  FZ.extrairTelefones = function (texto) {
    const re = /(celular|telefone|fone|contato|whats(?:app)?)([^:\n]{0,30}):\s*((?:\+?55[\s.-]*)?\(?\d{2}\)?[\s.-]*\d{4,5}[\s.-]*\d{4})(?!\d)/gi;
    const vistos = new Set();
    const lista = [];
    let m;
    while ((m = re.exec(String(texto ?? '')))) {
      const numero = FZ.normalizarTelefone(m[3]);
      if (!numero || vistos.has(numero)) continue;
      vistos.add(numero);
      lista.push({ rotulo: (m[1] + m[2]).replace(/\s+/g, ' ').trim(), numero });
    }
    const peso = (t) => (/cel|whats/i.test(t.rotulo) ? 0 : 2) + (FZ.ehCelular(t.numero) ? 0 : 1);
    return lista.sort((a, b) => peso(a) - peso(b));
  };

  // ---------- "Últimas Retiradas de Medicamentos" ----------

  // Padrões sobre o texto normalizado; toleram letras acentuadas perdidas
  // por encoding (ex.: "Término" lido como "T?rmino" -> "trmino").
  const COLUNAS = {
    material: /^(material|medicamento)/,
    lote: /^lote$/,
    validade: /^validade$/,
    qtdBaixa: /^qtd\.? ?baixa$/,
    qtdDevolvida: /^qtd\.? ?devolvida$/,
    prescrito: /^prescrito$/,
    duracao: /^dura.{0,2}o\b/,
    termino: /^t.?rmino$/,
    receita: /^receita$/,
    observacao: /^observa/
  };

  // Recebe as linhas da tabela (cada linha = array com o texto de cada célula)
  // e devolve os blocos de saída: [{ numero, data, dias, itens: [...] }].
  // Estrutura observada no G-MUS:
  //   linha de bloco:     "Nº: 500001  Data: 03/11/2026  Dias: 30  UPS: ..."
  //   linha de cabeçalho: Material/Medicamento | Lote | Validade | ... | Término | ...
  //   linhas de itens.
  FZ.parseUltimasRetiradas = function (linhas) {
    const blocos = [];
    let atual = null;
    let mapa = null;

    for (const celulas of linhas || []) {
      const norm = celulas.map(FZ.normalizar);
      const junto = norm.join(' ');

      const mNum = junto.match(/\bn\S{0,2}\s*:\s*(\d+)/);
      if (mNum && /\bdata\s*:/.test(junto)) {
        const mDias = junto.match(/\bdias\s*:\s*(\d+)/);
        atual = { numero: mNum[1], data: FZ.dataBR(junto), dias: mDias ? mDias[1] : null, itens: [] };
        blocos.push(atual);
        continue;
      }

      if (norm.some((c) => COLUNAS.termino.test(c)) && norm.some((c) => COLUNAS.material.test(c))) {
        mapa = {};
        for (const [chave, re] of Object.entries(COLUNAS)) {
          const idx = norm.findIndex((c) => re.test(c));
          if (idx >= 0) mapa[chave] = idx;
        }
        continue;
      }

      if (mapa && mapa.material != null && celulas.length >= 3) {
        const get = (k) => (mapa[k] != null ? String(celulas[mapa[k]] ?? '').trim() : '');
        const item = {
          material: get('material'),
          lote: get('lote'),
          validade: get('validade'),
          qtdBaixa: get('qtdBaixa'),
          qtdDevolvida: get('qtdDevolvida'),
          prescrito: get('prescrito'),
          duracao: get('duracao'),
          termino: FZ.dataBR(get('termino')),
          receita: get('receita'),
          observacao: get('observacao')
        };
        if (!item.material) continue;
        const num = (s) => parseFloat(String(s).replace(',', '.')) || 0;
        item.devolvido = num(item.qtdDevolvida) > 0 && num(item.qtdDevolvida) >= num(item.qtdBaixa);
        if (!atual) {
          atual = { numero: null, data: null, dias: null, itens: [] };
          blocos.push(atual);
        }
        atual.itens.push(item);
      }
    }
    return blocos.filter((b) => b.itens.length > 0);
  };

  // Escolhe o bloco da saída finalizada. Se não achar o número exato,
  // devolve o mais recente marcado como não-exato (o operador confere no popup).
  FZ.escolherBloco = function (blocos, idSaida) {
    const exato = (blocos || []).find((b) => b.numero && String(b.numero) === String(idSaida));
    if (exato) return { bloco: exato, exato: true };
    return { bloco: (blocos || [])[0] || null, exato: false };
  };

  // ---------- mensagem ----------

  FZ.montarMensagem = function (cfg, dados) {
    const c = Object.assign({}, FZ.CONFIG_PADRAO, cfg || {});
    const itens = [...(dados.itens || [])].sort(
      (a, b) => (FZ.parseDataBR(a.termino) || 0) - (FZ.parseDataBR(b.termino) || 0)
    );
    const lista = itens
      .map((i) =>
        c.linhaLista
          .split('{medicamento}').join(FZ.nomeMedicamento(i.material))
          .split('{termino}').join(i.termino || '')
      )
      .join('\n');
    return c.template
      .split('{primeiro_nome}').join(FZ.primeiroNome(dados.nome))
      .split('{nome}').join(FZ.capitalizarNome(dados.nome))
      .split('{farmacia}').join(c.farmacia)
      .split('{lista}').join(lista)
      .replace(/,\s*!/g, '!');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FZ;
})(typeof globalThis !== 'undefined' ? globalThis : self);
