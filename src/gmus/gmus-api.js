// Leitura de dados do G-MUS a partir do content script (mesma origem, usa o
// cookie de sessão do usuário logado). SOMENTE rotas de leitura da allowlist.
(function (g) {
  'use strict';
  const FZ = g.FZ;

  const ROTAS_PERMITIDAS = [
    { metodo: 'GET', re: /^\/estoque\/saidas\/editar\/id\/\d+$/ },
    { metodo: 'POST', re: /^\/estoque\/saidas\/ultimasretiradas$/ },
    { metodo: 'GET', re: /^\/cadastro\/usuariogmss\/dadospaciente\/id\/\d+$/ }
  ];

  class SessaoExpirada extends Error {}
  FZ.SessaoExpirada = SessaoExpirada;

  async function decodificar(resp) {
    const buf = await resp.arrayBuffer();
    const ct = resp.headers.get('content-type') || '';
    const m = ct.match(/charset=([\w-]+)/i);
    if (m) {
      try { return new TextDecoder(m[1]).decode(buf); } catch (_) { /* cai no fallback */ }
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch (_) {
      return new TextDecoder('iso-8859-1').decode(buf);
    }
  }

  async function gmusFetch(metodo, caminho, dados) {
    const permitido = ROTAS_PERMITIDAS.some((r) => r.metodo === metodo && r.re.test(caminho));
    if (!permitido) throw new Error(`Rota bloqueada pela extensão: ${metodo} ${caminho}`);

    const opts = {
      method: metodo,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    };
    if (metodo === 'POST') {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      opts.body = new URLSearchParams(dados || {}).toString();
    }
    const resp = await fetch(caminho, opts);
    if (resp.redirected && /\/conta\/login/.test(resp.url)) throw new SessaoExpirada('Sessão do G-MUS expirou.');
    if (!resp.ok) throw new Error(`G-MUS respondeu ${resp.status} em ${caminho}`);
    const html = await decodificar(resp);
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function linhasDaTabela(doc) {
    return [...doc.querySelectorAll('tr')].map((tr) =>
      [...tr.children]
        .filter((c) => c.tagName === 'TD' || c.tagName === 'TH')
        .map((c) => c.textContent.replace(/\s+/g, ' ').trim())
    );
  }

  function textoComQuebras(doc) {
    doc.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
    doc.querySelectorAll('tr,div,p,li,dt,dd').forEach((el) => el.append('\n'));
    doc.querySelectorAll('td,th,label,span,b,strong').forEach((el) => el.append(' '));
    return (doc.body ? doc.body.textContent : '') || '';
  }

  // Paciente de uma saída (usado quando o Finalizar vem da lista de saídas,
  // onde a tela não tem o campo do paciente).
  FZ.buscarPacienteDaSaida = async function (idSaida) {
    const doc = await gmusFetch('GET', `/estoque/saidas/editar/id/${encodeURIComponent(idSaida)}`);
    const id = doc.querySelector('#id_usuario_gms');
    const nome = doc.querySelector('#text_id_usuario_gms');
    return {
      idPaciente: id ? id.getAttribute('value') : null,
      nomePaciente: nome ? nome.getAttribute('value') : null
    };
  };

  FZ.buscarUltimasRetiradas = async function (idPaciente) {
    const doc = await gmusFetch('POST', '/estoque/saidas/ultimasretiradas', { id_usuario_gms: idPaciente });
    return FZ.parseUltimasRetiradas(linhasDaTabela(doc));
  };

  FZ.buscarTelefones = async function (idPaciente) {
    const doc = await gmusFetch('GET', `/cadastro/usuariogmss/dadospaciente/id/${encodeURIComponent(idPaciente)}`);
    return FZ.extrairTelefones(textoComQuebras(doc));
  };

  // Junta tudo o que o popup precisa para uma saída finalizada.
  FZ.coletarDadosDaSaida = async function (pendente) {
    let { idSaida, idPaciente, nomePaciente } = pendente;
    if (!idPaciente) {
      const p = await FZ.buscarPacienteDaSaida(idSaida);
      idPaciente = p.idPaciente;
      nomePaciente = nomePaciente || p.nomePaciente;
    }
    if (!idPaciente) throw new Error(`Não encontrei o paciente da saída Nº ${idSaida}.`);

    const [blocos, telefones] = await Promise.all([
      FZ.buscarUltimasRetiradas(idPaciente),
      FZ.buscarTelefones(idPaciente).catch(() => [])
    ]);
    const { bloco, exato } = FZ.escolherBloco(blocos, idSaida);

    return {
      idSaida,
      idPaciente,
      nome: FZ.nomePacienteLimpo(nomePaciente),
      telefones,
      bloco,
      exato
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
