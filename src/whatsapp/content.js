// Content script do WhatsApp Web. Quando o service worker abre
// web.whatsapp.com/send?phone=...&text=..., este script espera a conversa
// carregar, clica em enviar e confirma que a caixa de texto esvaziou.
(function () {
  'use strict';
  if (window.top !== window) return;

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  const SELETORES_CAIXA = [
    'footer div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="10"]'
  ];
  const SELETORES_ENVIAR = [
    'button[aria-label="Enviar"]',
    'button[aria-label="Send"]',
    'span[data-icon="wds-ic-send-filled"]',
    'span[data-icon="send"]'
  ];

  function primeiro(seletores) {
    for (const s of seletores) {
      const e = document.querySelector(s);
      if (e) return e;
    }
    return null;
  }

  const caixaDeTexto = () => primeiro(SELETORES_CAIXA);
  const textoDa = (caixa) => (caixa ? caixa.innerText.replace(/​/g, '').trim() : '');

  function botaoEnviar() {
    const e = primeiro(SELETORES_ENVIAR);
    return e ? e.closest('button') || e : null;
  }

  function numeroInvalido() {
    return [...document.querySelectorAll('div[role="dialog"], [data-animate-modal-popup="true"]')]
      .some((d) => /inv[aá]lid|invalid|n[aã]o est[aá] no whatsapp|isn.t on whatsapp/i.test(d.textContent || ''));
  }

  function naoLogado() {
    return !!document.querySelector('canvas[aria-label*="QR" i], canvas[aria-label*="Scan" i], div[data-ref] canvas');
  }

  function inserirTexto(caixa, texto) {
    caixa.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', texto);
    caixa.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    if (!textoDa(caixa)) document.execCommand('insertText', false, texto);
  }

  async function executar(job) {
    const inicio = Date.now();
    const limite = inicio + 60000;
    let inseriu = false;

    while (Date.now() < limite) {
      if (numeroInvalido()) throw new Error('O WhatsApp informou que este número é inválido ou não tem WhatsApp.');
      if (Date.now() - inicio > 5000 && naoLogado()) throw new Error('O WhatsApp Web não está logado. Leia o QR code e tente novamente.');

      const caixa = caixaDeTexto();
      if (caixa && !textoDa(caixa) && !inseriu && Date.now() - inicio > 8000) {
        inserirTexto(caixa, job.texto); // o parâmetro ?text= às vezes não é aplicado
        inseriu = true;
      }

      const botao = botaoEnviar();
      if (caixa && botao && textoDa(caixa)) {
        if (!job.autoEnviar) return { ok: true, manual: true };
        await dormir(400);
        botao.click();
        for (let i = 0; i < 20; i++) {
          await dormir(500);
          if (!textoDa(caixaDeTexto())) return { ok: true };
        }
        throw new Error('Cliquei em enviar, mas não consegui confirmar o envio. Confira a conversa no WhatsApp.');
      }
      await dormir(500);
    }
    throw new Error('Tempo esgotado esperando o WhatsApp Web abrir a conversa.');
  }

  (async () => {
    let job;
    try {
      job = await chrome.runtime.sendMessage({ tipo: 'wa-pronto' });
    } catch (_) {
      return;
    }
    if (!job) return;
    let res;
    try {
      res = await executar(job);
    } catch (e) {
      res = { ok: false, erro: e.message };
    }
    chrome.runtime.sendMessage(Object.assign({ tipo: 'wa-resultado' }, res)).catch(() => {});
  })();
})();
