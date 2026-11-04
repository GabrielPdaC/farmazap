(async function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const marcar = (el, on) => { el.textContent = on ? 'sim' : 'não'; el.className = on ? 'on' : 'off'; };
  const ROTULOS = { enviado: '✅ enviado', preparado: '📝 preparado', erro: '❌ erro', descartado: '— descartado' };

  $('opcoes').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

  const st = await chrome.runtime.sendMessage({ tipo: 'status' });
  marcar($('gmus'), st.gmusAberto);
  marcar($('wa'), st.waAberto);
  $('pend').textContent = st.pendentes;

  const hist = $('hist');
  if (!st.historico.length) { hist.textContent = 'Nenhum aviso ainda.'; return; }
  hist.className = '';
  hist.textContent = '';
  const tabela = document.createElement('table');
  for (const h of st.historico) {
    const tr = tabela.insertRow();
    tr.insertCell().textContent = new Date(h.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    tr.insertCell().textContent = h.idSaida ? `Saída ${h.idSaida}` : '';
    const c = tr.insertCell();
    c.textContent = ROTULOS[h.status] || h.status;
    if (h.erro) c.title = h.erro;
  }
  hist.append(tabela);
})();
