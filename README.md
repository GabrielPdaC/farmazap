# FarmaZap (protótipo v0.1)

Extensão do Chrome que, ao **finalizar uma baixa/saída no G-MUS**, abre um popup com os
medicamentos da saída. O operador marca quais quer avisar, e a extensão envia na hora,
pelo **WhatsApp Web** logado, a data de término de cada um para o paciente retirar novamente.

> Protótipo de demonstração: roda 100% no navegador, sem servidor e sem banco.

## Requisitos

- Google Chrome (ou Edge/Chromium) recente
- Uma aba com o **G-MUS** logado (`https://saoleopoldo.g-mus.com.br`)
- Uma aba com o **WhatsApp Web** logado (`https://web.whatsapp.com`)

## Instalação

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação** e selecione esta pasta (`farmazap`)
4. Fixe o ícone da extensão na barra (opcional)
5. Se o G-MUS e o WhatsApp Web já estavam abertos, **recarregue as duas abas** (F5)

## Uso

1. No G-MUS, faça a baixa/saída normalmente e clique em **Finalizar**
2. O G-MUS finaliza e abre uma nova saída, como sempre. Logo em seguida, aparece o popup **FarmaZap**:
   - o nome do paciente e o telefone do cadastro (você pode editar)
   - os medicamentos da saída, com **duração** e **data de término**, todos **desmarcados**
   - a prévia da mensagem, que muda conforme você marca os medicamentos
3. Marque os medicamentos e clique em **Enviar no WhatsApp**, ou em **Não enviar**

A mensagem é enviada **uma única vez, na hora**. Não existe lembrete agendado.

## Configurações

Clique com o botão direito no ícone da extensão → **Opções**, ou use o link no popup do ícone:

- **Enviar automaticamente**: se desmarcado, a extensão só deixa a mensagem pronta na
  conversa do WhatsApp e você clica em enviar (bom para os primeiros testes)
- Nome da farmácia, modelo da mensagem e formato de cada linha de medicamento
- **Teste de envio** para um número seu

## Como funciona

```
G-MUS (aba)                                   Service worker                 WhatsApp Web (aba)
───────────                                   ──────────────                 ──────────────────
[hook-main.js — world MAIN, só observa]
  POST /estoque/saidas/finalizar {id}  ──▶  pendente {idSaida, paciente}
  resposta OK                          ──▶  confirmado
[content.js — página seguinte]
  ◀── "mostrar pendentes"
  POST /estoque/saidas/ultimasretiradas    → medicamentos + término (bloco Nº = idSaida)
  GET  /cadastro/usuariogmss/dadospaciente → telefone
  popup → operador marca → "enviar"   ──▶  abre /send?phone=&text=   ──▶  [whatsapp/content.js]
                                                                             clica em Enviar,
  ◀── resultado  ◀──────────────────────────  resultado  ◀────────────────  confirma
```

### Segurança no G-MUS (banco oficial)

- O hook do Finalizar **só observa** o `XMLHttpRequest`. Ele não altera, não bloqueia e não repete nada.
- A extensão só faz requisições a **3 rotas de leitura**, numa allowlist em
  [src/gmus/gmus-api.js](src/gmus/gmus-api.js). Qualquer outra rota é recusada no código.
- Ela usa a própria sessão do usuário logado (cookie) e não guarda login nem senha.
- **Reabrir** uma saída usa o mesmo endpoint, mas é identificado e ignorado.

### Dados guardados (LGPD)

- `chrome.storage.session`: a saída pendente (id e paciente) enquanto o popup não é
  resolvido. Isso é apagado ao fechar o navegador.
- `chrome.storage.local`: as configurações e um histórico de **id da saída + status + data**.
  Nome, telefone e mensagem **não** são guardados.

## Estrutura

| Arquivo | Função |
|---|---|
| [manifest.json](manifest.json) | Manifest V3 |
| [src/gmus/hook-main.js](src/gmus/hook-main.js) | Detecta o Finalizar (world MAIN) |
| [src/gmus/content.js](src/gmus/content.js) | Ponte hook → service worker; abre o popup |
| [src/gmus/gmus-api.js](src/gmus/gmus-api.js) | Leitura do G-MUS (allowlist) |
| [src/gmus/modal.js](src/gmus/modal.js) | Popup (Shadow DOM) |
| [src/whatsapp/content.js](src/whatsapp/content.js) | Automação do envio no WhatsApp Web |
| [src/background.js](src/background.js) | Pendências, envio e histórico |
| [src/shared/util.js](src/shared/util.js) | Parsers e formatação (funções puras) |
| [src/options/](src/options/) / [src/popup/](src/popup/) | Configurações e status |
| [icons/](icons/) | Ícones 16/32/48/128 |
| [store/](store/) | Textos e imagens da Chrome Web Store. **Não entra no `.zip`** |
| [docs/](docs/) | [Política de privacidade](https://gabrielpdac.github.io/farmazap/privacidade.html), publicada pelo GitHub Pages |

## Gerar o pacote para a Chrome Web Store

```bash
python scripts/empacotar.py
```

Gera `dist/farmazap-<versão>.zip` só com `manifest.json`, `src/` e `icons/`. A cada nova
publicação, aumente o `version` no [manifest.json](manifest.json) antes de gerar o pacote.

## Testes

```bash
node --test tests/util.test.js
```

Cobrem o parser das "Últimas Retiradas", a extração e normalização de telefone e a montagem
da mensagem, com dados fictícios.

## Pontos a validar no primeiro uso real

1. **A saída recém-finalizada aparece em "Últimas Retiradas"?** Se não aparecer, o popup
   mostra a retirada mais recente com um aviso amarelo. Nesse caso, vamos trocar a fonte
   para os itens da própria saída.
2. **Rótulos do telefone no modal "Dados do paciente"**: o parser procura
   Telefone/Celular/Fone/Contato/WhatsApp. Se não encontrar, o campo vem vazio para digitar.
3. **Seletores do WhatsApp Web**: o WhatsApp muda a interface com frequência. Se o envio
   parar de funcionar, ajuste `SELETORES_ENVIAR` e `SELETORES_CAIXA` em
   [src/whatsapp/content.js](src/whatsapp/content.js).

## Riscos conhecidos

- Automatizar o WhatsApp Web contraria os termos de uso do WhatsApp e pode levar ao bloqueio do número.
  Para volume baixo e mensagens que o paciente espera receber, o risco é menor. Para produção,
  use a API oficial do WhatsApp Business.
