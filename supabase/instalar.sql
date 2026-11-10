-- ════════════════════════════════════════════════════════════════
--  Reportes de errores · instalación en Supabase
--  Pegá TODO este archivo en Supabase > SQL Editor > New query > Run.
--  Se puede correr más de una vez sin romper nada.
--
--  Cuentas: los jugadores se registran con usuario + contraseña desde la página.
--  Por dentro, Supabase guarda "usuario@<dominioCuentas>" como mail (nunca se manda nada).
-- ════════════════════════════════════════════════════════════════

-- ─── Perfiles (nombre de usuario visible) ──────────────────────
create table if not exists public.perfiles (
  id      uuid primary key references auth.users (id) on delete cascade,
  usuario text not null check (usuario ~ '^[A-Za-z0-9_.-]{3,20}$'),
  creado  timestamptz not null default now()
);
create unique index if not exists perfiles_usuario_idx on public.perfiles (lower(usuario));
alter table public.perfiles enable row level security;
drop policy if exists "perfiles: leer" on public.perfiles;
create policy "perfiles: leer" on public.perfiles for select to anon, authenticated using (true);
grant select on public.perfiles to anon, authenticated;

-- Cada cuenta nueva crea su perfil con el usuario que eligió en la página.
create or replace function public.nuevo_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  u text := coalesce(nullif(new.raw_user_meta_data ->> 'usuario', ''), split_part(new.email, '@', 1));
begin
  if u !~ '^[A-Za-z0-9_.-]{3,20}$' then
    u := 'jugador_' || left(replace(new.id::text, '-', ''), 8);
  end if;
  insert into public.perfiles (id, usuario) values (new.id, u) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists nuevo_usuario on auth.users;
create trigger nuevo_usuario after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- Cuentas creadas antes de correr este archivo (por ejemplo, desde el panel).
insert into public.perfiles (id, usuario)
select id,
       case when coalesce(raw_user_meta_data ->> 'usuario', split_part(email, '@', 1)) ~ '^[A-Za-z0-9_.-]{3,20}$'
            then coalesce(raw_user_meta_data ->> 'usuario', split_part(email, '@', 1))
            else 'jugador_' || left(replace(id::text, '-', ''), 8) end
from auth.users
on conflict do nothing;

-- ─── Administradores ───────────────────────────────────────────
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creado  timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Nadie lee ni escribe esta tabla desde la página: se maneja desde el SQL Editor.

create or replace function public.es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.es_admin() to anon, authenticated;

-- ─── Fotos: solo rutas de nuestro propio bucket ────────────────
create or replace function public.fotos_validas(f text[])
returns boolean
language sql immutable
as $$
  select coalesce(cardinality(f), 0) <= 6
     and not exists (
       select 1 from unnest(coalesce(f, '{}')) as x
       where x !~ '^reportes/[0-9]{4}-[0-9]{2}/[A-Za-z0-9-]{8,64}\.(webp|jpg|png|gif)$'
     );
$$;

-- ─── Reportes ──────────────────────────────────────────────────
create table if not exists public.reportes (
  id            bigint generated always as identity primary key,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now(),
  cerrado       timestamptz,
  titulo        text not null check (char_length(titulo) between 3 and 120),
  categoria     text not null default 'otro' check (char_length(categoria) between 1 and 40),
  gravedad      text not null default 'media' check (gravedad in ('baja', 'media', 'alta', 'critica')),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'en_progreso', 'arreglado', 'descartado')),
  donde         text check (char_length(donde) <= 200),
  sucede        text not null check (char_length(sucede) between 3 and 4000),
  esperado      text check (char_length(esperado) <= 2000),
  pasos         text check (char_length(pasos) <= 4000),
  notas         text check (char_length(notas) <= 2000),
  autor         text check (char_length(autor) <= 60),
  fotos         text[] not null default '{}' check (public.fotos_validas(fotos)),
  respuesta     text check (char_length(respuesta) <= 2000),
  votos         integer not null default 0,
  n_comentarios integer not null default 0
);
alter table public.reportes add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists reportes_estado_idx on public.reportes (estado, creado desc);
create index if not exists reportes_usuario_idx on public.reportes (user_id);

-- Lo que manda un jugador sale con SU usuario y no puede venir "ya arreglado", con votos, etc.
create or replace function public.reportes_antes()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.es_admin() then
      new.user_id := auth.uid();
      new.autor := (select usuario from public.perfiles where id = auth.uid());
      new.creado := now();
      new.estado := 'pendiente';
      new.respuesta := null;
      new.votos := 0;
      new.n_comentarios := 0;
      new.cerrado := null;
    end if;
    new.actualizado := new.creado;
    if new.estado in ('arreglado', 'descartado') and new.cerrado is null then
      new.cerrado := new.creado;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.estado is distinct from old.estado then
    new.cerrado := case when new.estado in ('arreglado', 'descartado') then now() else null end;
  end if;
  if (new.estado, new.titulo, new.categoria, new.gravedad, coalesce(new.respuesta, ''))
     is distinct from
     (old.estado, old.titulo, old.categoria, old.gravedad, coalesce(old.respuesta, '')) then
    new.actualizado := now();
  end if;
  new.creado := old.creado;
  new.user_id := old.user_id;
  return new;
end;
$$;
drop trigger if exists reportes_antes on public.reportes;
create trigger reportes_antes before insert or update on public.reportes
  for each row execute function public.reportes_antes();

alter table public.reportes enable row level security;

drop policy if exists "reportes: leer"         on public.reportes;
drop policy if exists "reportes: crear"        on public.reportes;
drop policy if exists "reportes: crear admin"  on public.reportes;
drop policy if exists "reportes: editar admin" on public.reportes;
drop policy if exists "reportes: borrar admin" on public.reportes;

create policy "reportes: leer" on public.reportes
  for select to anon, authenticated using (true);
create policy "reportes: crear" on public.reportes
  for insert to authenticated with check (auth.uid() is not null);   -- solo con cuenta
create policy "reportes: editar admin" on public.reportes
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "reportes: borrar admin" on public.reportes
  for delete to authenticated using (public.es_admin());

revoke insert, update, delete on public.reportes from anon;
grant select on public.reportes to anon, authenticated;
grant insert, update, delete on public.reportes to authenticated;

-- ─── Votos: uno por cuenta y por reporte ───────────────────────
create table if not exists public.votos (
  reporte_id bigint not null references public.reportes (id) on delete cascade,
  user_id    uuid   not null references auth.users (id) on delete cascade,
  creado     timestamptz not null default now(),
  primary key (reporte_id, user_id)
);
alter table public.votos enable row level security;
drop policy if exists "votos: los mios" on public.votos;
create policy "votos: los mios" on public.votos
  for select to authenticated using (user_id = auth.uid());
grant select on public.votos to authenticated;

create or replace function public.votar(p_id bigint)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'Necesitás una cuenta para votar';
  end if;
  insert into public.votos (reporte_id, user_id)
  select p_id, auth.uid()
  where exists (select 1 from public.reportes where id = p_id and estado in ('pendiente', 'en_progreso'))
  on conflict do nothing;
  if found then
    update public.reportes set votos = votos + 1 where id = p_id;
  end if;
  select votos into n from public.reportes where id = p_id;
  return n;
end;
$$;
revoke all on function public.votar(bigint) from public;
revoke all on function public.votar(bigint) from anon;
grant execute on function public.votar(bigint) to authenticated;

-- ─── Comentarios ───────────────────────────────────────────────
create table if not exists public.comentarios (
  id         bigint generated always as identity primary key,
  reporte_id bigint not null references public.reportes (id) on delete cascade,
  creado     timestamptz not null default now(),
  autor      text not null default 'Anónimo' check (char_length(autor) between 1 and 60),
  texto      text not null check (char_length(texto) between 1 and 1500),
  es_admin   boolean not null default false
);
alter table public.comentarios add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists comentarios_reporte_idx on public.comentarios (reporte_id, creado);

create or replace function public.comentarios_antes()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.creado := now();
  new.user_id := auth.uid();
  new.autor := coalesce((select usuario from public.perfiles where id = auth.uid()), 'Anónimo');
  new.es_admin := public.es_admin();   -- la etiqueta Staff sale sola y nadie la puede falsificar
  return new;
end;
$$;
drop trigger if exists comentarios_antes on public.comentarios;
create trigger comentarios_antes before insert on public.comentarios
  for each row execute function public.comentarios_antes();

create or replace function public.comentarios_contar()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.reportes set n_comentarios = n_comentarios + 1 where id = new.reporte_id;
  else
    update public.reportes set n_comentarios = greatest(n_comentarios - 1, 0) where id = old.reporte_id;
  end if;
  return null;
end;
$$;
drop trigger if exists comentarios_contar on public.comentarios;
create trigger comentarios_contar after insert or delete on public.comentarios
  for each row execute function public.comentarios_contar();

alter table public.comentarios enable row level security;
drop policy if exists "comentarios: leer"         on public.comentarios;
drop policy if exists "comentarios: crear"        on public.comentarios;
drop policy if exists "comentarios: borrar admin" on public.comentarios;
create policy "comentarios: leer" on public.comentarios
  for select to anon, authenticated using (true);
create policy "comentarios: crear" on public.comentarios
  for insert to authenticated with check (auth.uid() is not null);
create policy "comentarios: borrar admin" on public.comentarios
  for delete to authenticated using (public.es_admin());

revoke insert, update, delete on public.comentarios from anon;
grant select on public.comentarios to anon, authenticated;
grant insert, delete on public.comentarios to authenticated;

-- ─── Fotos (Storage) ───────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capturas', 'capturas', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "capturas: subir"        on storage.objects;
drop policy if exists "capturas: borrar admin" on storage.objects;
create policy "capturas: subir" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'capturas' and name ~ '^reportes/[0-9]{4}-[0-9]{2}/[A-Za-z0-9-]{8,64}\.(webp|jpg|png|gif)$');
create policy "capturas: borrar admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'capturas' and public.es_admin());

-- ─── Tiempo real (la lista se actualiza sola) ──────────────────
do $$
begin
  alter publication supabase_realtime add table public.reportes;
exception when duplicate_object then null;
end $$;

-- ════════════════════════════════════════════════════════════════
--  ÚLTIMO PASO (una sola vez): hacerte administrador.
--  1) Creá tu cuenta en la página como cualquier jugador ("Entrar" > "Crear cuenta").
--  2) Cambiá el usuario de abajo por el tuyo y corré SOLO estas líneas:
--
--  insert into public.admins (user_id)
--  select id from public.perfiles where lower(usuario) = lower('TU-USUARIO')
--  on conflict do nothing;
-- ════════════════════════════════════════════════════════════════
