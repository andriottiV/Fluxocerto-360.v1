# Análise e Refatoração de Schema - FluxoCerto 360

## Estado Atual
- O projeto tinha estado financeiro apenas no frontend (AppContext), sem persistência real no backend.
- Não havia constraints de integridade para separar movimentações PF/PJ.
- Não existiam entidades explícitas de gastos fixos com ciclo de pagamento.

## Proposta Aplicada
- Criação de 3 entidades principais:
  - `pots` (saldo, meta e escopo)
  - `transactions` (entrada/saída com vínculo obrigatório a pote e `account_type_link`)
  - `fixed_expenses` (contas/gastos recorrentes e parcelados)

## Regras de Negócio Garantidas
- `account_type_link = 'pf'` só pode movimentar pote com `scope = 'pessoal'`.
- `account_type_link = 'pj'` só pode movimentar pote com `scope = 'negocio'`.
- `amount > 0` para qualquer transação.
- Em saída, bloqueio de saldo insuficiente no pote.

## Endpoints Cobertos
- Entradas/Saídas:
  - `POST /api/v1/transactions/income`
  - `POST /api/v1/transactions/expense`
- Potes:
  - `GET /api/v1/pots`
  - `POST /api/v1/pots`
  - `PATCH /api/v1/pots/:id/goal`
  - `GET /api/v1/pots/:id/balance`
- Contas/Gastos Fixos:
  - `GET /api/v1/fixed-expenses`
  - `POST /api/v1/fixed-expenses`
  - `PUT /api/v1/fixed-expenses/:id`
  - `DELETE /api/v1/fixed-expenses/:id`
- Dashboard:
  - `GET /api/v1/dashboard/summary`

## Próxima Evolução Recomendada
- Substituir store em memória por PostgreSQL.
- Materializar índices para `transactions(created_at)` e `transactions(account_type_link, type)`.
- Criar trigger SQL para validar PF/PJ x escopo do pote também no banco.
