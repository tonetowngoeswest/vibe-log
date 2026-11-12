-- Actual-stack regression. Everything is rolled back, including the test user.
begin;
do $$
declare
  test_user uuid:=gen_random_uuid();
  target public.stories;
  before_revision public.story_revisions;
  after_revision public.story_revisions;
  blocked boolean:=false;
begin
  select * into strict target from public.stories where published_revision_id is not null limit 1;
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_user_meta_data)
  values(test_user,'authenticated','authenticated','test-creator-delete-'||test_user::text||'@example.test',
    'not-a-login-hash',now(),'{"display_name":"Cleanup regression"}');
  update private.user_roles set role='editor' where user_id=test_user;
  insert into public.story_revisions(story_id,content,created_by)
    select target.id,content,test_user from public.story_revisions where id=target.published_revision_id
    returning * into before_revision;
  delete from auth.users where id=test_user;
  select * into strict after_revision from public.story_revisions where id=before_revision.id;
  if after_revision.created_by is not null or
    (to_jsonb(before_revision)-'created_by')<>(to_jsonb(after_revision)-'created_by') then
    raise exception 'Creator cleanup altered an immutable revision.';
  end if;
  if (select published_revision_id from public.stories where id=target.id)<>target.published_revision_id then
    raise exception 'Creator cleanup changed the published story.';
  end if;
  begin
    update public.story_revisions set content=content where id=after_revision.id;
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Revision content is no longer immutable.'; end if;
end $$;
rollback;
