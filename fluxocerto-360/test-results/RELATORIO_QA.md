# RELATÓRIO QA - FluxoCerto360

Gerado em: 01/05/2026, 09:52:32
Status geral: **APROVADO**

## Telas testadas
- Dashboard zerado
- Landing
- Login
- Onboarding - Diagnóstico
- ajustes
- ajustes desktop-1440
- ajustes mobile-360
- ajustes mobile-390
- ajustes notebook-1366
- ajustes tablet-768
- clientes
- clientes desktop-1440
- clientes mobile-360
- clientes mobile-390
- clientes notebook-1366
- clientes tablet-768
- consultor
- consultor desktop-1440
- consultor mobile-360
- consultor mobile-390
- consultor notebook-1366
- consultor tablet-768
- dashboard desktop-1440
- dashboard mobile-360
- dashboard mobile-390
- dashboard notebook-1366
- dashboard tablet-768
- financeiro desktop-1440
- financeiro mobile-360
- financeiro mobile-390
- financeiro notebook-1366
- financeiro tablet-768
- fluxo-caixa
- inicio
- itens-custos
- itens-custos desktop-1440
- itens-custos mobile-360
- itens-custos mobile-390
- itens-custos notebook-1366
- itens-custos tablet-768

## Regras financeiras validadas
- **PASS** Dashboard zerado para novo usuário: Onboarding não criou entrada, saldo nem pote com dinheiro fictício.
- **PASS** Meta mensal separada: Meta mensal foi persistida no onboarding e não virou transação.
- **PASS** Entrada R$100 no crédito: Bruto R$100, taxa R$3,49, líquido R$96,51 e potes receberam somente o líquido.
- **PASS** Saída por pote: Saída reduziu somente Pessoal em R$10.
- **PASS** Lucro líquido não confundido com saída pessoal: Entrada - taxas permaneceu R$96,51 no cenário sem custos.
- **PASS** Entrada por voz reflete no dashboard: Voz usa o mesmo motor da entrada manual: bruto, taxa, líquido, potes e dashboard foram atualizados.

## Checks de produto e navegação
- **PASS** Fórmula dinheiro livre pessoal: Pessoal=100, Negócio=500, Reserva=200 e compromisso pessoal=30 resultou em R$70; sem compromisso resultou em R$100.
- **PASS** KPIs do dashboard usam transações oficiais: Entradas, saídas, lucro líquido e gráfico refletiram a lista oficial de transações.
- **PASS** Dinheiro livre usa só pote Pessoal: Dinheiro livre não somou Negócio nem Reserva.
- **PASS** Sincronização por reload: Dados financeiros persistiram e foram recarregados na sessão simulada.
- **PASS** Regra admin: Administração não apareceu para usuário comum.
- **PASS** Consultor Flux: Uma pergunta gerou exatamente uma resposta do Flux, sem loop imediato.
- **PASS** Validação formulário vazio: Entrada manual vazia exibiu erro de validação.
- **PASS** Logout: Logout retornou para a landing.

## Bugs críticos (P0)
- Nenhum item encontrado.

## Bugs médios / alto impacto (P1)
- Nenhum item encontrado.

## Bugs visuais, UX e melhorias (P2)
- Nenhum item encontrado.

## Informações
- Nenhum item encontrado.

## Screenshots gerados
- test-results/screenshots/qa-chromium-01-landing-inicial.png
- test-results/screenshots/qa-chromium-02-login.png
- test-results/screenshots/qa-chromium-03-onboarding-diagnostico.png
- test-results/screenshots/qa-chromium-04-onboarding-estrutura.png
- test-results/screenshots/qa-chromium-05-onboarding-meta.png
- test-results/screenshots/qa-chromium-06-onboarding-ativacao.png
- test-results/screenshots/qa-chromium-07-dashboard-zerado.png
- test-results/screenshots/qa-chromium-08-modal-entrada-credito.png
- test-results/screenshots/qa-chromium-09-modal-saida-pote.png
- test-results/screenshots/qa-chromium-10-voz-mobile-preview.png
- test-results/screenshots/qa-chromium-10-voz-dashboard-atualizado.png
- test-results/screenshots/qa-chromium-10-nav-inicio.png
- test-results/screenshots/qa-chromium-10-nav-fluxo-caixa.png
- test-results/screenshots/qa-chromium-10-nav-consultor.png
- test-results/screenshots/qa-chromium-10-nav-clientes.png
- test-results/screenshots/qa-chromium-10-nav-itens-custos.png
- test-results/screenshots/qa-chromium-10-nav-ajustes.png
- test-results/screenshots/qa-chromium-11-consultor-resposta.png
- test-results/screenshots/qa-chromium-12-validacao-formulario-vazio.png
- test-results/screenshots/qa-chromium-responsive-desktop-1440-dashboard.png
- test-results/screenshots/qa-chromium-responsive-desktop-1440-financeiro.png
- test-results/screenshots/qa-chromium-responsive-desktop-1440-consultor.png
- test-results/screenshots/qa-chromium-responsive-desktop-1440-clientes.png
- test-results/screenshots/qa-chromium-responsive-desktop-1440-itens-custos.png
- test-results/screenshots/qa-chromium-responsive-desktop-1440-ajustes.png
- test-results/screenshots/qa-chromium-responsive-notebook-1366-dashboard.png
- test-results/screenshots/qa-chromium-responsive-notebook-1366-financeiro.png
- test-results/screenshots/qa-chromium-responsive-notebook-1366-consultor.png
- test-results/screenshots/qa-chromium-responsive-notebook-1366-clientes.png
- test-results/screenshots/qa-chromium-responsive-notebook-1366-itens-custos.png
- test-results/screenshots/qa-chromium-responsive-notebook-1366-ajustes.png
- test-results/screenshots/qa-chromium-responsive-tablet-768-dashboard.png
- test-results/screenshots/qa-chromium-responsive-tablet-768-financeiro.png
- test-results/screenshots/qa-chromium-responsive-tablet-768-consultor.png
- test-results/screenshots/qa-chromium-responsive-tablet-768-clientes.png
- test-results/screenshots/qa-chromium-responsive-tablet-768-itens-custos.png
- test-results/screenshots/qa-chromium-responsive-tablet-768-ajustes.png
- test-results/screenshots/qa-chromium-responsive-mobile-390-dashboard.png
- test-results/screenshots/qa-chromium-responsive-mobile-390-financeiro.png
- test-results/screenshots/qa-chromium-responsive-mobile-390-consultor.png
- test-results/screenshots/qa-chromium-responsive-mobile-390-clientes.png
- test-results/screenshots/qa-chromium-responsive-mobile-390-itens-custos.png
- test-results/screenshots/qa-chromium-responsive-mobile-390-ajustes.png
- test-results/screenshots/qa-chromium-responsive-mobile-360-dashboard.png
- test-results/screenshots/qa-chromium-responsive-mobile-360-financeiro.png
- test-results/screenshots/qa-chromium-responsive-mobile-360-consultor.png
- test-results/screenshots/qa-chromium-responsive-mobile-360-clientes.png
- test-results/screenshots/qa-chromium-responsive-mobile-360-itens-custos.png
- test-results/screenshots/qa-chromium-responsive-mobile-360-ajustes.png
- test-results/screenshots/qa-chromium-13-logout-landing.png

## Prioridade de correção sugerida
1. Corrigir qualquer P0 de regra financeira, persistência ou fluxo de autenticação.
2. Corrigir P1 de encoding, overflow horizontal e botões principais.
3. Refinar UX/copy indicada em P2 antes de aquisição paga.

## Correções aplicadas nesta rodada
- Entrada por voz validada no mesmo motor da entrada manual: bruto, taxa, líquido, potes e dashboard.
- Sincronização validada por reload/nova sessão simulada no QA.
- Quando Supabase está configurado, o app reconsulta dados ao focar a janela e por polling leve para refletir alterações de outro dispositivo.
- Fallback local continua ativo quando Supabase não está configurado.

## Status do comando de voz
- Botão mobile disponível no FAB global.
- Comando testado: entrada 100 no crédito corte João.
- Resultado esperado validado: entrou R$100, taxa R$3,49, líquido R$96,51 e potes atualizados.
