// Real integration tests for disposable LOCAL Supabase + Next.js only.
// Passwords, keys, tokens and cookies are never written to test output.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';

process.loadEnvFile('.env.local');

function ensure(value, message) { if (!value) throw new Error(message); }
function localOrigin(value, label) {
  ensure(value, `${label} is required.`);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be a local URL.`); }
  ensure(['http:', 'https:'].includes(parsed.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), `Refusing integration tests: ${label} is not loopback.`);
  ensure(!parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.pathname === '/', `${label} must be a loopback origin without credentials or a path.`);
  return parsed.origin;
}

const siteOrigin = localOrigin(process.env.SITE_URL, 'SITE_URL');
const supabaseOrigin = localOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
ensure(adminEmail === 'admin@chiefs-news.local', 'Refusing integration tests: use the disposable local bootstrap administrator.');
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
ensure(publicKey && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.BOOTSTRAP_ADMIN_PASSWORD, 'Local backend credentials are required.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(supabaseOrigin, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const cachePath = '/private/tmp/vibe-log-integration-admin.json';
let passes = 0;
function pass(label) { passes += 1; console.log(`PASS: ${label}`); }

function browserSession() {
  const cookies = new Map();
  return {
    async request(path, { method = 'GET', body, origin = siteOrigin } = {}) {
      let url = new URL(path, siteOrigin);
      ensure(url.origin === siteOrigin, 'Refusing an HTTP request outside the local app origin.');
      const headers = { Accept: path.startsWith('/api/') ? 'application/json' : 'text/html' };
      if (cookies.size) headers.Cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
      if (method !== 'GET' && method !== 'HEAD' && origin !== null) headers.Origin = origin;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      let response;
      for (let redirects = 0; redirects < 4; redirects += 1) {
        try { response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(60000) }); }
        catch { throw new Error(`Local HTTP request failed: ${method} ${url.pathname}.`); }
        for (const header of response.headers.getSetCookie()) {
          const pair = header.split(';', 1)[0];
          const split = pair.indexOf('=');
          if (split < 0) continue;
          const key = pair.slice(0, split); const value = pair.slice(split + 1);
          if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(header)) cookies.delete(key);
          else cookies.set(key, value);
        }
        const location = response.headers.get('location');
        const target = location ? new URL(location, url) : null;
        const slashTwin = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : `${url.pathname}/`;
        if ([307, 308].includes(response.status) && target?.origin === siteOrigin && target.pathname === slashTwin && target.search === url.search && redirects < 3) {
          await response.arrayBuffer();
          url = target;
          if (cookies.size) headers.Cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
          continue;
        }
        break;
      }
      const text = await response.text();
      let data;
      if (response.headers.get('content-type')?.includes('application/json')) {
        try { data = JSON.parse(text); } catch { throw new Error(`Invalid JSON from ${method} ${url.pathname}.`); }
      }
      return { status: response.status, data, text, location: response.headers.get('location'), headers: response.headers };
    },
  };
}

async function api(session, path, method, body, status = 200) {
  const result = await session.request(path, { method, body });
  ensure(result.status === status, `${method} ${path.split('?')[0]} returned HTTP ${result.status}; expected ${status}.`);
  return result.data;
}
async function rpc(client, name, args) {
  const result = await client.rpc(name, args);
  ensure(!result.error, `Local database call ${name} failed.`);
  return result.data;
}
async function databaseRow(table, id) {
  const result = await service.from(table).select('*').eq('id', id).single();
  ensure(!result.error && result.data, `Could not snapshot local ${table} fixture.`);
  return result.data;
}
function editPayload(content, expectedVersion) {
  return { title: content.title, dek: content.dek, paragraphs: content.paragraphs, paragraphLinks: content.paragraphLinks || [], expectedVersion };
}
function sameSlots(a, b) { return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => b[key] === value); }
function homepageSlots(html) {
  const read = expression => [...html.matchAll(expression)].map(match => match[1]);
  const leftTop = read(/class="story" id="team" data-story="([^"]+)"/g)[0];
  const leftBottom = read(/class="story" id="photos" data-story="([^"]+)"/g)[0];
  const lead = read(/class="lead-story" data-story="([^"]+)"/g)[0];
  const latest = read(/class="latest-story"[^>]*data-story="([^"]+)"/g);
  return { leftTop, leftBottom, lead, latest1: latest[0], latest2: latest[1], latest3: latest[2], latest4: latest[3], latestCount: latest.length };
}

const admin = browserSession();
const anonymous = browserSession();
const readerA = browserSession();
const readerB = browserSession();
const runId = `${Date.now()}-${randomBytes(3).toString('hex')}`;
const testEmails = [`integration-a-${runId}@chiefs-news.local`, `integration-b-${runId}@chiefs-news.local`];
const readerPasswords = testEmails.map(() => `Reader-${randomBytes(18).toString('hex')}`);
const testUserIds = [];
let originalStory;
let originalLayout;
let adminPassword;

async function sdkLogin(email, password) {
  const client = createClient(supabaseOrigin, publicKey, options);
  const result = await client.auth.signInWithPassword({ email, password });
  ensure(!result.error && result.data.session, 'Local SDK session could not be established.');
  return client;
}

async function mailedVerification(email, expectedType) {
  const mailOrigin = localOrigin(process.env.MAILPIT_URL || 'http://127.0.0.1:54324', 'MAILPIT_URL');
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(`${mailOrigin}/api/v1/messages?limit=50`, { signal: AbortSignal.timeout(5000) });
    ensure(response.ok, 'Local Mailpit inbox could not be loaded.');
    const inbox = await response.json();
    for (const message of inbox.messages || []) {
      if (!(message.To || []).some(recipient => recipient.Address?.toLowerCase() === email.toLowerCase())) continue;
      const detailResponse = await fetch(`${mailOrigin}/api/v1/message/${encodeURIComponent(message.ID)}`, { signal: AbortSignal.timeout(5000) });
      ensure(detailResponse.ok, 'Local verification email could not be loaded.');
      const detail = await detailResponse.json();
      const body = `${detail.Text || ''}\n${detail.HTML || ''}`.replaceAll('&amp;', '&');
      for (const match of body.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
        let url;
        try { url = new URL(match[0]); } catch { continue; }
        if (!url.pathname.endsWith('/auth/v1/verify')) continue;
        const kind = url.searchParams.get('type');
        if (kind !== expectedType && !(expectedType === 'signup' && kind === 'email')) continue;
        const origin = localOrigin(url.origin, 'verification email URL');
        ensure(new URL(origin).port === new URL(supabaseOrigin).port, 'Verification email targets another local service.');
        return url;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`The local ${expectedType} email did not arrive in Mailpit.`);
}

async function followMailedLink(session, verification, expectedPath) {
  const verified = await fetch(verification, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  ensure([302, 303, 307, 308].includes(verified.status), 'The native email verification link did not redirect to the app.');
  const location = verified.headers.get('location');
  ensure(location, 'The native email verification link returned no callback.');
  const callback = new URL(location, supabaseOrigin);
  ensure(callback.origin === siteOrigin && callback.pathname.replace(/\/$/, '') === '/auth/callback', 'The native email link did not target the configured app callback.');
  ensure(callback.searchParams.has('code'), 'The native email link did not produce a PKCE authorization code.');
  const confirmed = await session.request(callback.pathname + callback.search);
  ensure([302, 303, 307, 308].includes(confirmed.status) && confirmed.location, 'The app did not exchange the email authorization code.');
  const destination = new URL(confirmed.location, siteOrigin);
  ensure(destination.origin === siteOrigin && destination.pathname.replace(/\/$/, '') === expectedPath, 'Email code exchange did not reach its intended account page.');
}

async function emailMain() {
  const session = browserSession();
  await api(session, '/api/auth/signup', 'POST', { email: testEmails[0], password: readerPasswords[0], displayName: 'Email Flow Reader' });
  const signupLink = await mailedVerification(testEmails[0], 'signup');
  await followMailedLink(session, signupLink, '/account');
  const account = await session.request('/account');
  ensure(account.status === 200 && account.text.includes('Email Flow Reader'), 'Native signup email did not establish a real app session.');
  pass('actual signup email, native verification redirect and PKCE callback establish a session');
  await api(session, '/api/auth/logout', 'POST', {});
  const recovery = browserSession();
  await api(recovery, '/api/auth/forgot-password', 'POST', { email: testEmails[0] });
  const recoveryLink = await mailedVerification(testEmails[0], 'recovery');
  await followMailedLink(recovery, recoveryLink, '/reset-password');
  const resetPage = await recovery.request('/reset-password');
  ensure(resetPage.status === 200 && resetPage.text.includes('name="confirmPassword"'), 'Native recovery callback did not authorize the password reset form.');
  const replacement = `Recovered-${randomBytes(18).toString('hex')}`;
  await api(recovery, '/api/auth/reset-password', 'POST', { password: replacement });
  const reader = browserSession();
  await api(reader, '/api/auth/login', 'POST', { identifier: testEmails[0], password: readerPasswords[0] }, 401);
  await api(reader, '/api/auth/login', 'POST', { identifier: testEmails[0], password: replacement });
  pass('actual recovery email and PKCE callback allow password reset and new-password login');
}

async function main() {
  const home = await anonymous.request('/');
  ensure(home.status === 200 && home.text.includes('CHIEFS'), 'The local Next.js app must be running before integration tests.');
  pass('local app and loopback-only safety guards');
  const foreignOrigin = await anonymous.request('/api/auth/login', { method: 'POST', body: {}, origin: 'https://evil.example' });
  const missingOrigin = await anonymous.request('/api/auth/login', { method: 'POST', body: {}, origin: null });
  ensure(foreignOrigin.status === 403 && missingOrigin.status === 403, 'Account mutations accepted a missing or foreign request origin.');
  pass('cross-origin and missing-origin account mutations return HTTP 403');

  let cached;
  try { cached = JSON.parse(await readFile(cachePath, 'utf8')); } catch { /* First run has no private password cache. */ }
  const candidates = [];
  if (cached?.siteOrigin === siteOrigin && cached?.supabaseOrigin === supabaseOrigin && cached?.email === adminEmail && typeof cached.password === 'string') candidates.push(cached.password);
  candidates.push(process.env.BOOTSTRAP_ADMIN_PASSWORD);
  let login;
  for (const password of [...new Set(candidates)]) {
    const result = await admin.request('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password } });
    if (result.status === 200) { adminPassword = password; login = result.data; break; }
  }
  ensure(adminPassword && login, 'The disposable local administrator could not log in.');
  if (login.redirectTo === '/reset-password/') {
    await api(admin, '/api/admin/users', 'GET', undefined, 403);
    await api(admin, '/api/editor/layout', 'PATCH', {}, 403);
    pass('bootstrap administrator is blocked from editing before password change');
    const nextPassword = `Administrator-${randomBytes(20).toString('hex')}`;
    await api(admin, '/api/auth/reset-password', 'POST', { password: nextPassword });
    adminPassword = nextPassword;
    await writeFile(cachePath, JSON.stringify({ siteOrigin, supabaseOrigin, email: adminEmail, password: adminPassword }), { mode: 0o600 });
    await chmod(cachePath, 0o600);
    pass('administrator changes initial password through the real app API');
  } else pass('rerun uses the administrator password from its private local cache');
  const users = await api(admin, '/api/admin/users', 'GET');
  ensure(Array.isArray(users.users), 'Administrator account access was not granted after setup.');
  const adminSdk = await sdkLogin(adminEmail, adminPassword);

  const sessions = [readerA, readerB];
  for (let index = 0; index < sessions.length; index += 1) {
    await api(sessions[index], '/api/auth/signup', 'POST', { email: testEmails[index], password: readerPasswords[index], displayName: `Integration Reader ${index + 1}`, role: 'admin' });
    await api(sessions[index], '/api/comments', 'POST', { story: 'home', text: 'An unverified account must not post.' }, 401);
    const listed = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    ensure(!listed.error, 'Local test account lookup failed.');
    const user = listed.data.users.find(candidate => candidate.email === testEmails[index]);
    ensure(user, 'Public signup did not create the local test account.');
    testUserIds.push(user.id);
    const link = await service.auth.admin.generateLink({ type: 'magiclink', email: testEmails[index] });
    ensure(!link.error && link.data.properties?.hashed_token, 'Local verification token could not be generated.');
    const confirm = await sessions[index].request(`/auth/confirm?${new URLSearchParams({ token_hash: link.data.properties.hashed_token, type: 'email', next: index === 0 ? '/%09/evil.example' : '/account/' })}`);
    ensure([302, 303, 307, 308].includes(confirm.status) && confirm.location && !confirm.location.includes('error='), 'Email verification failed through the real app callback.');
    ensure(new URL(confirm.location, siteOrigin).origin === siteOrigin && new URL(confirm.location, siteOrigin).pathname === '/account/', 'Verification callback did not reject an unsafe return path.');
    await api(sessions[index], '/api/auth/login', 'POST', { identifier: testEmails[index], password: readerPasswords[index] });
    await api(sessions[index], '/api/admin/users', 'GET', undefined, 403);
    await api(sessions[index], '/api/editor/layout', 'PATCH', {}, 403);
  }
  pass('public signup, email verification and two separate reader logins');
  pass('verification callback rejects an encoded-tab external return path');
  pass('reader sessions cannot access editor or admin APIs, including forged signup roles');

  await api(readerA, '/api/admin/users', 'PATCH', { userId: testUserIds[0], role: 'admin', expectedRole: 'reader' }, 403);
  await api(anonymous, '/api/comments', 'POST', { story: 'home', text: 'Anonymous post' }, 401);
  pass('anonymous comments and reader self-promotion are rejected');

  const initialStories = await rpc(adminSdk, 'get_editor_stories');
  ensure(initialStories.length >= 7, 'Import the local story fixtures before integration tests.');
  const story = initialStories.find(item => item.slug === 'mahomes-arm-injury-update') || initialStories[0];
  const secondStory = initialStories.find(item => item.id !== story.id);
  const created = await api(readerA, '/api/comments', 'POST', { story: story.slug, text: `Reader A story comment ${runId}` }, 201);
  const createdHome = await api(readerB, '/api/comments', 'POST', { story: 'home', text: `Reader B homepage comment ${runId}` }, 201);
  ensure(created.comment?.id && createdHome.comment?.id, 'Comment creation returned no saved comment.');
  const onStory = await api(readerB, `/api/comments?story=${story.slug}`, 'GET');
  const onHome = await api(readerA, '/api/comments?story=home', 'GET');
  const elsewhere = await api(anonymous, `/api/comments?story=${secondStory.slug}`, 'GET');
  ensure(onStory.comments.some(item => item.id === created.comment.id), 'A second reader could not load a persistent story comment.');
  ensure(!onHome.comments.some(item => item.id === created.comment.id) && !elsewhere.comments.some(item => item.id === created.comment.id), 'A story comment leaked into another discussion.');
  ensure(onHome.comments.some(item => item.id === createdHome.comment.id), 'A second reader could not load the homepage discussion.');
  ensure(![adminEmail, ...testEmails].some(email => JSON.stringify(onStory).includes(email) || JSON.stringify(onHome).includes(email)), 'Public comments exposed a private account email.');
  pass('comments persist across sessions and remain isolated by story and homepage');
  await api(readerB, `/api/comments/${created.comment.id}`, 'PATCH', { text: 'Unauthorized edit' }, 403);
  await api(readerB, `/api/comments/${created.comment.id}`, 'DELETE', {}, 403);
  const edited = await api(readerA, `/api/comments/${created.comment.id}`, 'PATCH', { text: `Edited by its author ${runId}` });
  ensure(edited.comment.text.includes('Edited by its author'), 'The author could not update their comment.');
  await api(readerB, `/api/comments/${createdHome.comment.id}`, 'DELETE', {}, 204);
  pass('comment ownership protects edits/removals while authors retain control');

  const privatePreview = await readerB.request(`/editor/preview/${story.id}`);
  ensure([302, 303, 307, 308].includes(privatePreview.status) && !privatePreview.text.includes('Private story preview.'), 'Reader access to private story previews was not blocked.');
  await api(admin, '/api/admin/users', 'PATCH', { userId: testUserIds[0], role: 'editor', expectedRole: 'reader' });
  await api(readerA, `/api/comments/${createdHome.comment.id}`, 'DELETE', {}, 404);
  const moderation = await api(readerB, '/api/comments', 'POST', { story: story.slug, text: `Moderator removal ${runId}` }, 201);
  await api(readerA, `/api/comments/${moderation.comment.id}`, 'DELETE', {}, 204);
  pass('administrator grants editor access; editors can moderate another reader’s comment');

  originalStory = await databaseRow('stories', story.id);
  originalLayout = await databaseRow('homepage_layout', 'home');
  const draftTitle = `Integration headline ${runId}`;
  const draftDek = `Integration dek ${runId}`;
  const originalContent = story.draft_content || story.published_content;
  const draft = await api(readerA, `/api/editor/stories/${story.id}`, 'PATCH', { ...editPayload(originalContent, Number(story.version)), title: draftTitle, dek: draftDek });
  ensure(draft.story?.title === draftTitle, 'Saved draft did not return the edited headline.');
  await api(readerA, `/api/editor/stories/${story.id}`, 'PATCH', editPayload(originalContent, Number(story.version)), 409);
  const beforePublish = await anonymous.request(`/news/${story.slug}`);
  ensure(beforePublish.status === 200 && !beforePublish.text.includes(draftTitle) && !beforePublish.text.includes(draftDek), 'Unpublished story content appeared on a public page.');
  const preview = await readerA.request(`/editor/preview/${story.id}`);
  ensure(preview.status === 200 && preview.text.includes(draftTitle), 'An editor could not preview the saved story draft.');
  const anonSdk = createClient(supabaseOrigin, publicKey, options);
  const revision = await anonSdk.from('story_revisions').select('id,content').eq('id', draft.story.revision_id);
  ensure(!revision.error && revision.data.length === 0, 'An anonymous database reader could access a draft revision.');
  pass('draft saves are private, editor previews work, and stale saves return HTTP 409');
  const published = await api(readerA, `/api/editor/stories/${story.id}/publish`, 'POST', { expectedVersion: draft.story.version });
  ensure(published.story?.title === draftTitle, 'Story publication did not complete.');
  const publishedPage = await anonymous.request(`/news/${story.slug}`);
  ensure(publishedPage.status === 200 && publishedPage.text.includes(`<h1 id="article-title">${draftTitle}</h1>`) && publishedPage.text.includes(`<title>${draftTitle} | Chiefs News</title>`), 'Published headline did not reach server-rendered content and metadata.');
  ensure(publishedPage.text.includes(`content="${draftDek}"`), 'Published dek did not reach server-rendered description metadata.');
  await api(readerA, `/api/editor/stories/${story.id}/publish`, 'POST', { expectedVersion: draft.story.version }, 409);
  pass('publication updates server-rendered headline, dek and metadata with revision checks');

  const layout = await rpc(adminSdk, 'get_editor_layout');
  const originalSlots = layout.published_slots;
  ensure(originalSlots && Object.values(originalSlots).every(Boolean), 'The local published layout needs seven stories.');
  const swapped = { ...originalSlots, leftTop: originalSlots.lead, lead: originalSlots.leftTop };
  const baselineHome = homepageSlots((await anonymous.request('/')).text);
  const savedLayout = await api(readerA, '/api/editor/layout', 'PATCH', { slots: swapped, expectedVersion: Number(layout.version) });
  const stillPublic = homepageSlots((await anonymous.request('/')).text);
  ensure(sameSlots(baselineHome, stillPublic), 'A saved layout draft changed the public homepage before publication.');
  await api(readerA, '/api/editor/layout', 'PATCH', { slots: swapped, expectedVersion: Number(layout.version) }, 409);
  await api(readerA, '/api/editor/layout', 'PATCH', { slots: { ...swapped, leftBottom: swapped.leftTop }, expectedVersion: savedLayout.layout.version }, 400);
  const layoutPreview = await readerA.request('/editor/preview');
  const idToSlug = new Map(initialStories.map(item => [item.id, item.slug]));
  const previewSlots = homepageSlots(layoutPreview.text);
  ensure(layoutPreview.status === 200 && previewSlots.leftTop === idToSlug.get(swapped.leftTop) && previewSlots.lead === idToSlug.get(swapped.lead), 'Private layout preview did not render the saved arrangement.');
  await api(readerA, '/api/editor/layout/publish', 'POST', { expectedVersion: savedLayout.layout.version });
  const liveSlots = homepageSlots((await anonymous.request('/')).text);
  ensure(liveSlots.leftTop === idToSlug.get(swapped.leftTop) && liveSlots.lead === idToSlug.get(swapped.lead), 'Published layout did not update the public slots.');
  ensure(liveSlots.latestCount === 4 && new Set(Object.values(liveSlots).filter(value => typeof value === 'string')).size === 7, 'Published homepage does not contain seven unique stories and four Latest cards.');
  const archive = await anonymous.request('/news');
  ensure(archive.status === 200 && initialStories.every(item => archive.text.includes(`data-story="${item.slug}"`)), 'Homepage rearrangement removed stories from the archive.');
  pass('layout drafts, previews, atomic publication, seven unique slots, Latest four and archive retention');

  await api(readerA, '/api/auth/logout', 'POST', {});
  await api(readerA, '/api/editor/layout', 'PATCH', {}, 401);
  await api(admin, '/api/auth/logout', 'POST', {});
  await api(admin, '/api/admin/users', 'GET', undefined, 401);
  pass('logout removes application access from both editor and administrator sessions');
}

let failure;
try { await (process.argv.includes('--email-only') ? emailMain() : main()); } catch (error) { failure = error instanceof Error ? error.message : 'The local integration run failed.'; }
finally {
  const cleanupErrors = [];
  if (originalStory) {
    const result = await service.from('stories').update(originalStory).eq('id', originalStory.id);
    if (result.error) cleanupErrors.push('story fixture');
  }
  if (originalLayout) {
    const result = await service.from('homepage_layout').update(originalLayout).eq('id', 'home');
    if (result.error) cleanupErrors.push('layout fixture');
  }
  const listed = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) cleanupErrors.push('test-user lookup');
  else {
    for (const user of listed.data.users.filter(candidate => testEmails.includes(candidate.email))) {
      const result = await service.auth.admin.deleteUser(user.id);
      if (result.error) cleanupErrors.push('test-user removal');
    }
  }
  if (cleanupErrors.length) failure = `${failure ? `${failure} ` : ''}Local fixture cleanup failed: ${cleanupErrors.join(', ')}.`;
  else console.log(originalStory || originalLayout ? 'PASS: restored local story/layout fixtures and removed test users' : 'PASS: removed disposable test users; published fixtures were unchanged');
}
if (failure) { console.error(`FAIL: ${failure}`); process.exitCode = 1; }
else console.log(`All ${passes} local HTTP integration scenarios passed.`);
