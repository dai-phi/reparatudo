---
name: Roadmap produto ReparaTudo
overview: Plano estruturado por fases para evoluir o Repara Tudo com foco inicial em confiança (verificação + avaliações + incidentes), mantendo melhorias rápidas de cadastro/UX e preparando o core de “encontrar e contratar” com opção de pedido direcionado ou aberto para propostas.
todos:
  - id: quickwins-auth-ux
    content: "Implementar melhorias rápidas: força de senha, máscara/validação consistente, foco no primeiro erro, UX CEP (logradouro vazio + número separado) em `apps/web/src/pages/ClientRegister.tsx` e `apps/web/src/pages/ProviderRegister.tsx`."
    status: completed
  - id: trust-provider-verification
    content: Implementar verificação do prestador (status + upload doc/selfie + selo) com endpoints na API e UI no perfil/painel.
    status: completed
  - id: trust-ratings-tags-incidents
    content: Evoluir avaliações (tags + resposta do prestador) e criar fluxo de incidentes/report com armazenamento e UI.
    status: completed
  - id: core-dual-request-mode
    content: "Evoluir o core para suportar 2 modos: pedido direcionado (existente) e pedido aberto com propostas (novas entidades e telas)."
    status: completed
  - id: quality-lgpd-security
    content: Adicionar rate limiting/anti-bruteforce, audit log, e testes de fluxos críticos + base LGPD (termos/retencao).
    status: pending
isProject: false
---

# Roadmap estruturado (foco em confiança primeiro)

## Contexto (o que já existe no código)

- **Cadastro/login básico com token/cookie**: rotas em `[apps/api/src/presentation/http/routes/auth.ts](apps/api/src/presentation/http/routes/auth.ts)` e tela `[apps/web/src/pages/Login.tsx](apps/web/src/pages/Login.tsx)`.
- **Cadastro com CEP/ViaCEP + UF/cidade (IBGE)**: cliente em `[apps/web/src/pages/ClientRegister.tsx](apps/web/src/pages/ClientRegister.tsx)` e prestador em `[apps/web/src/pages/ProviderRegister.tsx](apps/web/src/pages/ProviderRegister.tsx)`.
- **Matching por localização** (coords por CEP + `radiusKm`): busca por serviço em `[apps/api/src/presentation/http/routes/providers.ts](apps/api/src/presentation/http/routes/providers.ts)` e repo `[apps/api/src/infrastructure/persistence/repository/postgres-provider-search-repository.ts](apps/api/src/infrastructure/persistence/repository/postgres-provider-search-repository.ts)`.
- **Pedido e chat já são reais (mínimo)**: tabelas `requests`/`messages` em `[apps/api/src/infrastructure/persistence/init-db.ts](apps/api/src/infrastructure/persistence/init-db.ts)`, workflow de criação em `[apps/api/src/application/requests/request-workflow.ts](apps/api/src/application/requests/request-workflow.ts)`, UI do chat em `[apps/web/src/pages/Chat.tsx](apps/web/src/pages/Chat.tsx)`.
- **Avaliações básicas**: tabela `ratings` já existe em `[apps/api/src/infrastructure/persistence/init-db.ts](apps/api/src/infrastructure/persistence/init-db.ts)`.
- **Cobrança do prestador existe, mas é demonstrativa**: UI em `[apps/web/src/pages/ProviderPerfil.tsx](apps/web/src/pages/ProviderPerfil.tsx)` (PIX/Cartão “simulado”) e tabela `provider_payments`.

## Fase 0 — Melhorias rápidas (alto impacto / baixo esforço)

### Cadastro e login mais confiáveis

- **“Esqueci minha senha”** (email):
  - API: endpoints para solicitar reset (token com expiração) e confirmar nova senha.
  - Web: telas “Esqueci minha senha” e “Nova senha”.
- **Força de senha**: regra mínima + feedback em tempo real.
- **Bloqueio de tentativas excessivas** (rate limit + lockout leve):
  - Rate limit por IP/rota (`/auth/login`, `/auth/register/`*).
  - Contador por email+IP (anti-bruteforce simples) e atraso progressivo.

### UX do endereço (CEP)

- **Separar “logradouro” e “número”** (campo dedicado para número) e manter “complemento”.
- **Confirmar cidade/UF após CEP**:
  - Hoje o CEP já preenche `state/city` e mantém endereço se `logradouro` vier vazio.
  - Ajustar UX para quando ViaCEP vier sem `logradouro` (caso comum): obrigar usuário a preencher logradouro manualmente e deixar isso claro.
- **Padronizar máscara/validação** (telefone/CEP): hoje CEP tem máscara local; telefone ainda está “livre” (só valida). Migrar para input com máscara consistente.

### Acessibilidade e formulários

- **Mensagens de erro consistentes**: padronizar `errors[field]` e o texto.
- **Foco no primeiro erro** ao submeter.
- **Validação em tempo real** (de forma gradual para não “piscar” erros): onBlur + debounce onChange.

### Perfis mais completos (fundação)

- Já existe foto e `radiusKm` no perfil do prestador. Evoluir perfil com:
  - **bio curta**, **especialidades** (além de `services`), **preço base “a partir de”**, **disponibilidade** (inicialmente texto/slots simples), **portfólio** (fotos de trabalhos).

## Fase 1 — Confiança e segurança (prioridade do seu ciclo)

### Verificação do prestador (KYC leve, incremental)

- **Campos e status de verificação**:
  - Status: `unverified | pending | verified | rejected`.
  - Itens: CPF/CNPJ (já existe `cpf`), selfie+documento (upload), comprovante de endereço.
- **Uploads**:
  - Já existe upload de foto de perfil. Reaproveitar padrão para documentos (armazenamento e chaves já aparecem como colunas `verification_document_`* no DB).
- **Selo “verificado”**:
  - Exibir no card/lista e no perfil.

### Avaliações reais pós-serviço (com tags)

- Expandir `ratings` para:
  - **tags** (ex.: `pontual`, `limpo`, `educado`) e opcional **resposta do prestador**.
  - Garantir que só aparece após `request` finalizada.
- UI:
  - Tela pós-conclusão e resumo no perfil do prestador.

### Políticas e incidentes

- **Botão “reportar problema”** em pedido/chat.
- **Registro de incidentes** (tabela `incidents`): tipo, descrição, anexos opcionais, status.
- **Médiação simples**: inbox/admin básico (mesmo que manual no começo).

### Segurança técnica mínima

- **Audit log** (mudanças sensíveis): perfil, verificação, pagamentos/cobrança.
- **Antifraude básico**: device fingerprint simples (hash) + IP + limites.

## Fase 2 — Core do produto (“encontrar e contratar”) com 2 modos de pedido

Você pediu: **cliente escolhe entre** (A) prestador específico ou (B) sem preferência.

### Pedido/orçamento

- **Modo A (direcionado)**: manter fluxo atual `client -> provider` (já existe `createRequest` validando raio).
- **Modo B (aberto para propostas)**:
  - Criar entidade `**job`/`request_group`** (um chamado do cliente) e `**quotes`** (propostas).
  - Prestadores enviam proposta: valor + prazo + mensagem + condições.
  - Cliente escolhe uma proposta e isso cria/atribuí um `request` “contratado” (ou o próprio `request` ganha `provider_id` depois).

### Catálogo de serviços

- Hoje existe `services` por `SERVICE_IDS`. Evoluir para:
  - Categorias + checklist (para guiar descrição e reduzir ambiguidade).

### Matching e ordenação

- Hoje ordena por `avgResponse`. Evoluir para:
  - Ordenação combinada: distância/nota/preço base/tempo resposta.
  - Filtro por disponibilidade (mesmo que simples no começo).

### Agenda e agendamento

- Começar simples:
  - Prestador define janelas (ex.: manhã/tarde/noite) por dia.
  - Cliente sugere horários; prestador confirma.
- Lembretes por e-mail/WhatsApp entram na fase de operação.

### Chat in-app (tornar “de verdade”)

- Já existe chat e websocket.
- Evoluções:
  - **anexos** (imagem),
  - **templates rápidos** (“chego em X min”, “preciso comprar peça”),
  - **mensagens de sistema** para marcos (proposta enviada/aceita, agendamento confirmado).

## Fase 3 — Pagamentos e monetização (depois do ciclo de confiança)

- **Pagamentos reais**:
  - PIX (copia/cola + QR) e cartão via gateway com webhooks.
  - Status real (pending/paid/failed/refunded) e reconciliação.
- **Modelo híbrido**:
  - Mensalidade + taxa por lead (para modo B) ou comissão por serviço.
  - Limites e transparência para evitar “surpresa” ao prestador.
- **Carteira/repasse**:
  - Começar com “pagamento direto” + registro, evoluir para split/repasse se necessário.

## Fase 4 — Operação e crescimento

- **Notificações**: e-mail/WhatsApp/push (novo pedido, nova proposta, lembrete, cobrança).
- **Painel do prestador**:
  - fila de pedidos e propostas, taxa de resposta, conversão, ganhos, cancelamentos.
- **Admin**:
  - moderação de perfil/fotos/docs, disputas, bloqueios, gestão de categorias, regras de cobrança.
- **Métricas**:
  - funil cadastro → pedido → proposta → contratado → concluído, tempo de resposta, NPS.

## LGPD e qualidade técnica (transversal)

- **Consentimento e transparência**:
  - Termos, política de privacidade, base legal (cadastro/execução do serviço), retenção e exclusão.
- **Segurança**:
  - Rate limit, antifraude básico, logs/auditoria, proteção contra enumeração (email/telefone).
- **Qualidade**:
  - Testes de API para fluxos críticos: auth, pedido, proposta, avaliação.
  - Testes de formulário (cadastro/login) e casos ViaCEP sem logradouro.

## Validação: “precisamos de mais alguma coisa?” (lacunas principais)

- **Recuperação de senha/OTP**: não vi fluxo pronto; é necessário para confiabilidade.
- **Verificação do prestador end-to-end**: há indícios de colunas para documento, mas falta fluxo completo + status + admin.
- **Propostas/orçamentos multi-prestador**: não aparece no modelo atual (hoje é 1 request ↔ 1 provider).
- **Agenda**: não aparece.
- **Notificações externas**: não aparece.
- **Pagamentos reais**: hoje é simulado.

## Sugestões de novas features (além da lista)

- **Garantia por categoria** (começo manual): campo “garantia até” no pedido + template de termo.
- **Checklist de materiais** no chat/pedido (prestador marca o que precisa comprar) + registro para transparência.
- **Preços guia** (faixas) por serviço para educar cliente e reduzir atrito na negociação.
- **SLA de resposta** e “prestadores mais rápidos” (já há métrica `avgResponse`).

