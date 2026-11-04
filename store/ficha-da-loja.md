# Ficha da Chrome Web Store — FarmaZap

Textos para copiar e colar no Developer Dashboard. As imagens estão nesta mesma pasta.

---

## Ficha da loja (Store listing)

**Nome**
FarmaZap

**Resumo** (máx. 132 caracteres)
Avisa o paciente pelo WhatsApp Web a data de término dos medicamentos ao finalizar a dispensação no G-MUS.

**Categoria sugerida**
Ferramentas (ou Fluxo de trabalho e planejamento)

**Idioma**
Português (Brasil)

**Descrição**

```
O FarmaZap ajuda farmácias municipais a lembrar os pacientes de voltar para retirar seus medicamentos.

Quando o atendente finaliza uma baixa/saída de medicamentos no sistema G-MUS, o FarmaZap abre uma janela com os medicamentos entregues e a data de término de cada um. O atendente escolhe quais medicamentos quer informar e, com um clique, o paciente recebe pelo WhatsApp uma mensagem com as datas para retirar novamente.

COMO FUNCIONA
• Finalize a baixa/saída no G-MUS normalmente
• O FarmaZap mostra o paciente, o telefone do cadastro e os medicamentos com duração e data de término
• Marque os medicamentos e clique em "Enviar no WhatsApp"
• A mensagem é enviada pelo WhatsApp Web já logado no navegador

RECURSOS
• Nenhum medicamento vem marcado: o atendente decide o que enviar
• Telefone preenchido a partir do cadastro do paciente, com possibilidade de correção
• Mensagem personalizável, com nome da farmácia, nome do paciente e lista de medicamentos
• Modo de conferência: deixa a mensagem pronta no WhatsApp para o atendente revisar e enviar
• Teste de envio para o seu próprio número
• Histórico dos últimos avisos enviados

PRIVACIDADE E SEGURANÇA
• Funciona inteiramente no seu navegador: não há servidor do FarmaZap e nenhum dado é enviado para terceiros
• Apenas lê informações no G-MUS: não altera, não cria e não exclui registros
• Usa a sessão já aberta pelo atendente e não pede nem armazena senhas
• Nome, telefone e conteúdo das mensagens não são guardados; o histórico registra apenas o número da saída, o status e a data

REQUISITOS
• Acesso ao G-MUS da Prefeitura de São Leopoldo, logado no navegador
• WhatsApp Web (web.whatsapp.com) aberto e logado em outra aba

O FarmaZap é uma ferramenta independente. Não é afiliado, patrocinado ou endossado pelo WhatsApp/Meta nem pela Inovadora (G-MUS).
```

**Imagens**

| Campo | Arquivo |
|---|---|
| Ícone da loja (128×128) | `../icons/icon128.png` |
| Captura 1 (1280×800) | `screenshot-1-configuracoes.png` |
| Captura 2 (1280×800) | `screenshot-2-teste-envio.png` |
| Captura 3 (1280×800) | `screenshot-3-status.png` |
| Bloco promocional pequeno (440×280) | `promo-pequeno-440x280.png` |

---

## Práticas de privacidade (Privacy practices)

**Finalidade única** (Single purpose)

```
Ao finalizar uma dispensação de medicamentos no sistema G-MUS, mostrar ao atendente os medicamentos entregues com suas datas de término e, se ele quiser, enviar essas datas ao paciente pelo WhatsApp Web.
```

**Justificativa das permissões**

| Permissão | Justificativa (copiar) |
|---|---|
| `storage` | Guarda as configurações da mensagem, a dispensação em andamento até o atendente decidir se envia o aviso e um histórico mínimo (número da saída, status e data) exibido no popup. |
| Host `https://saoleopoldo.g-mus.com.br/*` | Detecta quando o atendente finaliza uma baixa/saída e lê, somente para exibição ao atendente, os medicamentos, as datas de término e o telefone do paciente. A extensão não altera dados do sistema. |
| Host `https://web.whatsapp.com/*` | Abre a conversa com o paciente no WhatsApp Web já logado pelo atendente e envia a mensagem que ele confirmou. |

**Código remoto** (Remote code)
Não. Todo o código está no pacote da extensão.

**Uso de dados** (Data usage) — marcar:

- [x] Informações de identificação pessoal (nome e telefone do paciente)
- [x] Informações de saúde (medicamentos e datas de término)
- [x] Comunicações pessoais (a mensagem enviada pelo WhatsApp)

Explicação, se for pedida:

```
Os dados são lidos do G-MUS apenas no momento em que o atendente finaliza uma dispensação, exibidos para ele e, se ele confirmar, usados para montar a mensagem enviada pelo WhatsApp Web. Tudo ocorre localmente no navegador. Nenhum dado é transmitido para servidores do desenvolvedor ou de terceiros. Nome, telefone e mensagem não são armazenados.
```

Certificações (marcar as três):

- [x] Não vendo nem transfiro dados de usuários para terceiros fora dos casos de uso aprovados
- [x] Não uso nem transfiro dados de usuários para fins não relacionados à finalidade única do item
- [x] Não uso nem transfiro dados de usuários para determinar capacidade de crédito ou para empréstimos

**URL da política de privacidade**
https://gabrielpdac.github.io/farmazap/privacidade.html
(fonte: [docs/privacidade.html](../docs/privacidade.html), publicada pelo GitHub Pages a partir da pasta `docs/`)

---

## Distribuição

- **Visibilidade:** Não listada (recomendado) ou Privada
- **Regiões:** Brasil
