// Popup exibido sobre o G-MUS após o Finalizar. Usa Shadow DOM para não
// herdar nem afetar o CSS do sistema.
(function (g) {
  'use strict';
  const FZ = g.FZ;

  const CSS = `
    :host { all: initial; }
    .fundo { position: fixed; inset: 0; background: rgba(15, 23, 42, .45); z-index: 2147483646;
             display: flex; align-items: flex-start; justify-content: center; padding: 6vh 16px;
             font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
    .caixa { background: #fff; border-radius: 12px; width: min(640px, 100%); max-height: 88vh;
             display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,.3); overflow: hidden; }
    header { padding: 14px 18px; background: #075e54; color: #fff; display: flex; align-items: center; gap: 10px; }
    header h2 { margin: 0; font-size: 16px; font-weight: 600; flex: 1; }
    header button { background: transparent; border: 0; color: #fff; font-size: 20px; cursor: pointer; line-height: 1; }
    .corpo { padding: 16px 18px; overflow: auto; display: grid; gap: 14px; }
    .linha { display: grid; grid-template-columns: 90px 1fr; gap: 8px; align-items: center; }
    .rot { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
    input[type=text], select { font: inherit; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { font-size: 12px; color: #475569; font-weight: 600; }
    td.chk { width: 28px; }
    td.data { white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.off td { color: #94a3b8; }
    .aviso { background: #fef9c3; border: 1px solid #fde047; padding: 8px 10px; border-radius: 6px; font-size: 13px; }
    .erro { background: #fee2e2; border: 1px solid #fca5a5; padding: 8px 10px; border-radius: 6px; }
    .ok { background: #dcfce7; border: 1px solid #86efac; padding: 8px 10px; border-radius: 6px; }
    .info { background: #e0f2fe; border: 1px solid #7dd3fc; padding: 8px 10px; border-radius: 6px; }
    pre { white-space: pre-wrap; background: #f1f5f9; border-radius: 8px; padding: 10px; margin: 0;
          font: 13px/1.4 system-ui, sans-serif; max-height: 200px; overflow: auto; }
    footer { padding: 12px 18px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; justify-content: flex-end; }
    footer button { font: inherit; padding: 8px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
    footer button.prim { background: #25d366; border-color: #1ebe5b; color: #fff; font-weight: 600; }
    footer button:disabled { opacity: .5; cursor: not-allowed; }
    .vazio { color: #64748b; font-style: italic; }
  `;

  let host = null;
  let raiz = null;

  function el(tag, attrs, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const f of filhos.flat()) if (f != null) e.append(f instanceof Node ? f : document.createTextNode(String(f)));
    return e;
  }

  function montarEsqueleto(titulo, onFechar) {
    fechar();
    host = document.createElement('div');
    host.id = 'farmazap-host';
    raiz = host.attachShadow({ mode: 'open' });
    raiz.append(el('style', {}, CSS));
    const corpo = el('div', { class: 'corpo' });
    const rodape = el('footer');
    const caixa = el('div', { class: 'caixa', role: 'dialog', 'aria-modal': 'true' },
      el('header', {}, el('h2', {}, titulo), el('button', { title: 'Fechar', onclick: onFechar || fechar }, '×')),
      corpo,
      rodape
    );
    raiz.append(el('div', { class: 'fundo' }, caixa));
    (document.body || document.documentElement).append(host);
    return { corpo, rodape };
  }

  function fechar() {
    if (host) host.remove();
    host = null;
    raiz = null;
  }

  FZ.Modal = {
    aberto: () => !!host,
    fechar,

    carregando(idSaida) {
      const { corpo } = montarEsqueleto('FarmaZap — Saída finalizada');
      corpo.append(el('div', { class: 'info' }, `Buscando os medicamentos da saída Nº ${idSaida}…`));
    },

    erro(mensagem, { onTentar, onDescartar } = {}) {
      const { corpo, rodape } = montarEsqueleto('FarmaZap — Não foi possível carregar', onDescartar);
      corpo.append(el('div', { class: 'erro' }, mensagem));
      if (onDescartar) rodape.append(el('button', { onclick: onDescartar }, 'Descartar'));
      if (onTentar) rodape.append(el('button', { class: 'prim', onclick: onTentar }, 'Tentar novamente'));
    },

    // dados: { idSaida, nome, telefones:[{rotulo,numero}], bloco:{numero,data,itens}, exato, jaEnviado }
    dados(dados, cfg, { onEnviar, onDescartar }) {
      const { corpo, rodape } = montarEsqueleto('FarmaZap — Avisar paciente no WhatsApp', onDescartar);
      const itens = (dados.bloco && dados.bloco.itens) || [];

      if (!dados.exato && dados.bloco) {
        corpo.append(el('div', { class: 'aviso' },
          `Não encontrei a saída Nº ${dados.idSaida} nas últimas retiradas. ` +
          `Mostrando a retirada mais recente (Nº ${dados.bloco.numero || '?'}, ${dados.bloco.data || 'sem data'}). Confira antes de enviar.`));
      }
      if (dados.jaEnviado) {
        corpo.append(el('div', { class: 'aviso' }, `Já foi enviado um aviso para esta saída em ${dados.jaEnviado}.`));
      }

      corpo.append(el('div', { class: 'linha' }, el('span', { class: 'rot' }, 'Paciente'), el('strong', {}, dados.nome || '—')));

      const inputTel = el('input', {
        type: 'text', placeholder: '(51) 99999-9999',
        value: dados.telefones[0] ? FZ.formatarTelefone(dados.telefones[0].numero) : ''
      });
      const linhaTel = el('div', { class: 'linha' }, el('span', { class: 'rot' }, 'WhatsApp'), inputTel);
      corpo.append(linhaTel);
      if (dados.telefones.length > 1) {
        const sel = el('select', {
          onchange: (e) => { inputTel.value = FZ.formatarTelefone(e.target.value); atualizar(); }
        }, dados.telefones.map((t) => el('option', { value: t.numero }, `${t.rotulo}: ${FZ.formatarTelefone(t.numero)}`)));
        corpo.append(el('div', { class: 'linha' }, el('span', { class: 'rot' }, 'Cadastro'), sel));
      } else if (!dados.telefones.length) {
        corpo.append(el('div', { class: 'aviso' }, 'Nenhum telefone encontrado no cadastro. Digite o número acima.'));
      }

      const checks = [];
      const tbody = el('tbody');
      for (const item of itens) {
        const habilitado = !!item.termino && !item.devolvido;
        const chk = el('input', { type: 'checkbox', disabled: !habilitado, onchange: () => atualizar() });
        checks.push({ chk, item });
        const motivo = !item.termino ? ' (sem data de término)' : item.devolvido ? ' (devolvido)' : '';
        tbody.append(el('tr', { class: habilitado ? '' : 'off' },
          el('td', { class: 'chk' }, chk),
          el('td', {}, FZ.nomeMedicamento(item.material) + motivo),
          el('td', { class: 'data' }, item.duracao ? `${item.duracao} dias` : '—'),
          el('td', { class: 'data' }, item.termino || '—')));
      }
      corpo.append(itens.length
        ? el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Medicamento'), el('th', {}, 'Duração'), el('th', {}, 'Término'))), tbody)
        : el('div', { class: 'vazio' }, 'Nenhum medicamento encontrado para esta saída.'));

      const previa = el('pre', { class: 'vazio' }, 'Marque os medicamentos para ver a mensagem.');
      corpo.append(el('div', {}, el('div', { class: 'rot' }, 'Prévia da mensagem'), previa));

      const status = el('div');
      corpo.append(status);

      const btnDescartar = el('button', { onclick: onDescartar }, 'Não enviar');
      const btnEnviar = el('button', { class: 'prim', disabled: true }, 'Enviar no WhatsApp');
      rodape.append(btnDescartar, btnEnviar);

      let texto = '';
      function marcados() { return checks.filter((c) => c.chk.checked).map((c) => c.item); }
      function atualizar() {
        const sel = marcados();
        const tel = FZ.normalizarTelefone(inputTel.value);
        texto = sel.length ? FZ.montarMensagem(cfg, { nome: dados.nome, itens: sel }) : '';
        previa.textContent = texto || 'Marque os medicamentos para ver a mensagem.';
        previa.className = texto ? '' : 'vazio';
        btnEnviar.disabled = !(sel.length && tel);
        inputTel.style.borderColor = inputTel.value && !tel ? '#ef4444' : '';
      }
      inputTel.addEventListener('input', atualizar);

      btnEnviar.addEventListener('click', () => {
        btnEnviar.disabled = true;
        btnDescartar.disabled = true;
        checks.forEach((c) => (c.chk.disabled = true));
        inputTel.disabled = true;
        onEnviar(FZ.normalizarTelefone(inputTel.value), texto, marcados());
      });

      FZ.Modal.status = function (tipo, msg, { fecharEm, reabilitar } = {}) {
        status.className = tipo;
        status.textContent = msg;
        if (reabilitar) {
          btnDescartar.disabled = false;
          inputTel.disabled = false;
          checks.forEach((c) => (c.chk.disabled = !c.item.termino || c.item.devolvido));
          atualizar();
        }
        if (fecharEm) setTimeout(fechar, fecharEm);
      };
      atualizar();
    },

    status() { /* substituído quando o popup de dados é aberto */ }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
