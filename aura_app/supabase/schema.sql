-- =====================================================================
-- Aura · esquema de servidor (Supabase / PostgreSQL 15+)
-- Ejecutar una vez en: Supabase → SQL Editor → New query → pegar → Run
-- Multiempresa, permisos por rol con RLS y registro de jornada inalterable
-- sellado en el servidor (cadena SHA-256 por empresa).
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- Tablas ----------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  qr_secret text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id text not null,
  role text not null check (role in ('admin', 'manager', 'employee')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id),
  unique (company_id, employee_id)
);

create table if not exists public.invites (
  code text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id text not null,
  role text not null check (role in ('admin', 'manager', 'employee')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid,
  used_at timestamptz
);

-- Datos de la app como documentos JSON por colección (empleados, ausencias, gastos, turnos…)
create table if not exists public.records (
  company_id uuid not null references public.companies(id) on delete cascade,
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (company_id, collection, id)
);

-- Registro de jornada: solo se inserta mediante clock(); no hay UPDATE ni DELETE.
create table if not exists public.punches (
  company_id uuid not null references public.companies(id) on delete cascade,
  seq bigint not null,
  id text not null,
  emp_id text not null,
  type text not null check (type in ('in', 'out', 'break_start', 'break_end')),
  ts bigint not null,
  lat text,
  lng text,
  acc integer,
  zone text not null default '',      -- id de centro, '∅' fuera de zona, '' sin ubicación
  remote boolean not null default false,
  method text not null,
  flags text[] not null default '{}',
  note text,
  selfie text,
  prev_hash text not null,
  hash text not null,
  received_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  primary key (company_id, seq),
  unique (company_id, id)
);

create index if not exists punches_emp on public.punches (company_id, emp_id, ts);
create index if not exists records_coll on public.records (company_id, collection);

-- ---------- Funciones de permisos ----------
create or replace function public.my_role(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from members where company_id = c and user_id = auth.uid()
$$;

create or replace function public.my_emp(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select employee_id from members where company_id = c and user_id = auth.uid()
$$;

create or replace function public.is_manager(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role(c) in ('admin', 'manager'), false)
$$;

-- ---------- RLS ----------
alter table public.companies enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.records enable row level security;
alter table public.punches enable row level security;

drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies for select using (my_role(id) is not null);
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update using (my_role(id) = 'admin');

drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (my_role(company_id) is not null);
drop policy if exists members_admin on public.members;
create policy members_admin on public.members for update using (my_role(company_id) = 'admin');
drop policy if exists members_admin_del on public.members;
create policy members_admin_del on public.members for delete using (my_role(company_id) = 'admin' and user_id <> auth.uid());

drop policy if exists invites_read on public.invites;
create policy invites_read on public.invites for select using (is_manager(company_id));

-- Lectura: responsables todo; el resto, lo compartido y lo suyo (salarios, gastos y correcciones ajenas, no)
drop policy if exists records_read on public.records;
create policy records_read on public.records for select using (
  my_role(company_id) is not null and (
    is_manager(company_id)
    or collection in ('employees', 'zones', 'shifts', 'requests', 'company')
    or (collection = 'documents' and data->'audience' ? my_emp(company_id))
    or data->>'empId' = my_emp(company_id)
    or (collection = 'payroll' and id = my_emp(company_id))
  )
);

-- Escritura: responsables todo; empleados solo sus solicitudes pendientes, gastos pendientes y envío de su hoja
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert with check (
  is_manager(company_id) or (
    my_role(company_id) is not null
    and data->>'empId' = my_emp(company_id)
    and collection in ('requests', 'corrections', 'expenses')
    and data->>'status' = 'pending'
  )
);
drop policy if exists records_update on public.records;
create policy records_update on public.records for update using (
  is_manager(company_id) or (
    data->>'empId' = my_emp(company_id)
    and ((collection in ('requests', 'corrections', 'expenses') and data->>'status' = 'pending') or (collection = 'periods' and data->>'status' = 'open'))
  )
) with check (
  is_manager(company_id) or (
    data->>'empId' = my_emp(company_id)
    and ((collection in ('requests', 'corrections', 'expenses') and data->>'status' = 'pending') or (collection = 'periods' and data->>'status' in ('open', 'submitted')))
  )
);
drop policy if exists records_delete on public.records;
create policy records_delete on public.records for delete using (
  is_manager(company_id) or (
    data->>'empId' = my_emp(company_id)
    and collection in ('requests', 'expenses') and data->>'status' = 'pending'
  )
);

drop policy if exists punches_read on public.punches;
create policy punches_read on public.punches for select using (
  is_manager(company_id) or emp_id = my_emp(company_id)
);
-- (sin políticas de insert/update/delete: nadie puede alterar el registro directamente)

-- ---------- Sellado en servidor ----------
-- Misma cadena canónica que la app (src/lib/ledger.ts), para que cualquiera pueda verificarla.
create or replace function public.punch_canonical(p public.punches) returns text
language sql immutable set search_path = public, extensions as $$
  select concat_ws('|',
    p.seq::text, p.emp_id, p.type, p.ts::text, coalesce(p.lat, ''), coalesce(p.lng, ''), coalesce(p.acc::text, ''),
    p.zone, case when p.remote then '1' else '0' end, p.method, array_to_string(p.flags, ','), coalesce(p.note, ''),
    case when p.selfie is null or p.selfie = '' then '' else encode(extensions.digest(p.selfie, 'sha256'), 'hex') end,
    p.prev_hash)
$$;

create or replace function public.clock(c uuid, p jsonb) returns public.punches
language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.punches;
  last_hash text;
  last_seq bigint;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  me text := my_emp(c);
begin
  if me is null then raise exception 'No perteneces a esta empresa'; end if;
  -- Cada persona ficha lo suyo; los responsables pueden fichar por otros (quiosco, correcciones aprobadas)
  if p->>'empId' <> me and not is_manager(c) then raise exception 'Solo puedes fichar por ti'; end if;
  if (p->>'method') in ('correction', 'import') and not is_manager(c) then raise exception 'Solo un responsable puede registrar correcciones o importar'; end if;

  perform pg_advisory_xact_lock(hashtext(c::text));
  select seq, hash into last_seq, last_hash from punches where company_id = c order by seq desc limit 1;

  r.company_id := c;
  r.seq := coalesce(last_seq, 0) + 1;
  r.id := coalesce(p->>'id', gen_random_uuid()::text);
  r.emp_id := p->>'empId';
  r.type := p->>'type';
  r.ts := coalesce((p->>'ts')::bigint, now_ms);
  r.lat := p->>'lat';
  r.lng := p->>'lng';
  r.acc := (p->>'acc')::int;
  r.zone := coalesce(p->>'zone', '');
  r.remote := coalesce((p->>'remote')::boolean, false);
  r.method := coalesce(p->>'method', 'app');
  r.flags := coalesce(array(select jsonb_array_elements_text(p->'flags')), '{}');
  -- Reloj del dispositivo manipulado (salvo correcciones, que son retroactivas por definición)
  if r.method not in ('correction', 'import') and abs(r.ts - now_ms) > 5 * 60 * 1000 then r.flags := array_append(r.flags, 'hora_dispositivo'); end if;
  r.note := p->>'note';
  r.selfie := p->>'selfie';
  r.prev_hash := coalesce(last_hash, repeat('0', 64));
  r.received_at := clock_timestamp();
  r.user_id := auth.uid();
  r.hash := encode(digest(punch_canonical(r), 'sha256'), 'hex');
  insert into punches values (r.*);
  return r;
end $$;

-- Importación masiva del histórico de otro sistema (cada fichaje queda marcado method = 'import')
create or replace function public.clock_import(c uuid, ps jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare p jsonb; n integer := 0;
begin
  if not is_manager(c) then raise exception 'Solo un responsable puede importar'; end if;
  for p in select * from jsonb_array_elements(ps) loop
    perform clock(c, p || jsonb_build_object('method', 'import'));
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- Alta de empresa, invitaciones y firma ----------
create or replace function public.create_company(company_name text, employee jsonb, payroll jsonb, company_data jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  insert into companies (name) values (company_name) returning id into c;
  insert into members (company_id, user_id, employee_id, role) values (c, auth.uid(), employee->>'id', 'admin');
  insert into records (company_id, collection, id, data) values
    (c, 'employees', employee->>'id', employee),
    (c, 'payroll', employee->>'id', payroll),
    (c, 'company', 'main', company_data);
  return c;
end $$;

create or replace function public.create_invite(c uuid, employee_id text, invite_role text default 'employee')
returns text language plpgsql security definer set search_path = public, extensions as $$
declare code text := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
begin
  if not is_manager(c) then raise exception 'Solo los responsables pueden invitar'; end if;
  if invite_role = 'admin' and my_role(c) <> 'admin' then raise exception 'Solo un administrador puede invitar administradores'; end if;
  insert into invites (code, company_id, employee_id, role) values (code, c, employee_id, invite_role);
  return code;
end $$;

create or replace function public.claim_invite(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i invites;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into i from invites where code = upper(trim(invite_code)) for update;
  if i is null or i.used_by is not null or i.expires_at < now() then raise exception 'Código no válido o caducado'; end if;
  insert into members (company_id, user_id, employee_id, role) values (i.company_id, auth.uid(), i.employee_id, i.role)
    on conflict (company_id, user_id) do update set employee_id = excluded.employee_id, role = excluded.role;
  update invites set used_by = auth.uid(), used_at = now() where code = i.code;
  return i.company_id;
end $$;

-- Firma: solo la persona destinataria, una vez, sin tocar el contenido del documento
create or replace function public.sign_document(c uuid, doc_id text, signature jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d jsonb; me text := my_emp(c);
begin
  if me is null then raise exception 'No perteneces a esta empresa'; end if;
  select data into d from records where company_id = c and collection = 'documents' and id = doc_id for update;
  if d is null then raise exception 'Documento no encontrado'; end if;
  if not (d->'audience' ? me) then raise exception 'Este documento no es para ti'; end if;
  if exists (select 1 from jsonb_array_elements(d->'signatures') s where s->>'empId' = me) then raise exception 'Ya lo has firmado'; end if;
  signature := signature || jsonb_build_object('empId', me, 'serverTs', floor(extract(epoch from now()) * 1000));
  d := jsonb_set(d, '{signatures}', coalesce(d->'signatures', '[]'::jsonb) || signature);
  update records set data = d, updated_at = now(), updated_by = auth.uid() where company_id = c and collection = 'documents' and id = doc_id;
  return d;
end $$;

grant execute on function public.clock, public.clock_import, public.create_company, public.create_invite, public.claim_invite, public.sign_document, public.my_role, public.my_emp, public.is_manager to authenticated;

-- ---------- Tiempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.records; exception when others then null; end;
  begin alter publication supabase_realtime add table public.punches; exception when others then null; end;
end $$;

-- ---------- Archivos (Supabase Storage) ----------
-- Ruta: <empresa>/<empleado | "empresa">/<archivo>. Cada persona ve sus archivos y los de empresa; responsables, todos.
do $$ begin
  insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false) on conflict (id) do nothing;
  drop policy if exists aura_files_read on storage.objects;
  create policy aura_files_read on storage.objects for select using (
    bucket_id = 'documentos' and (
      public.is_manager(((storage.foldername(name))[1])::uuid)
      or (storage.foldername(name))[2] in ('empresa', public.my_emp(((storage.foldername(name))[1])::uuid))
    )
  );
  drop policy if exists aura_files_write on storage.objects;
  create policy aura_files_write on storage.objects for insert with check (
    bucket_id = 'documentos' and public.is_manager(((storage.foldername(name))[1])::uuid)
  );
exception when undefined_table or invalid_schema_name then
  raise notice 'Storage no disponible en esta base de datos: se omiten los archivos';
end $$;
