# Verificação de features de alto valor (ReparaTudo)

**Data da auditoria:** 2026-04-03  
**Escopo:** [`apps/web`](../apps/web), [`apps/api`](../apps/api), esquema em [`apps/api/src/infrastructure/persistence/init-db.ts`](../apps/api/src/infrastructure/persistence/init-db.ts).

Este documento implementa o plano de verificação: inventário factual, candidatos, priorização, validação externa recomendada e shortlist com métricas.

---

## 1. Inventário factual (código vs. roadmap)

Legenda: **OK** = implementado de ponta a ponta · **Parcial** = existe mas falta profundidade ou é demonstrativo · **Ausente** = não há modelo/API/UI adequados.

| Tema | Status | Evidência |
| --- | --- | --- |
| Login, cadastro cliente/prestador | OK | Rotas em [`App.tsx`](../apps/web/src/App.tsx), [`auth.ts`](../apps/api/src/presentation/http/routes/auth.ts) |
| Esqueci minha senha / reset por e-mail | OK | `password_reset_tokens`, `/auth/forgot-password`, `/auth/reset-password`, páginas `ForgotPassword` / `ResetPassword` |
| Rate limit por IP + throttle de login | OK | [`build-app.ts`](../apps/api/src/build-app.ts), `login_throttle` |
| Busca de prestadores por serviço + raio | OK | [`provider-search.ts`](../apps/api/src/presentation/http/routes/provider-search.ts) |
| Ordenação / matching “rico” | Parcial | Lista filtra por distância e ordena só por `avgResponseMins` (não combina distância, nota, preço, verificação) |
| Pedido direcionado (cliente → prestador) | OK | `requests`, workflow em `application/requests` |
| Trabalhos abertos + propostas (quotes) | OK | `open_jobs`, `quotes`, rotas `open-jobs` |
| Chat in-app + WebSocket | OK | [`Chat.tsx`](../apps/web/src/pages/Chat.tsx), `/ws` |
| Chat: anexos, templates, mensagens de sistema | Ausente | `messages` é texto único; sem colunas de anexo/tipo |
| Avaliações pós-serviço (nota, texto, tags, resposta prestador) | OK | `ratings`, [`client.ts`](../apps/api/src/presentation/http/routes/client.ts), resposta em `provider` |
| Incidentes / report | OK | `incidents`, `POST /requests/:id/incidents` |
| Verificação KYC leve + upload + admin | OK | Colunas de verificação em `users`, [`AdminProviderVerifications`](../apps/web/src/pages/AdminProviderVerifications.tsx) |
| Audit log | OK | `audit_logs` |
| Documentos legais / LGPD (página) | Parcial | [`Legal.tsx`](../apps/web/src/pages/Legal.tsx), conteúdo em API |
| Planos do prestador + “pagamento” | Parcial | [`provider_plan_payments`](../apps/api/src/infrastructure/persistence/init-db.ts): fluxo completo com **PIX/cartão mockados** (`mock_transaction_id`, `buildMockPixCopyPaste`) |
| Mensalidade / histórico tipo `provider_payments` | Parcial | Tabela existe; uso legado/demonstrativo |
| Pagamento do **serviço** cliente ↔ prestador (escrow, split) | Ausente | `agreed_value` no pedido; sem gateway nem status de pagamento do job |
| Notificações e-mail (transacionais) | Parcial | E-mail usado no fluxo de reset; **não** há disparo sistemático de “novo pedido”, “nova proposta”, etc. |
| Push / WhatsApp transacional | Ausente | Apenas link `wa.me` no chat após confirmação |
| Agenda / agendamento | Ausente | Sem tabelas nem endpoints dedicados |
| Catálogo de serviços | Parcial | [`SERVICE_IDS`](../apps/api/src/domain/value-objects/service-id.ts): 5 serviços fixos com labels; sem categorias aninhadas nem checklist |
| Analytics de produto (funil) | Ausente | Nenhum SDK (PostHog, GA, etc.) referenciado no web |

**Conclusão:** o roadmap em [`.cursor/plans/roadmap_produto_reparatudo_bbf3c4b9.plan.md`](../.cursor/plans/roadmap_produto_reparatudo_bbf3c4b9.plan.md) está **desatualizado** na seção “lacunas principais”: recuperação de senha, verificação E2E, propostas multi-prestador e vários itens de confiança **já existem**. As lacunas reais de maior impacto agora são **monetização real**, **descoberta (busca)**, **operação (notificações, agenda)** e **profundidade do chat**.

---

## 2. Lista de candidatos (tags)

| ID | Candidato | Tag |
| --- | --- | --- |
| C1 | Notificações transacionais (e-mail: novo pedido, proposta, mensagem, lembrete) | Completar + expandir |
| C2 | Pagamento real de **assinatura** de plano (gateway, webhook, status confiável) | Completar (substituir mock) |
| C3 | Pagamento do **serviço** (PIX/cartão, escrow ou registro forte) | Novo produto |
| C4 | Agenda: janelas do prestador + sugestão/confirmação de horário no pedido | Novo produto |
| C5 | Busca: ordenação combinada (distância, nota, verificado, tempo de resposta) + filtros | Aprofundar |
| C6 | Catálogo: mais categorias / checklist guiado por `service_id` | Aprofundar |
| C7 | Chat: anexos (imagem), mensagens de sistema, respostas rápidas | Aprofundar |
| C8 | Preços guia (faixas) por serviço e região | Novo produto |
| C9 | Checklist de materiais + garantia simples no pedido | Novo produto |
| C10 | Instrumentação de produto (eventos de funil + dashboard) | Infra / habilitador |
| C11 | Carteira / repasse e modelo híbrido (mensalidade + taxa) | Novo produto / monetização |

---

## 3. Priorização (impacto, confiança, monetização, esforço, dependências)

Escala: **Impacto** e **Monetização** 1–5 (5 = maior). **Esforço** 1–5 (5 = mais caro). **Confiança** = evidência interna de que a feature resolve o problema (1–5).

| ID | Impacto | Confiança | Monetização | Esforço | Dependências principais |
| --- | ---: | ---: | ---: | ---: | --- |
| C1 | 5 | 4 | 3 | 3 | Fila/cron ou envio síncrono; templates; preferências opt-in |
| C2 | 4 | 5 | 5 | 4 | Gateway (ex.: Stripe, Pagar.me, Mercado Pago), webhooks, idempotência |
| C3 | 5 | 3 | 5 | 5 | Estados do pedido, KYC, suporte a chargeback, política de disputa |
| C4 | 5 | 3 | 2 | 4 | Modelo de dados novo; UX cliente/prestador; liga com C1 |
| C5 | 4 | 4 | 2 | 2 | Só API + UI; dados já existem em grande parte |
| C6 | 3 | 3 | 1 | 3 | Conteúdo + talvez migração de `service_id` |
| C7 | 4 | 4 | 1 | 3 | Storage (Cloudinary já usado), limite de tamanho |
| C8 | 3 | 2 | 1 | 3 | Pesquisa de mercado / curadoria manual no início |
| C9 | 3 | 2 | 1 | 2 | Campos no pedido + UI |
| C10 | 4 | 5 | 2 | 2 | Escolha de ferramenta + privacidade (LGPD) |
| C11 | 5 | 2 | 5 | 5 | Depende de C2/C3 e definição comercial |

**Ranking sugerido (só com evidência interna):** **C1 ≈ C5** (melhor retorno por esforço) → **C2** → **C4** → **C7** → depois **C3/C11** quando houver clareza comercial.

---

## 4. Validação externa (playbook)

**Estado atual:** não há analytics de produto no repositório; a validação depende de pesquisa ou instrumentação nova.

### 4.1 Entrevistas (5–10 entrevistas, 20–30 min)

- **Clientes:** última contratação de serviço; o que faria voltar ao app; medo de pagamento antecipado vs. pagar depois.
- **Prestadores:** como fecham hoje (PIX, dinheiro); disposição a pagar assinatura/taxa; o que perdem por “sumiço” de cliente após orçamento.

**Saída:** priorizar C2 vs. C3 e C4 vs. C1 com base em dores reais.

### 4.2 Teste de demanda (fake door ou landing)

- Botão “Pagar com proteção” ou “Agendar visita” com inscrição em lista de espera; medir CTR e conversão em e-mail.

### 4.3 Analytics mínimo (recomendado antes de C3/C11)

Eventos sugeridos: `signup_completed`, `request_created`, `open_job_created`, `quote_submitted`, `request_confirmed`, `chat_first_message`, `rating_submitted`. Meta: ver funil e onde abandonam.

---

## 5. Shortlist (próximo ciclo) e métricas de sucesso

| Prioridade | Iniciativa | Métrica principal | Métrica de guarda |
| --- | --- | --- | --- |
| 1 | **C1 — Notificações transacionais (e-mail)** | Taxa de primeiro contato em menos de 15 min após pedido/proposta | Spam reports, opt-out |
| 2 | **C5 — Busca: ordenação e filtros** | Aumento de pedidos criados após uma busca | Tempo na tela de busca sem ação |
| 3 | **C2 — Pagamento real de plano** | % de checkouts `paid` confirmados via webhook | Disputas/chargebacks |
| 4 | **C4 — Agenda (MVP)** | % de pedidos com horário combinado | Cancelamentos pós-agendamento |
| 5 | **C7 — Chat: anexos + 2–3 respostas rápidas** | Redução de idas ao WhatsApp antes do necessário | Abuso de mídia (moderar tamanho/tipo) |

**Ordem sugerida de implementação:** C1 e C5 em paralelo (baixa dependência entre si) → C2 → C4 (com e-mails de lembrete via C1) → C7.

---

## 6. Atualização do roadmap legado

A seção “Validação: lacunas principais” do arquivo [`.cursor/plans/roadmap_produto_reparatudo_bbf3c4b9.plan.md`](../.cursor/plans/roadmap_produto_reparatudo_bbf3c4b9.plan.md) deve ser lida como **histórico**; o estado vigente é o da tabela da **seção 1** deste documento.
