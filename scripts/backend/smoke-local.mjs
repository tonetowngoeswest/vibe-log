import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { legacyLayout } from './import-content.mjs';

// Real local Supabase integration: it never accepts a hosted API URL, prints a
// token, changes a real account, or writes .env files. Test accounts are removed.
const status = JSON.parse(await readFile(process.argv[2] || '/private/tmp/vibe-log-local-supabase.json', 'utf8'));
const api = new URL(status.API_URL);
const mail = new URL(status.MAILPIT_URL);
if (![api.hostname, mail.hostname].every(host => ['localhost','127.0.0.1'].includes(host))) throw new Error('This test only runs against local services.');
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const service = createClient(api.href, status.SERVICE_ROLE_KEY, options);
const browser = () => createClient(api.href, status.ANON_KEY, options);
const created = [];
const marker = randomUUID();
const email = `test-db-${marker}@example.test`;
const password = `Test!${randomBytes(18).toString('base64url')}`;
const newPassword = `Changed!${randomBytes(18).toString('base64url')}`;

function ok(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}
async function verifyMail(type, previousIds = new Set()) {
  let message;
  for (let attempt=0;attempt<15;attempt++) {
    const inbox = await (await fetch(new URL('/api/v1/messages',mail))).json();
    message=(inbox.messages || []).find(item => !previousIds.has(item.ID) && item.To?.some(recipient=>recipient.Address===email));
    if (message) break;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert(message, `${type} email reached the local inbox`);
  const full=await (await fetch(new URL(`/api/v1/message/${message.ID}`,mail))).json();
  const content=String(full.HTML || full.Text || '').replaceAll('&amp;','&');
  const links=[...content.matchAll(/https?:\/\/[^\s"<>]+/g)].map(match=>match[0]);
  const confirmation=links.find(link=>{try { const url=new URL(link);return url.pathname==='/auth/v1/verify' && url.searchParams.get('type')===type; } catch{return false;}});
  assert(confirmation,`${type} email contains a verification link`);
  assert(['127.0.0.1','localhost'].includes(new URL(confirmation).hostname));
  const response=await fetch(confirmation,{redirect:'manual'});
  assert([302,303].includes(response.status),`${type} link is accepted`);
  const location=new URL(response.headers.get('location'));
  assert(!location.searchParams.has('error')&&!location.hash.includes('error='),`${type} confirmation succeeds`);
  return { location, messageId:message.ID };
}

try {
  const articles=JSON.parse(await readFile(new URL('../../news/articles.json',import.meta.url),'utf8'));
  ok(await service.rpc('import_legacy_content',{p_articles:articles,p_slots_by_slug:legacyLayout(articles)}),'Import');
  const guest=browser();
  const published=ok(await guest.from('published_stories').select('*'),'Public stories');
  assert.equal(published.length,10);
  assert.equal(Object.keys(ok(await guest.from('published_homepage').select('*').single(),'Public layout').slots).length,7);
  assert.equal(ok(await guest.from('story_revisions').select('id,content'),'Published revisions').length,10);
  assert((await guest.rpc('get_editor_stories')).error,'Anonymous access is denied');

  const account=browser();
  const signedUp=ok(await account.auth.signUp({email,password,options:{data:{display_name:'Local DB reader',role:'admin'}}}),'Signup');
  created.push(signedUp.user.id);
  assert.equal(signedUp.session,null,'Verification is required');
  assert((await account.auth.signInWithPassword({email,password})).error,'Unverified login is denied');
  const confirmation=await verifyMail('signup');
  ok(await account.auth.signInWithPassword({email,password}),'Verified password login');
  const profile=ok(await account.rpc('get_current_profile'),'Reader profile');
  assert.equal(profile.role,'reader','Signup metadata cannot grant privileges');
  assert.equal(profile.display_name,'Local DB reader');
  assert((await account.rpc('get_editor_stories')).error,'Readers cannot read drafts');
  assert((await account.rpc('set_user_role',{p_user_id:profile.id,p_role:'admin'})).error,'Readers cannot grant roles');
  const first=published[0];
  assert((await account.rpc('save_story_draft',{p_story_id:first.id,p_content:{...first.content,title:'Unauthorized'},p_expected_version:1})).error,'Readers cannot edit stories');

  const home=ok(await account.rpc('create_comment',{p_story_id:null,p_body:`Local smoke ${marker}` }),'Home comment');
  const story=ok(await account.rpc('create_comment',{p_story_id:first.id,p_body:'A separate article discussion'}),'Story comment');
  assert(ok(await guest.rpc('list_comments',{p_story_id:null}),'Public comments').some(row=>row.id===home.id));
  assert(!ok(await guest.rpc('list_comments',{p_story_id:first.id}),'Story comments').some(row=>row.id===home.id));
  const otherEmail=`test-db-other-${marker}@example.test`;
  const otherUser=ok(await service.auth.admin.createUser({email:otherEmail,password,email_confirm:true,user_metadata:{display_name:'Other local reader'}}),'Second account');
  created.push(otherUser.user.id);
  const second=browser();
  ok(await second.auth.signInWithPassword({email:otherEmail,password}),'Second login');
  assert((await second.rpc('update_comment',{p_comment_id:story.id,p_body:'Not the author'})).error,'Another reader cannot edit this comment');
  assert((await second.rpc('delete_comment',{p_comment_id:story.id})).error,'Another reader cannot remove this comment');
  assert.equal(ok(await account.rpc('update_comment',{p_comment_id:story.id,p_body:'The author edited this'}),'Owner edit').body,'The author edited this');
  ok(await account.rpc('delete_comment',{p_comment_id:story.id}),'Owner deletion');
  assert(!ok(await second.rpc('list_comments',{p_story_id:first.id}),'Refreshed comments').some(row=>row.id===story.id));

  ok(await account.auth.resetPasswordForEmail(email,{redirectTo:'http://localhost:3000/reset-password/'}),'Password recovery request');
  const recovery=await verifyMail('recovery',new Set([confirmation.messageId]));
  const fragment=new URLSearchParams(recovery.location.hash.slice(1));
  const recovered=browser();
  ok(await recovered.auth.setSession({access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token')}),'Recovery session');
  ok(await recovered.auth.updateUser({password:newPassword}),'Recovered password change');
  assert((await browser().auth.signInWithPassword({email,password})).error,'Previous password no longer works');
  ok(await browser().auth.signInWithPassword({email,password:newPassword}),'New password login');
  ok(await account.auth.signOut(),'Logout');
  assert((await account.auth.getUser()).error,'Signed out client has no user');
  console.log('PASS: real local Auth signup/verification/login/recovery/logout; REST published-only reads; metadata escalation denied; shared comment persistence, thread isolation and ownership.');
} finally {
  for (const id of created) {
    const {error}=await service.auth.admin.deleteUser(id);
    if (error) console.error('Local test-account cleanup needs retry.');
  }
}
