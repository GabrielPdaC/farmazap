// Content script do G-MUS (mundo isolado da extensão).
// - Em todos os frames: repassa os eventos do hook do Finalizar ao service worker.
// - No frame principal: abre o popup para as saídas finalizadas e envia ao WhatsApp.
(function () {
  'use strict';
  const FZ = globalThis.FZ;
  const ehTopo = window.top === window;

  const enviarAoSW = (msg) =>
    chrome.runtime.sendMessage(msg).catch((e) => ({ ok: false, erro: String(e && e.message || e) }));

  // ---------- ponte hook (MAIN) -> service worker ----------
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'farmazap-hook') return;
    const { fase, idSaida, acao, idPaciente, nomePaciente, dataSaida, status } = e.data;
    enviarAoSW({ tipo: 'finalizar', fase, idSaida, acao, idPaciente, nomePaciente, dataSaida, status });
  });

  if (!ehTopo) return;

  // ---------- popup no frame principal ----------
  let processando = false;
  let envioAtual = null;
  let timeoutEnvio = null;

  async function verificarPendentes() {
    if (processando || FZ.Modal.aberto()) return;
    const pendentes = await enviarAoSW({ tipo: 'listar-pendentes' });
    if (!Array.isArray(pendentes) || !pendentes.length) return;
    processando = true;
    try {
      await abrirPara(pendentes[0]);
    } finally {
      processando = false;
    }
  }

  async function abrirPara(pendente) {
    const descartar = async () => {
      FZ.Modal.fechar();
      await enviarAoSW({ tipo: 'descartar', idSaida: pendente.idSaida });
      setTimeout(verificarPendentes, 300);
    };

    FZ.Modal.carregando(pendente.idSaida);
    let dados;
    try {
      dados = await FZ.coletarDadosDaSaida(pendente);
    } catch (e) {
      const msg = e instanceof FZ.SessaoExpirada
        ? 'A sessão do G-MUS expirou. Faça login novamente e clique em "Tentar novamente".'
        : `Erro ao buscar os dados no G-MUS: ${e.message}`;
      FZ.Modal.erro(msg, { onTentar: () => abrirPara(pendente), onDescartar: descartar });
      return;
    }

    const [cfg, hist] = await Promise.all([
      enviarAoSW({ tipo: 'config' }),
      enviarAoSW({ tipo: 'historico-saida', idSaida: pendente.idSaida })
    ]);
    dados.jaEnviado = hist && hist.quando ? new Date(hist.quando).toLocaleString('pt-BR') : null;

    FZ.Modal.dados(dados, cfg, {
      onDescartar: descartar,
      onEnviar: async (telefone, texto, itens) => {
        FZ.Modal.status('info', 'Abrindo a conversa no WhatsApp Web…');
        envioAtual = pendente.idSaida;
        const r = await enviarAoSW({
          tipo: 'enviar', idSaida: pendente.idSaida, telefone, texto, qtdItens: itens.length
        });
        if (!r || !r.ok) {
          envioAtual = null;
          FZ.Modal.status('erro', (r && r.erro) || 'Falha ao iniciar o envio.', { reabilitar: true });
          return;
        }
        clearTimeout(timeoutEnvio);
        timeoutEnvio = setTimeout(() => {
          if (envioAtual === pendente.idSaida) {
            FZ.Modal.status('erro', 'O WhatsApp Web não respondeu. Verifique a aba do WhatsApp e tente novamente.', { reabilitar: true });
            envioAtual = null;
          }
        }, 90000);
      }
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.tipo === 'mostrar-pendentes') verificarPendentes();
    if (msg.tipo === 'resultado-envio' && !msg.teste && msg.idSaida === envioAtual) {
      clearTimeout(timeoutEnvio);
      envioAtual = null;
      if (msg.ok && msg.manual) {
        FZ.Modal.status('ok', 'Mensagem pronta na aba do WhatsApp. Clique em enviar por lá.', { fecharEm: 4000 });
      } else if (msg.ok) {
        FZ.Modal.status('ok', '✅ Mensagem enviada pelo WhatsApp.', { fecharEm: 2500 });
      } else {
        FZ.Modal.status('erro', `❌ ${msg.erro || 'Não foi possível enviar.'}`, { reabilitar: true });
      }
      if (msg.ok) setTimeout(verificarPendentes, 3000);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verificarPendentes, { once: true });
  } else {
    verificarPendentes();
  }
})();
