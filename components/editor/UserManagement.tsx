'use client';

import { useEffect, useState } from 'react';
import { editorRequest, errorMessage } from './api';
import type { EditorialRole, ManagedUser } from './types';

const roleLabels: Record<EditorialRole, string> = { reader: 'Reader', editor: 'Editor', admin: 'Admin' };

export function UserManagement({ viewerId }: { viewerId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pendingRoles, setPendingRoles] = useState<Record<string, EditorialRole>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await editorRequest<{ users: ManagedUser[] }>('/api/admin/users', 'GET');
      setUsers(result.users); setPendingRoles({});
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function saveRole(user: ManagedUser) {
    const role = pendingRoles[user.id] || user.role;
    if (role === user.role) return;
    setSavingId(user.id); setError(''); setMessage('');
    try {
      const result = await editorRequest<{ user: Pick<ManagedUser, 'id' | 'role'> & Partial<ManagedUser> }>('/api/admin/users', 'PATCH', { userId: user.id, role, expectedRole: user.role });
      const savedUser = { ...user, ...result.user };
      setUsers(current => current.map(candidate => candidate.id === user.id ? savedUser : candidate));
      setPendingRoles(current => { const next = { ...current }; delete next[user.id]; return next; });
      setMessage(`${savedUser.displayName} is now a ${roleLabels[savedUser.role].toLowerCase()}.`);
      if (user.id === viewerId && role !== 'admin') window.location.assign(role === 'editor' ? '/editor/' : '/account/');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setSavingId(null); }
  }

  const term = query.toLocaleLowerCase().trim();
  const filtered = users.filter(user => !term || [user.displayName, user.email || '', user.role].some(value => value.toLocaleLowerCase().includes(term)));
  const adminCount = users.filter(user => user.role === 'admin').length;

  return <section className="editor-panel" aria-labelledby="accounts-heading">
    <div className="editor-heading-row"><div><p className="category">Administration</p><h1 id="accounts-heading">Account roles</h1></div><button type="button" className="editor-button editor-button-secondary" disabled={loading || !!savingId} onClick={load}>Refresh accounts</button></div>
    <p className="editor-description">Readers can comment. Editors can edit and publish stories, arrange the homepage and moderate comments. Admins can also manage account roles. The last admin cannot be demoted.</p>
    <div className="editor-field"><label htmlFor="account-search">Find an account</label><input id="account-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Display name, email or role" /></div>
    {error && <p className="editor-error" role="alert">{error}</p>}{message && <p className="editor-status" role="status">{message}</p>}
    {loading ? <p role="status">Loading accounts…</p> : <>
      <div className="editor-table-scroll"><table className="editor-table"><caption className="editor-visually-hidden">Registered users and their current roles</caption><thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Action</th></tr></thead><tbody>
        {filtered.map(user => <tr key={user.id}><td><strong>{user.displayName}</strong>{user.id === viewerId && <span className="editor-badge">You</span>}{user.email && <span className="editor-account-email">{user.email}</span>}</td><td><label className="editor-visually-hidden" htmlFor={`role-${user.id}`}>Role for {user.displayName}</label><select id={`role-${user.id}`} value={pendingRoles[user.id] || user.role} disabled={!!savingId || (user.role === 'admin' && adminCount === 1)} onChange={event => { setPendingRoles(current => ({ ...current, [user.id]: event.target.value as EditorialRole })); setMessage(''); }}><option value="reader">Reader</option><option value="editor">Editor</option><option value="admin">Admin</option></select>{user.role === 'admin' && adminCount === 1 && <span className="editor-help">Last admin</span>}</td><td><button className="editor-button editor-button-secondary" type="button" disabled={!!savingId || !pendingRoles[user.id] || pendingRoles[user.id] === user.role} onClick={() => saveRole(user)}>{savingId === user.id ? 'Saving…' : 'Save role'}</button></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan={3}>{users.length ? 'No matching accounts.' : 'No accounts were returned.'}</td></tr>}
      </tbody></table></div>
      <p className="editor-help">{filtered.length} of {users.length} accounts shown. Email addresses are visible only to admins.</p>
    </>}
  </section>;
}
