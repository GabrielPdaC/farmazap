// Roda no "mundo" da página do G-MUS (world: MAIN), em todos os frames.
// SOMENTE OBSERVA: não altera, não bloqueia e não repete nenhuma requisição.
// Detecta o POST /estoque/saidas/finalizar (feito pelo jQuery via XHR) e avisa o
// content script por window.postMessage.
(function () {
  'use strict';
  if (window.__farmazapHook) return;
  window.__farmazapHook = true;

  const ALVO = /\/estoque\/saidas\/finalizar\/?$/;
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  // Último clique, para diferenciar "Finalizar" de "Reabrir" (o mesmo endpoint
  // é usado para as duas ações na lista de saídas).
  let ultimoClique = { texto: '', ts: 0 };
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target && e.target.closest ? e.target.closest('a,button,input') : null;
      const texto = el ? (el.value || el.textContent || el.title || '') : '';
      ultimoClique = { texto: String(texto).trim(), ts: Date.now() };
    },
    true
  );

  const valor = (sel) => {
    const el = document.querySelector(sel);
    return el && 'value' in el ? el.value : null;
  };

  const postar = (fase, dados) => {
    try {
      window.postMessage(Object.assign({ source: 'farmazap-hook', fase }, dados), location.origin);
    } catch (_) { /* nunca quebrar a página */ }
  };

  const respostaComErro = (xhr) => {
    try {
      if (xhr.responseType && xhr.responseType !== 'text') return false;
      const obj = JSON.parse(xhr.responseText);
      return obj && (obj.error === 1 || obj.error === true || obj.error === '1');
    } catch (_) {
      return false; // resposta não-JSON: o próprio G-MUS trata como sucesso
    }
  };

  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      this.__fz = { method: String(method || ''), url: String(url || '') };
    } catch (_) { /* ignore */ }
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      const info = this.__fz;
      if (info && /^post$/i.test(info.method) && ALVO.test(new URL(info.url, location.href).pathname)) {
        const params = new URLSearchParams(typeof body === 'string' ? body : '');
        const idSaida = params.get('id') || valor('#id_saida');

        const cliqueRecente = Date.now() - ultimoClique.ts < 10000 ? ultimoClique.texto : '';
        const jaFinalizada = valor('#finalizada') === '1';
        const acao = /reabrir/i.test(cliqueRecente) || jaFinalizada ? 'reabrir' : 'finalizar';

        postar('enviado', {
          idSaida,
          acao,
          idPaciente: valor('#id_usuario_gms'),
          nomePaciente: valor('#text_id_usuario_gms'),
          dataSaida: valor('#data')
        });

        this.addEventListener('load', () => {
          const ok = this.status >= 200 && this.status < 300 && !respostaComErro(this);
          postar(ok ? 'confirmado' : 'falhou', { idSaida, status: this.status });
        });
        this.addEventListener('error', () => postar('falhou', { idSaida, status: 0 }));
      }
    } catch (_) { /* nunca quebrar a página */ }
    return origSend.apply(this, arguments);
  };
})();
