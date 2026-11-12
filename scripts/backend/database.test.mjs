import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { legacyLayout } from './import-content.mjs';

const admin = '11111111-1111-4111-8111-111111111111';
const reader = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const unverified = '44444444-4444-4444-8444-444444444444';

test('Postgres authorization, publication, layout and persistent discussions', async t => {
  const db = new PGlite();
  const migrations = new URL('../../supabase/migrations/',import.meta.url);
  const files = (await readdir(migrations)).filter(file=>file.endsWith('.sql')).sort();
  const articles = JSON.parse(await readFile(new URL('../../news/articles.json', import.meta.url), 'utf8'));
  // Supabase Auth itself is external. This fixture models only its database-facing
  // users/JWT contracts; the application must also test real Auth delivery/session flows.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text unique,encrypted_password text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
    grant usage on schema auth to anon,authenticated,service_role;
  `);
  for (const file of files) await db.exec(await readFile(new URL(file,migrations),'utf8'));

  async function asRole(role, uid, run) {
    assert(['anon','authenticated','service_role'].includes(role));
    await db.exec(`begin; set local role ${role};`);
    try {
      await db.query(`select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)`, [uid ?? '', role]);
      const result = await run();
      await db.exec('commit');
      return result;
    } catch (error) {
      await db.exec('rollback');
      throw error;
    }
  }
  async function rpc(name, args = [], role = 'authenticated', uid = admin) {
    assert(/^[a-z_]+$/.test(name));
    return asRole(role, uid, async () => (await db.query(`select public.${name}(${args.map((_, index) => `$${index + 1}`).join(',')}) as result`, args)).rows[0].result);
  }
  const forbidden = error => error.code === '42501';
  const conflict = error => error.code === '40001';
  let stories;
  let initialLayout;

  try {
    await t.test('signup metadata cannot grant roles; bootstrap is server-only and one-time', async () => {
      for (const [id, email, confirmed] of [[admin,'owner@example.com',true],[reader,'reader@example.com',true],[other,'other@example.com',true],[unverified,'pending@example.com',false]]) {
        await db.query(`insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_user_meta_data) values($1,$2,'initial-hash',case when $3 then now() else null end,'{"display_name":"Test Reader","role":"admin"}')`, [id,email,confirmed]);
      }
      assert.equal((await rpc('get_current_profile', [], 'authenticated', reader)).role, 'reader');
      await assert.rejects(rpc('update_display_name',['X'],'authenticated',reader),error=>error.code==='22023');
      await assert.rejects(rpc('update_display_name',['x'.repeat(61)],'authenticated',reader),error=>error.code==='22023');
      await assert.rejects(rpc('initialize_admin',[reader],'authenticated',reader), forbidden);
      assert.equal((await rpc('initialize_admin',[admin],'service_role',null)).created, true);
      assert.equal((await rpc('get_current_profile')).must_change_password, true);
      await assert.rejects(rpc('get_editor_stories'), forbidden);
      await assert.rejects(rpc('complete_password_change'), forbidden);
      await db.query(`update auth.users set encrypted_password='changed-password-hash' where id=$1`, [admin]);
      assert.equal((await rpc('complete_password_change')).must_change_password, false);
      assert.equal((await rpc('initialize_admin',[admin],'service_role',null)).created, false);
      assert.equal((await rpc('get_current_profile')).must_change_password, false);
      assert.equal((await db.query(`select encrypted_password from auth.users where id=$1`,[admin])).rows[0].encrypted_password,'changed-password-hash');
    });

    await t.test('import is atomic and idempotent; public views expose published state only', async () => {
      await assert.rejects(rpc('import_legacy_content',[JSON.stringify(articles),JSON.stringify({lead:'missing-story'})],'service_role',null),error=>error.code==='22023');
      assert.equal((await db.query('select count(*)::integer as count from public.stories')).rows[0].count,0);
      assert.equal((await rpc('import_legacy_content',[JSON.stringify(articles),JSON.stringify(legacyLayout(articles))],'service_role',null)).imported,10);
      stories = (await db.query('select * from public.stories order by slug')).rows;
      initialLayout = (await rpc('get_editor_layout')).published_slots;
      const publicStories = await asRole('anon',null,async () => (await db.query('select * from public.published_stories')).rows);
      assert.equal(publicStories.length,10);
      assert.equal(publicStories.filter(story => !story.content.archived).length,7);
      await assert.rejects(asRole('anon',null,() => db.query('select * from public.homepage_layout')), forbidden);
      await assert.rejects(rpc('get_editor_stories',[],'anon',null),forbidden);
      await assert.rejects(rpc('get_editor_stories',[],'authenticated',reader),forbidden);
      await assert.rejects(asRole('authenticated',reader,() => db.query('select * from private.user_roles')),forbidden);
      await assert.rejects(rpc('import_legacy_content',[JSON.stringify(articles),JSON.stringify(legacyLayout(articles))],'authenticated',reader),forbidden);
    });

    await t.test('drafts stay private, immutable history persists and stale saves fail', async () => {
      const story=stories[0];
      const editorial=(await rpc('get_editor_stories')).find(item=>item.id===story.id);
      const original=editorial.published_content;
      const draft={...original,title:'Private changed headline',image:{src:'should-not-replace-metadata.jpg'}};
      const saved=await rpc('save_story_draft',[story.id,JSON.stringify(draft),story.version]);
      assert.equal(saved.version,story.version+1);
      const publicRow=await asRole('anon',null,async ()=>(await db.query('select * from public.published_stories where id=$1',[story.id])).rows[0]);
      assert.equal(publicRow.content.title,original.title);
      assert.equal((await rpc('get_editor_stories')).find(item=>item.id===story.id).draft_content.image.src,original.image.src);
      assert.equal((await asRole('anon',null,()=>db.query('select id from public.story_revisions where id=$1',[saved.revision_id]))).rows.length,0);
      await assert.rejects(rpc('save_story_draft',[story.id,JSON.stringify(draft),story.version]),conflict);
      await assert.rejects(asRole('authenticated',reader,()=>db.query('update public.stories set version=999 where id=$1',[story.id])),forbidden);
      await assert.rejects(db.query('update public.story_revisions set content=content where id=$1',[saved.revision_id]),forbidden);
      const before=(await rpc('get_editor_layout')).published_slots;
      const published=await rpc('publish_story',[story.id,saved.version]);
      assert.equal(published.version,saved.version+1);
      assert.equal((await db.query('select content from public.published_stories where id=$1',[story.id])).rows[0].content.title,draft.title);
      assert.deepEqual((await rpc('get_editor_layout')).published_slots,before);
      assert.equal((await rpc('get_story_history',[story.id])).length,3);
      assert.equal((await rpc('import_legacy_content',[JSON.stringify(articles),JSON.stringify(legacyLayout(articles))],'service_role',null)).imported,0);
      assert.equal((await db.query('select content from public.published_stories where id=$1',[story.id])).rows[0].content.title,draft.title);
      const invalid={...draft,paragraphLinks:[{paragraph:0,text:'not in paragraph',url:'https://example.com'}]};
      await assert.rejects(rpc('save_story_draft',[story.id,JSON.stringify(invalid),published.version]),error=>error.code==='22023');
    });

    await t.test('layout publishing is all-or-nothing with seven unique positions', async () => {
      let layout=await rpc('get_editor_layout');
      const swapped={...layout.draft_slots,leftTop:layout.draft_slots.lead,lead:layout.draft_slots.leftTop};
      let saved=await rpc('save_homepage_draft',[JSON.stringify(swapped),layout.version]);
      const publicLayout=await asRole('anon',null,async ()=>(await db.query('select * from public.published_homepage')).rows[0]);
      assert.deepEqual(publicLayout.slots,initialLayout);
      await assert.rejects(rpc('publish_homepage',[layout.version]),conflict);
      const partial={...swapped,latest4:null};
      saved=await rpc('save_homepage_draft',[JSON.stringify(partial),saved.version]);
      await assert.rejects(rpc('publish_homepage',[saved.version]),error=>error.code==='22023');
      assert.deepEqual((await db.query('select slots from public.published_homepage')).rows[0].slots,initialLayout);
      const duplicate={...swapped,latest4:swapped.lead};
      await assert.rejects(rpc('save_homepage_draft',[JSON.stringify(duplicate),saved.version]),error=>error.code==='22023');
      saved=await rpc('save_homepage_draft',[JSON.stringify(swapped),saved.version]);
      await rpc('publish_homepage',[saved.version]);
      assert.deepEqual((await db.query('select slots from public.published_homepage')).rows[0].slots,swapped);
      await assert.rejects(rpc('save_homepage_draft',[JSON.stringify(swapped),saved.version],'authenticated',reader),forbidden);
    });

    await t.test('comments persist in isolated discussions and obey ownership/moderation', async () => {
      const storyId=stories[0].id;
      const home=await rpc('create_comment',[null,'<script>literal plain text</script>'],'authenticated',reader);
      const article=await rpc('create_comment',[storyId,'An article comment'],'authenticated',reader);
      const homeRows=await rpc('list_comments',[null,20,null,null],'anon',null);
      const storyRows=await rpc('list_comments',[storyId,20,null,null],'authenticated',other);
      assert.equal(homeRows[0].id,home.id);
      assert.equal(homeRows[0].body,'<script>literal plain text</script>');
      assert.equal(storyRows[0].id,article.id);
      assert(!JSON.stringify(homeRows).includes('reader@example.com'));
      await assert.rejects(rpc('create_comment',[null,'Anonymous'],'anon',null),forbidden);
      await assert.rejects(rpc('create_comment',[null,'Unverified'],'authenticated',unverified),forbidden);
      await assert.rejects(rpc('create_comment',[null,' '.repeat(10)],'authenticated',reader),error=>error.code==='22023');
      await assert.rejects(rpc('update_comment',[article.id,'Someone else edited this'],'authenticated',other),forbidden);
      await assert.rejects(rpc('delete_comment',[article.id],'authenticated',other),forbidden);
      assert.equal((await rpc('update_comment',[article.id,'Edited by its author'],'authenticated',reader)).body,'Edited by its author');
      await rpc('delete_comment',[article.id]);
      assert.equal((await rpc('list_comments',[storyId,20,null,null],'anon',null)).length,0);
      assert.equal((await rpc('list_comments',[null,20,null,null],'anon',null)).length,1);
    });

    await t.test('timestamp-and-ID pagination retains simultaneous comments', async () => {
      const storyId=stories[1].id;
      const ids=['55555555-5555-4555-8555-555555555551','55555555-5555-4555-8555-555555555552'];
      for(const id of ids) await db.query(`insert into public.comments(id,story_id,user_id,body,created_at) values($1,$2,$3,'Pagination','2026-01-01T00:00:00Z')`,[id,storyId,reader]);
      const first=await rpc('list_comments',[storyId,1,null,null],'anon',null);
      const second=await rpc('list_comments',[storyId,1,first[0].created_at,first[0].id],'anon',null);
      assert.equal(first[0].id,ids[1]);
      assert.equal(second[0].id,ids[0]);
    });

    await t.test('only administrators grant roles and the final administrator is retained', async () => {
      await assert.rejects(rpc('set_user_role',[reader,'admin'],'authenticated',reader),forbidden);
      await assert.rejects(rpc('set_user_role',[admin,'reader']),error=>error.code==='22023');
      await rpc('set_user_role',[other,'editor']);
      await assert.rejects(rpc('set_user_role',[other,'admin','reader']),conflict);
      assert.equal((await rpc('get_current_profile',[],'authenticated',other)).role,'editor');
      await assert.rejects(rpc('set_user_role',[other,'admin'],'authenticated',other),forbidden);
      assert.equal((await rpc('get_editor_stories',[],'authenticated',other)).length,10);
      await assert.rejects(rpc('list_app_users',[],'authenticated',other),forbidden);
      assert.equal((await rpc('list_app_users')).length,4);
    });
    await t.test('deleting an editor anonymizes creators while preserving immutable revisions', async () => {
      const story=(await rpc('get_editor_stories',[],'authenticated',other))[0];
      const saved=await rpc('save_story_draft',[story.id,JSON.stringify(story.draft_content),story.version],'authenticated',other);
      const published=await rpc('publish_story',[story.id,saved.version],'authenticated',other);
      const before=(await db.query('select * from public.story_revisions where id=any($1::uuid[]) order by id',[[saved.revision_id,published.revision_id]])).rows;
      assert(before.every(row=>row.created_by===other));
      await db.query('delete from auth.users where id=$1',[other]);
      const after=(await db.query('select * from public.story_revisions where id=any($1::uuid[]) order by id',[[saved.revision_id,published.revision_id]])).rows;
      assert.equal(after.length,2);
      assert(after.every(row=>row.created_by===null));
      const withoutCreator=rows=>rows.map(({created_by,...row})=>row);
      assert.deepEqual(withoutCreator(after),withoutCreator(before));
      assert.equal((await db.query('select revision_id from public.published_stories where id=$1',[story.id])).rows[0].revision_id,published.revision_id);
      await assert.rejects(db.query('update public.story_revisions set content=content where id=$1',[published.revision_id]),forbidden);
    });
  } finally {
    await db.close();
  }
});
