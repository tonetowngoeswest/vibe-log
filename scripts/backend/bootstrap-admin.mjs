import { adminClient, required, rpc } from './env.mjs';

async function findAccount(client, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not inspect existing accounts: ${error.message}`);
    const match = data.users.find(user => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
}

export async function bootstrapAdmin() {
  const client = adminClient();
  const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Provide a valid administrator recovery email.');
  const state = await rpc(client, 'get_bootstrap_status');
  if (state.initialized) {
    const { data, error } = await client.auth.admin.getUserById(state.admin_id);
    if (error) throw new Error(`Could not inspect the initialized administrator: ${error.message}`);
    if (data.user.email?.toLowerCase() !== email) throw new Error('An initial administrator is already configured with a different recovery email.');
    console.log('Administrator already initialized. Credentials, profile and role were left unchanged.');
    return;
  }
  let account = await findAccount(client, email);
  if (!account) {
    const password = required('BOOTSTRAP_ADMIN_PASSWORD');
    if (password.length < 6) throw new Error('The initial password must contain at least six characters.');
    const { data, error } = await client.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { display_name: 'Admin' },
    });
    if (error) throw new Error(`Could not create the initial administrator: ${error.message}`);
    account = data.user;
  }
  const result = await rpc(client, 'initialize_admin', { p_user_id: account.id });
  console.log(result.created
    ? 'Administrator initialized. Sign in as admin and change the initial password before using editorial tools.'
    : 'Administrator already initialized. Existing credentials were retained.');
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  bootstrapAdmin().catch(error => { console.error(error.message); process.exitCode = 1; });
}
