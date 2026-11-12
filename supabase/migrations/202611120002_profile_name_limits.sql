-- Align stored profile validation with signup/account forms without resetting data.
alter table public.profiles drop constraint profiles_display_name_check;
update public.profiles set display_name='Reader'
where length(btrim(display_name)) not between 2 and 60 or display_name !~ '\S';
alter table public.profiles add constraint profiles_display_name_check
  check(length(btrim(display_name)) between 2 and 60 and display_name ~ '\S');

create or replace function private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare name text;
begin
  name:=btrim(coalesce(new.raw_user_meta_data->>'display_name','Reader'));
  if length(name) not between 2 and 60 or name !~ '\S' or lower(name) in ('admin','administrator','system') then name:='Reader'; end if;
  insert into public.profiles(id,display_name) values(new.id,name);
  insert into private.user_roles(user_id,role) values(new.id,'reader');
  return new;
end $$;

create or replace function public.update_display_name(p_display_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in first.'; end if;
  if p_display_name is null or length(btrim(p_display_name)) not between 2 and 60 or p_display_name !~ '\S' then
    raise exception using errcode='22023',message='Display name must contain 2–60 characters.';
  end if;
  if lower(btrim(p_display_name)) in ('admin','administrator','system') and public.current_app_role()<>'admin' then
    raise exception using errcode='22023',message='That display name is reserved.';
  end if;
  update public.profiles set display_name=btrim(p_display_name) where id=auth.uid();
  return public.get_current_profile();
end $$;
