-- Chiefs News: editorial revisions, curated homepage, accounts and discussions.
-- Apply through Supabase migrations as the database owner.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from anon, authenticated;

create type public.app_role as enum ('reader', 'editor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80 and display_name ~ '\S'),
  created_at timestamptz not null default now()
);
create table private.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'reader',
  must_change_password boolean not null default false,
  initial_password_hash text,
  updated_at timestamptz not null default now()
);
create table private.bootstrap_state (
  id boolean primary key default true check (id),
  admin_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select coalesce((select role from private.user_roles where user_id = auth.uid()), 'reader'::public.app_role)
$$;
create function private.can_edit() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.user_roles r join auth.users u on u.id=r.user_id where r.user_id = auth.uid()
    and r.role in ('editor','admin') and not r.must_change_password and u.email_confirmed_at is not null)
$$;
create function private.can_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.user_roles r join auth.users u on u.id=r.user_id where r.user_id = auth.uid()
    and r.role = 'admin' and not r.must_change_password and u.email_confirmed_at is not null)
$$;
create function private.require_editor() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_edit() then
    raise exception using errcode = '42501', message = 'Editor access is required. Complete any required password change first.';
  end if;
end $$;

create function private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare name text;
begin
  name := btrim(coalesce(new.raw_user_meta_data->>'display_name','Reader'));
  if length(name) not between 1 and 80 or name !~ '\S' or lower(name) in ('admin','administrator','system') then name := 'Reader'; end if;
  insert into public.profiles(id, display_name) values(new.id, name);
  -- Never trust a role supplied in signup metadata.
  insert into private.user_roles(user_id, role) values(new.id, 'reader');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.on_auth_user_created();
-- Projects may already contain test Auth accounts when the migration is applied.
insert into public.profiles(id,display_name)
select id,case when length(btrim(coalesce(raw_user_meta_data->>'display_name',''))) between 1 and 80
  and raw_user_meta_data->>'display_name' ~ '\S'
  and lower(btrim(raw_user_meta_data->>'display_name')) not in ('admin','administrator','system')
  then btrim(raw_user_meta_data->>'display_name') else 'Reader' end
from auth.users on conflict(id) do nothing;
insert into private.user_roles(user_id,role) select id,'reader' from auth.users on conflict(user_id) do nothing;

create function public.get_current_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',p.id,'display_name',p.display_name,'role',r.role,
    'must_change_password',r.must_change_password)
  from public.profiles p join private.user_roles r on r.user_id=p.id where p.id=auth.uid()
$$;
create function public.update_display_name(p_display_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in first.'; end if;
  if length(btrim(p_display_name)) not between 1 and 80 or p_display_name is null or p_display_name !~ '\S' then
    raise exception using errcode='22023',message='Display name must contain 1–80 characters.';
  end if;
  if lower(btrim(p_display_name)) in ('admin','administrator','system') and public.current_app_role()<>'admin' then
    raise exception using errcode='22023',message='That display name is reserved.';
  end if;
  update public.profiles set display_name=btrim(p_display_name) where id=auth.uid();
  return public.get_current_profile();
end $$;
create function public.complete_password_change() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare account private.user_roles; password_hash text;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in first.'; end if;
  select * into account from private.user_roles where user_id=auth.uid() for update;
  if account.must_change_password then
    select encrypted_password into password_hash from auth.users where id=auth.uid();
    if password_hash is null or password_hash is not distinct from account.initial_password_hash then
      raise exception using errcode='42501',message='Change your password before continuing.';
    end if;
    update private.user_roles set must_change_password=false,initial_password_hash=null,updated_at=now() where user_id=auth.uid();
  end if;
  return public.get_current_profile();
end $$;

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  published_revision_id uuid,
  draft_revision_id uuid,
  version bigint not null default 0,
  first_published_at timestamptz not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.story_revisions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id),
  content jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(story_id,id)
);
alter table public.stories add constraint stories_published_revision_fkey
  foreign key(id,published_revision_id) references public.story_revisions(story_id,id);
alter table public.stories add constraint stories_draft_revision_fkey
  foreign key(id,draft_revision_id) references public.story_revisions(story_id,id);
create index story_revisions_history on public.story_revisions(story_id,created_at desc,id desc);
create function private.immutable_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Auth account deletion can anonymize attribution without changing the revision.
  if tg_op='UPDATE' then
    if new.created_by is null and old.created_by is not null
      and (to_jsonb(new)-'created_by')=(to_jsonb(old)-'created_by') then return new; end if;
  end if;
  raise exception using errcode='42501',message='Story revisions are immutable; save a new revision instead.';
end $$;
create trigger immutable_story_revision before update or delete on public.story_revisions
for each row execute function private.immutable_revision();

create table public.homepage_layout (
  id text primary key default 'home' check(id='home'),
  draft_slots jsonb not null default '{"leftTop":null,"leftBottom":null,"lead":null,"latest1":null,"latest2":null,"latest3":null,"latest4":null}',
  published_slots jsonb,
  version bigint not null default 0,
  published_version bigint not null default 0,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.homepage_layout(id) values('home');

create function public.is_homepage_story(p_story_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.homepage_layout h,
    lateral jsonb_each_text(h.published_slots) slot where slot.value=p_story_id::text)
$$;
create function private.validate_story_content(p_content jsonb,p_slug text) returns void
language plpgsql immutable set search_path = '' as $$
declare paragraph jsonb; link jsonb; paragraph_index integer; total_length bigint:=0;
begin
  if p_content is null or jsonb_typeof(p_content)<>'object' or octet_length(p_content::text)>262144
    or p_content->>'slug' is distinct from p_slug
    or jsonb_typeof(p_content->'title')<>'string' or length(btrim(p_content->>'title')) not between 1 and 240
    or p_content->>'title' !~ '\S'
    or jsonb_typeof(p_content->'dek')<>'string' or length(btrim(p_content->>'dek')) not between 1 and 1000
    or p_content->>'dek' !~ '\S'
    or jsonb_typeof(p_content->'paragraphs')<>'array' then
    raise exception using errcode='22023',message='A story needs a headline, dek and paragraphs within the allowed limits.';
  end if;
  if jsonb_array_length(p_content->'paragraphs') not between 1 and 200 then
    raise exception using errcode='22023',message='A story needs 1–200 paragraphs.';
  end if;
  for paragraph in select value from jsonb_array_elements(p_content->'paragraphs') loop
    if jsonb_typeof(paragraph)<>'string' or length(btrim(paragraph #>> '{}')) not between 1 and 20000 or (paragraph #>> '{}') !~ '\S' then
      raise exception using errcode='22023',message='Paragraphs must contain 1–20,000 characters.';
    end if;
    total_length:=total_length+length(paragraph #>> '{}');
  end loop;
  if total_length>100000 then raise exception using errcode='22023',message='The story is too long.'; end if;
  if jsonb_typeof(coalesce(p_content->'paragraphLinks','[]'::jsonb))<>'array' then
    raise exception using errcode='22023',message='Invalid paragraph links.';
  end if;
  for link in select value from jsonb_array_elements(coalesce(p_content->'paragraphLinks','[]'::jsonb)) loop
    if jsonb_typeof(link)<>'object' or jsonb_typeof(link->'paragraph')<>'number'
      or jsonb_typeof(link->'text')<>'string' or jsonb_typeof(link->'url')<>'string'
      or coalesce(link->>'paragraph','') !~ '^[0-9]{1,3}$' then
      raise exception using errcode='22023',message='Each attribution link needs a paragraph number.';
    end if;
    paragraph_index:=(link->>'paragraph')::integer;
    if paragraph_index>=jsonb_array_length(p_content->'paragraphs')
      or coalesce(length(link->>'text'),0)=0 or length(link->>'url')>2048
      or coalesce(link->>'url','') !~ '^https://[^[:space:]<>]+$'
      or strpos(p_content->'paragraphs'->>paragraph_index,link->>'text')=0 then
      raise exception using errcode='22023',message='Each attribution needs matching paragraph text and an HTTPS URL.';
    end if;
  end loop;
  if exists(select 1
    from jsonb_array_elements(coalesce(p_content->'paragraphLinks','[]'::jsonb)) with ordinality a(value,idx),
         jsonb_array_elements(coalesce(p_content->'paragraphLinks','[]'::jsonb)) with ordinality b(value,idx)
    where a.idx<b.idx and a.value->>'paragraph'=b.value->>'paragraph'
      and strpos(p_content->'paragraphs'->>(a.value->>'paragraph')::integer,a.value->>'text')
          < strpos(p_content->'paragraphs'->>(b.value->>'paragraph')::integer,b.value->>'text')+length(b.value->>'text')
      and strpos(p_content->'paragraphs'->>(b.value->>'paragraph')::integer,b.value->>'text')
          < strpos(p_content->'paragraphs'->>(a.value->>'paragraph')::integer,a.value->>'text')+length(a.value->>'text')) then
    raise exception using errcode='22023',message='Attribution links cannot overlap in a paragraph.';
  end if;
end $$;
create function private.validate_slots(p_slots jsonb,p_complete boolean) returns void
language plpgsql stable security definer set search_path = '' as $$
declare slot record; story_id uuid; seen uuid[]:='{}';
begin
  if jsonb_typeof(p_slots)<>'object' or (select count(*) from jsonb_object_keys(p_slots))<>7
    or not (p_slots ?& array['leftTop','leftBottom','lead','latest1','latest2','latest3','latest4']) then
    raise exception using errcode='22023',message='The homepage needs its seven named positions.';
  end if;
  for slot in select * from jsonb_each(p_slots) loop
    if slot.value='null'::jsonb then
      if p_complete then raise exception using errcode='22023',message='Fill all seven homepage positions before publishing.'; end if;
      continue;
    end if;
    if jsonb_typeof(slot.value)<>'string' or (slot.value #>> '{}') !~ '^[0-9a-fA-F-]{36}$' then
      raise exception using errcode='22023',message='Invalid story in homepage layout.';
    end if;
    begin story_id:=(slot.value #>> '{}')::uuid;
    exception when invalid_text_representation then raise exception using errcode='22023',message='Invalid story in homepage layout.'; end;
    if story_id=any(seen) then raise exception using errcode='22023',message='A story can only appear in one homepage position.'; end if;
    if not exists(select 1 from public.stories where id=story_id and published_revision_id is not null) then
      raise exception using errcode='22023',message='Only published stories can appear on the homepage.';
    end if;
    seen:=array_append(seen,story_id);
  end loop;
end $$;

create view public.published_stories with (security_invoker=true) as
select s.id,s.slug,s.published_revision_id as revision_id,s.first_published_at,s.published_at as updated_at,
  (r.content-'homepage'-'archived') || jsonb_build_object('archived',not public.is_homepage_story(s.id)) as content
from public.stories s join public.story_revisions r on r.id=s.published_revision_id and r.story_id=s.id;
-- This narrowly projected view deliberately uses owner privileges: the underlying
-- row also contains private draft slots, which are never granted to readers.
create view public.published_homepage with (security_barrier=true) as
select id,published_slots as slots,published_version as version,published_at as updated_at
from public.homepage_layout where published_slots is not null;

create function public.get_editor_stories() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_editor();
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'version',s.version,
    'published_revision_id',s.published_revision_id,'draft_revision_id',s.draft_revision_id,
    'published_content',p.content,'draft_content',d.content,'updated_at',s.updated_at)
    order by s.updated_at desc,s.slug),'[]'::jsonb) into result
  from public.stories s left join public.story_revisions p on p.id=s.published_revision_id
  left join public.story_revisions d on d.id=s.draft_revision_id;
  return result;
end $$;
create function public.save_story_draft(p_story_id uuid,p_content jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare story public.stories; base jsonb; content jsonb; revision_id uuid;
begin
  perform private.require_editor();
  select * into story from public.stories where id=p_story_id for update;
  if not found then raise exception using errcode='P0002',message='Story not found.'; end if;
  if p_expected_version is distinct from story.version then
    raise exception using errcode='40001',message='This story changed in another session. Reload before saving.';
  end if;
  select r.content into base from public.story_revisions r where r.id=coalesce(story.draft_revision_id,story.published_revision_id);
  -- Editorial form fields are writable; attribution/source/photo metadata stays intact.
  content:=base || jsonb_build_object('title',p_content->'title','dek',p_content->'dek',
    'paragraphs',p_content->'paragraphs','paragraphLinks',coalesce(p_content->'paragraphLinks','[]'::jsonb));
  perform private.validate_story_content(content,story.slug);
  content:=content || jsonb_build_object('wordCount',(select count(*) from
    regexp_split_to_table((select string_agg(value,' ') from jsonb_array_elements_text(content->'paragraphs')),'\s+') word where length(word)>0));
  insert into public.story_revisions(story_id,content,created_by) values(story.id,content,auth.uid()) returning id into revision_id;
  update public.stories set draft_revision_id=revision_id,version=version+1,updated_at=now() where id=story.id;
  return jsonb_build_object('id',story.id,'version',story.version+1,'revision_id',revision_id);
end $$;
create function public.publish_story(p_story_id uuid,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare story public.stories; content jsonb; revision_id uuid; local_date date:=(now() at time zone 'America/New_York')::date;
begin
  perform private.require_editor();
  select * into story from public.stories where id=p_story_id for update;
  if not found then raise exception using errcode='P0002',message='Story not found.'; end if;
  if p_expected_version is distinct from story.version then raise exception using errcode='40001',message='This story changed in another session. Reload before publishing.'; end if;
  if story.draft_revision_id is null then raise exception using errcode='22023',message='Save a draft before publishing.'; end if;
  select r.content into content from public.story_revisions r where r.id=story.draft_revision_id;
  perform private.validate_story_content(content,story.slug);
  content:=content || jsonb_build_object('updated',local_date::text,'dateLabel','Updated '||to_char(local_date,'Mon. FMDD, YYYY'));
  insert into public.story_revisions(story_id,content,created_by) values(story.id,content,auth.uid()) returning id into revision_id;
  update public.stories set published_revision_id=revision_id,draft_revision_id=revision_id,version=version+1,published_at=now(),updated_at=now() where id=story.id;
  return jsonb_build_object('id',story.id,'version',story.version+1,'revision_id',revision_id);
end $$;
create function public.get_story_history(p_story_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_editor();
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'content',r.content,'created_at',r.created_at,'created_by',r.created_by,
    'published',r.id=s.published_revision_id,'draft',r.id=s.draft_revision_id) order by r.created_at desc,r.id desc),'[]'::jsonb)
  into result from public.story_revisions r join public.stories s on s.id=r.story_id where r.story_id=p_story_id;
  return result;
end $$;
create function public.get_editor_layout() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_editor();
  select to_jsonb(h) into result from public.homepage_layout h where id='home';
  return result;
end $$;
create function public.save_homepage_draft(p_slots jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare layout public.homepage_layout;
begin
  perform private.require_editor();
  select * into layout from public.homepage_layout where id='home' for update;
  if p_expected_version is distinct from layout.version then raise exception using errcode='40001',message='The layout changed in another session. Reload before saving.'; end if;
  perform private.validate_slots(p_slots,false);
  update public.homepage_layout set draft_slots=p_slots,version=version+1,updated_at=now() where id='home';
  return jsonb_build_object('id','home','version',layout.version+1,'draft_slots',p_slots,'published_slots',layout.published_slots);
end $$;
create function public.publish_homepage(p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare layout public.homepage_layout;
begin
  perform private.require_editor();
  select * into layout from public.homepage_layout where id='home' for update;
  if p_expected_version is distinct from layout.version then raise exception using errcode='40001',message='The layout changed in another session. Reload before publishing.'; end if;
  perform private.validate_slots(layout.draft_slots,true);
  update public.homepage_layout set published_slots=draft_slots,version=version+1,published_version=version+1,published_at=now(),updated_at=now() where id='home';
  return jsonb_build_object('id','home','version',layout.version+1,'slots',layout.draft_slots);
end $$;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(length(btrim(body)) between 1 and 2000 and body ~ '\S'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_thread_created on public.comments(story_id,created_at desc,id desc) where deleted_at is null;
create index comments_user_created on public.comments(user_id,created_at desc);
create function public.list_comments(p_story_id uuid default null,p_limit integer default 20,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc,c.id desc),'[]'::jsonb) from (
    select c.id,c.story_id,c.user_id,c.body,c.created_at,c.updated_at,p.display_name,r.role as author_role
    from public.comments c join public.profiles p on p.id=c.user_id join private.user_roles r on r.user_id=c.user_id
    where c.deleted_at is null and c.story_id is not distinct from p_story_id
      and (c.story_id is null or exists(select 1 from public.stories s where s.id=c.story_id and s.published_revision_id is not null))
      and (p_before is null or c.created_at<p_before or (c.created_at=p_before and p_before_id is not null and c.id<p_before_id))
    order by c.created_at desc,c.id desc limit greatest(1,least(coalesce(p_limit,20),50))
  ) c
$$;
create function private.require_verified_reader() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception using errcode='42501',message='Verify your email and sign in to comment.';
  end if;
  if exists(select 1 from private.user_roles where user_id=auth.uid() and must_change_password) then
    raise exception using errcode='42501',message='Change your initial password before commenting.';
  end if;
end $$;
create function public.create_comment(p_story_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare comment public.comments;
begin
  perform private.require_verified_reader();
  if p_body is null or length(btrim(p_body)) not between 1 and 2000 or p_body !~ '\S' then raise exception using errcode='22023',message='Comments must contain 1–2,000 characters.'; end if;
  if p_story_id is not null and not exists(select 1 from public.stories where id=p_story_id and published_revision_id is not null) then
    raise exception using errcode='P0002',message='Story not found.';
  end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  if (select count(*) from public.comments where user_id=auth.uid() and created_at>now()-interval '1 minute')>=10 then
    raise exception using errcode='P0001',message='Please wait a moment before posting another comment.';
  end if;
  insert into public.comments(story_id,user_id,body) values(p_story_id,auth.uid(),btrim(p_body)) returning * into comment;
  return to_jsonb(comment);
end $$;
create function public.update_comment(p_comment_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare comment public.comments;
begin
  perform private.require_verified_reader();
  select * into comment from public.comments where id=p_comment_id and deleted_at is null for update;
  if not found then raise exception using errcode='P0002',message='Comment not found.'; end if;
  if comment.user_id<>auth.uid() then raise exception using errcode='42501',message='You can only edit your own comments.'; end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 2000 or p_body !~ '\S' then raise exception using errcode='22023',message='Comments must contain 1–2,000 characters.'; end if;
  update public.comments set body=btrim(p_body),updated_at=now() where id=comment.id returning * into comment;
  return to_jsonb(comment);
end $$;
create function public.delete_comment(p_comment_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare comment public.comments;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in first.'; end if;
  select * into comment from public.comments where id=p_comment_id and deleted_at is null for update;
  if not found then raise exception using errcode='P0002',message='Comment not found.'; end if;
  if comment.user_id<>auth.uid() and not private.can_edit() then raise exception using errcode='42501',message='You can only remove your own comments.'; end if;
  update public.comments set deleted_at=now(),updated_at=now() where id=comment.id;
  return jsonb_build_object('id',comment.id,'deleted',true);
end $$;

create function public.list_app_users() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.can_admin() then raise exception using errcode='42501',message='Administrator access is required.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'email',u.email,'role',r.role,
    'created_at',p.created_at,'must_change_password',r.must_change_password) order by p.created_at desc),'[]'::jsonb)
  into result from public.profiles p join private.user_roles r on r.user_id=p.id join auth.users u on u.id=p.id;
  return result;
end $$;
create function public.set_user_role(p_user_id uuid,p_role public.app_role,p_expected_role public.app_role default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare previous_role public.app_role;
begin
  perform pg_advisory_xact_lock(hashtext('chiefs-admin-role-change'));
  if not private.can_admin() then raise exception using errcode='42501',message='Administrator access is required.'; end if;
  if p_role is null then raise exception using errcode='22023',message='Choose a valid role.'; end if;
  select role into previous_role from private.user_roles where user_id=p_user_id for update;
  if not found then raise exception using errcode='P0002',message='Account not found.'; end if;
  if p_expected_role is not null and previous_role is distinct from p_expected_role then
    raise exception using errcode='40001',message='This account role changed in another session. Reload before saving.';
  end if;
  if previous_role='admin' and p_role<>'admin' and (select count(*) from private.user_roles where role='admin')<=1 then
    raise exception using errcode='22023',message='Keep at least one administrator account.';
  end if;
  update private.user_roles set role=p_role,updated_at=now() where user_id=p_user_id;
  return jsonb_build_object('id',p_user_id,'role',p_role);
end $$;

-- These two administrative setup functions are executable only with the server
-- service credential, never with a browser publishable key or reader session.
create function public.initialize_admin(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing uuid; password_hash text;
begin
  perform pg_advisory_xact_lock(hashtext('chiefs-admin-bootstrap'));
  select admin_id into existing from private.bootstrap_state where id;
  if existing is not null then
    if existing<>p_user_id then raise exception using errcode='22023',message='An initial administrator has already been configured.'; end if;
    return jsonb_build_object('id',existing,'created',false);
  end if;
  select encrypted_password into password_hash from auth.users where id=p_user_id and email_confirmed_at is not null;
  if password_hash is null or password_hash='' then raise exception using errcode='22023',message='Create and confirm the administrator Auth account first.'; end if;
  insert into private.user_roles(user_id,role,must_change_password,initial_password_hash)
    values(p_user_id,'admin',true,password_hash)
    on conflict(user_id) do update set role='admin',must_change_password=true,initial_password_hash=excluded.initial_password_hash,updated_at=now();
  insert into private.bootstrap_state(id,admin_id) values(true,p_user_id);
  update public.profiles set display_name='Admin' where id=p_user_id;
  return jsonb_build_object('id',p_user_id,'created',true);
end $$;
create function public.get_bootstrap_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('initialized',exists(select 1 from private.bootstrap_state),
    'admin_id',(select admin_id from private.bootstrap_state where id))
$$;
create function public.import_legacy_content(p_articles jsonb,p_slots_by_slug jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare article jsonb; story_id uuid; revision_id uuid; imported integer:=0; slot record; slots jsonb:='{}'; layout public.homepage_layout;
begin
  perform pg_advisory_xact_lock(hashtext('chiefs-content-import'));
  if p_articles is null or jsonb_typeof(p_articles)<>'array' or jsonb_array_length(p_articles)=0 then raise exception using errcode='22023',message='Provide the legacy article array.'; end if;
  for article in select value from jsonb_array_elements(p_articles) loop
    perform private.validate_story_content(article,article->>'slug');
    if exists(select 1 from public.stories where slug=article->>'slug') then continue; end if;
    insert into public.stories(slug,first_published_at,published_at,updated_at) values(article->>'slug',(article->>'published')::date,
      coalesce(article->>'updated',article->>'published')::date,coalesce(article->>'updated',article->>'published')::date) returning id into story_id;
    insert into public.story_revisions(story_id,content) values(story_id,article) returning id into revision_id;
    update public.stories set published_revision_id=revision_id,draft_revision_id=revision_id,version=1 where id=story_id;
    imported:=imported+1;
  end loop;
  select * into layout from public.homepage_layout where id='home' for update;
  if layout.published_slots is null then
    if jsonb_typeof(p_slots_by_slug)<>'object' then raise exception using errcode='22023',message='Provide homepage positions by slug.'; end if;
    for slot in select * from jsonb_each_text(p_slots_by_slug) loop
      select id into story_id from public.stories where slug=slot.value;
      if story_id is null then raise exception using errcode='22023',message='A homepage story slug was not imported.'; end if;
      slots:=slots||jsonb_build_object(slot.key,story_id);
    end loop;
    perform private.validate_slots(slots,true);
    update public.homepage_layout set draft_slots=slots,published_slots=slots,version=1,published_version=1,published_at=now() where id='home';
  end if;
  return jsonb_build_object('imported',imported,'total',(select count(*) from public.stories));
end $$;

alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.story_revisions enable row level security;
alter table public.homepage_layout enable row level security;
alter table public.comments enable row level security;
create policy published_story_rows on public.stories for select to anon,authenticated using(published_revision_id is not null);
create policy published_revisions on public.story_revisions for select to anon,authenticated using(
  exists(select 1 from public.stories s where s.id=story_id and s.published_revision_id=story_revisions.id));
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy visible_comments on public.comments for select to anon,authenticated using(deleted_at is null and
  (story_id is null or exists(select 1 from public.stories s where s.id=comments.story_id and s.published_revision_id is not null)));

revoke all on public.profiles,public.stories,public.story_revisions,public.homepage_layout,public.comments from anon,authenticated;
grant select(id,slug,published_revision_id,first_published_at,published_at) on public.stories to anon,authenticated;
grant select(id,story_id,content) on public.story_revisions to anon,authenticated;
grant select on public.published_stories,public.published_homepage to anon,authenticated;
-- Access to all mutations and private projections is explicitly through RPCs.
revoke all on function public.current_app_role(),public.is_homepage_story(uuid),public.get_current_profile(),public.update_display_name(text),
  public.complete_password_change(),public.get_editor_stories(),public.save_story_draft(uuid,jsonb,bigint),public.publish_story(uuid,bigint),
  public.get_story_history(uuid),public.get_editor_layout(),public.save_homepage_draft(jsonb,bigint),public.publish_homepage(bigint),
  public.list_comments(uuid,integer,timestamptz,uuid),public.create_comment(uuid,text),public.update_comment(uuid,text),public.delete_comment(uuid),
  public.list_app_users(),public.set_user_role(uuid,public.app_role,public.app_role),public.initialize_admin(uuid),public.get_bootstrap_status(),public.import_legacy_content(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.current_app_role(),public.is_homepage_story(uuid),public.list_comments(uuid,integer,timestamptz,uuid) to anon,authenticated;
grant execute on function public.get_current_profile(),public.update_display_name(text),public.complete_password_change(),public.get_editor_stories(),
  public.save_story_draft(uuid,jsonb,bigint),public.publish_story(uuid,bigint),public.get_story_history(uuid),public.get_editor_layout(),
  public.save_homepage_draft(jsonb,bigint),public.publish_homepage(bigint),public.create_comment(uuid,text),public.update_comment(uuid,text),
  public.delete_comment(uuid),public.list_app_users(),public.set_user_role(uuid,public.app_role,public.app_role) to authenticated;
grant execute on function public.initialize_admin(uuid),public.get_bootstrap_status(),public.import_legacy_content(jsonb,jsonb) to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
