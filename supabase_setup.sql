-- Execute este SQL no Supabase Dashboard → SQL Editor

create table if not exists conversas (
  id uuid default gen_random_uuid() primary key,
  titulo text not null default 'Nova Conversa',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists mensagens (
  id uuid default gen_random_uuid() primary key,
  conversa_id uuid references conversas(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Habilita RLS
alter table conversas enable row level security;
alter table mensagens enable row level security;

-- Políticas de acesso (backend com service_role ignora RLS, anon key precisa das políticas)
create policy "Permitir tudo em conversas" on conversas for all using (true) with check (true);
create policy "Permitir tudo em mensagens" on mensagens for all using (true) with check (true);
