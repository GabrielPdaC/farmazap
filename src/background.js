// Service worker: guarda as saídas finalizadas pendentes, orquestra o envio
// pelo WhatsApp Web e mantém um histórico mínimo (sem nome/telefone — LGPD).
importScripts('shared/util.js');

const FZ = self.FZ;
const S = chrome.storage.session;
const L = chrome.storage.local;
const VALIDADE_PENDENTE_MS = 30 * 60 * 1000;
const TRAVA_ENVIO_MS = 90 * 1000;

async function obterPendentes() {
  const { pendentes = {} } = await S.get('pendentes');
  const agora = Date.now();
  for (const [id, p] of Object.entries(pendentes)) {
    if (agora - p.ts > VALIDADE_PENDENTE_MS) delete pendentes[id];
  }
  return pendentes;
}
const salvarPendentes = (pendentes) => S.set({ pendentes });

async function obterConfig() {
  const { config } = await L.get('config');
  return Object.assign({}, FZ.CONFIG_PADRAO, config || {});
}

async function registrarHistorico(reg) {
  const { historico = [] } = await L.get('historico');
  historico.unshift(Object.assign({ quando: new Date().toISOString() }, reg));
  await L.set({ historico: historico.slice(0, 100) });
}

function avisarAba(tabId, msg) {
  if (tabId == null) return;
  chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }).catch(() => {});
}

async function iniciarEnvio(msg, sender) {
  const telefone = FZ.normalizarTelefone(msg.telefone);
  if (!telefone) return { ok: false, erro: 'Telefone inválido. Use DDD + número, ex.: (51) 99999-9999.' };
  if (!msg.texto) return { ok: false, erro: 'Mensagem vazia.' };

  const { envio } = await S.get('envio');
  if (envio && Date.now() - envio.inicio < TRAVA_ENVIO_MS) {
    return { ok: false, erro: 'Já existe um envio em andamento. Aguarde alguns segundos e tente de novo.' };
  }

  const [wa] = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (!wa) return { ok: false, erro: 'Abra o WhatsApp Web (web.whatsapp.com) em uma aba deste navegador e faça login.' };

  const cfg = await obterConfig();
  const job = {
    idSaida: msg.idSaida || null,
    telefone,
    texto: msg.texto,
    qtdItens: msg.qtdItens || 0,
    teste: msg.tipo === 'teste-envio',
    origemTabId: sender.tab ? sender.tab.id : null,
    waTabId: wa.id,
    autoEnviar: !!cfg.autoEnviar,
    entregue: false,
    inicio: Date.now()
  };
  await S.set({ envio: job });
  await chrome.tabs.update(wa.id, {
    url: `https://web.whatsapp.com/send?phone=${telefone}&text=${encodeURIComponent(msg.texto)}`,
    active: !job.autoEnviar // no modo manual, leva o operador até a aba do WhatsApp
  });
  return { ok: true };
}

async function tratar(msg, sender) {
  const tabId = sender.tab ? sender.tab.id : null;

  switch (msg && msg.tipo) {
    case 'finalizar': {
      const id = String(msg.idSaida || '');
      if (!id) return { ok: false };
      const pendentes = await obterPendentes();
      if (msg.fase === 'enviado') {
        if (msg.acao === 'reabrir') return { ok: true, ignorado: true };
        pendentes[id] = {
          idSaida: id,
          idPaciente: msg.idPaciente || null,
          nomePaciente: msg.nomePaciente || null,
          tabId,
          status: 'enviado',
          ts: Date.now()
        };
      } else if (msg.fase === 'confirmado') {
        if (!pendentes[id]) return { ok: true, ignorado: true };
        pendentes[id].status = 'confirmado';
        pendentes[id].ts = Date.now();
        // A página costuma redirecionar logo após o sucesso; o popup abre na
        // página seguinte. Este aviso cobre o caso de não haver redirecionamento.
        setTimeout(() => avisarAba(tabId, { tipo: 'mostrar-pendentes' }), 1500);
      } else if (msg.fase === 'falhou') {
        delete pendentes[id];
      }
      await salvarPendentes(pendentes);
      return { ok: true };
    }

    case 'listar-pendentes': {
      const pendentes = await obterPendentes();
      await salvarPendentes(pendentes);
      return Object.values(pendentes)
        .filter((p) => p.status === 'confirmado' && p.tabId === tabId)
        .sort((a, b) => a.ts - b.ts);
    }

    case 'descartar': {
      const pendentes = await obterPendentes();
      delete pendentes[String(msg.idSaida)];
      await salvarPendentes(pendentes);
      await registrarHistorico({ idSaida: String(msg.idSaida), status: 'descartado' });
      return { ok: true };
    }

    case 'config':
      return obterConfig();

    case 'historico-saida': {
      const { historico = [] } = await L.get('historico');
      return historico.find((h) => h.idSaida === String(msg.idSaida) && h.status === 'enviado') || null;
    }

    case 'enviar':
    case 'teste-envio':
      return iniciarEnvio(msg, sender);

    case 'wa-pronto': {
      const { envio } = await S.get('envio');
      if (!envio || envio.entregue || tabId !== envio.waTabId) return null;
      envio.entregue = true;
      await S.set({ envio });
      return { telefone: envio.telefone, texto: envio.texto, autoEnviar: envio.autoEnviar };
    }

    case 'wa-resultado': {
      const { envio } = await S.get('envio');
      if (!envio) return { ok: true };
      await S.remove('envio');
      const resultado = {
        tipo: 'resultado-envio',
        idSaida: envio.idSaida,
        teste: envio.teste,
        ok: !!msg.ok,
        manual: !!msg.manual,
        erro: msg.erro || null
      };
      if (!envio.teste && envio.idSaida) {
        if (msg.ok) {
          const pendentes = await obterPendentes();
          delete pendentes[envio.idSaida];
          await salvarPendentes(pendentes);
        }
        await registrarHistorico({
          idSaida: envio.idSaida,
          status: msg.ok ? (msg.manual ? 'preparado' : 'enviado') : 'erro',
          qtdItens: envio.qtdItens,
          erro: msg.erro || null
        });
      }
      avisarAba(envio.origemTabId, resultado);
      chrome.runtime.sendMessage(resultado).catch(() => {}); // página de opções (teste)
      return { ok: true };
    }

    case 'status': {
      const [gmus, wa, { historico = [] }, pendentes] = await Promise.all([
        chrome.tabs.query({ url: 'https://saoleopoldo.g-mus.com.br/*' }),
        chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }),
        L.get('historico'),
        obterPendentes()
      ]);
      return {
        gmusAberto: gmus.length > 0,
        waAberto: wa.length > 0,
        pendentes: Object.values(pendentes).filter((p) => p.status === 'confirmado').length,
        historico: historico.slice(0, 15)
      };
    }

    default:
      return null;
  }
}

// Processa as mensagens em série para evitar corrida no chrome.storage
// (ex.: "enviado" e "confirmado" do mesmo Finalizar chegando quase juntos).
let fila = Promise.resolve();
function emSerie(fn) {
  const p = fila.then(fn, fn);
  fila = p.catch(() => {});
  return p;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  emSerie(() => tratar(msg, sender)).then(
    sendResponse,
    (e) => sendResponse({ ok: false, erro: String((e && e.message) || e) })
  );
  return true;
});
