-- FluxoCerto 360 - Proposta de schema relacional
-- Objetivo: garantir integridade para PF/PJ, potes, transacoes e gastos fixos.

create table pots (
  id text primary key,
  name text not null,
  scope text not null check (scope in ('pessoal', 'negocio', 'reserva')),
  balance numeric(14,2) not null default 0 check (balance >= 0),
  goal numeric(14,2) not null check (goal > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table transactions (
  id text primary key,
  type text not null check (type in ('entrada', 'saida')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  category text not null,
  pot_id text not null references pots(id),
  account_type_link text not null check (account_type_link in ('pf', 'pj')),
  payment_method text not null check (payment_method in ('dinheiro', 'pix', 'debito', 'credito', 'transferencia')),
  created_at timestamptz not null default now()
);

create table fixed_expenses (
  id text primary key,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  account_type_link text not null check (account_type_link in ('pf', 'pj')),
  due_day int not null check (due_day between 1 and 31),
  installments int not null default 1 check (installments > 0),
  is_recurring boolean not null default true,
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Regra de negocio PF/PJ x Pote
-- PF -> scope pessoal
-- PJ -> scope negocio
--
-- Em produção, essa regra pode ser implementada com trigger BEFORE INSERT/UPDATE
-- em transactions para bloquear combinações inválidas.
