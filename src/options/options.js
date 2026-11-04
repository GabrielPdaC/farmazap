(async function () {
  'use strict';
  const FZ = globalThis.FZ;
  const $ = (id) => document.getElementById(id);
  const CAMPOS = ['farmacia', 'template', 'linhaLista'];

  const EXEMPLO = {
    nome: 'MARIA DA SILVA',
    itens: [
      { material: 'LOSARTANA POTASSICA 50MG COMPRIMIDO (123.4)', termino: '03/12/2026' },
      { material: 'METFORMINA 850MG COMPRIMIDO (456.7)', termino: '18/12/2026' }
    ]
  };

  function lerForm() {
    const cfg = { autoEnviar: $('autoEnviar').checked };
    for (const c of CAMPOS) cfg[c] = $(c).value;
    return cfg;
  }
  function preencher(cfg) {
    $('autoEnviar').checked = !!cfg.autoEnviar;
    for (const c of CAMPOS) $(c).value = cfg[c] ?? '';
    atualizarPrevia();
  }
  function atualizarPrevia() {
    $('previa').textContent = FZ.montarMensagem(lerForm(), EXEMPLO);
  }
  function aviso(el, tipo, texto) { el.className = `msg ${tipo}`; el.textContent = texto; }

  const { config } = await chrome.storage.local.get('config');
  preencher(Object.assign({}, FZ.CONFIG_PADRAO, config || {}));

  CAMPOS.forEach((c) => $(c).addEventListener('input', atualizarPrevia));

  $('salvar').addEventListener('click', async () => {
    await chrome.storage.local.set({ config: lerForm() });
    aviso($('msgSalvar'), 'ok', 'Salvo.');
  });
  $('restaurar').addEventListener('click', () => {
    preencher(FZ.CONFIG_PADRAO);
    aviso($('msgSalvar'), '', 'Padrão restaurado. Clique em Salvar para manter.');
  });

  $('testar').addEventListener('click', async () => {
    const r = await chrome.runtime.sendMessage({
      tipo: 'teste-envio', telefone: $('telTeste').value, texto: FZ.montarMensagem(lerForm(), EXEMPLO)
    });
    if (!r || !r.ok) aviso($('msgTeste'), 'erro', (r && r.erro) || 'Falha ao iniciar o envio.');
    else aviso($('msgTeste'), '', 'Abrindo a conversa no WhatsApp Web…');
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.tipo !== 'resultado-envio' || !msg.teste) return;
    if (msg.ok) aviso($('msgTeste'), 'ok', msg.manual ? 'Mensagem pronta no WhatsApp — clique em enviar por lá.' : '✅ Mensagem de teste enviada.');
    else aviso($('msgTeste'), 'erro', `❌ ${msg.erro}`);
  });
})();
