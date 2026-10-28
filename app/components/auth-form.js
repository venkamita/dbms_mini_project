'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { ErrorMessage } from './ui';
export default function AuthForm({ register = false }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { await api(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(data) }); window.location.assign('/catalog'); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return <section className="auth panel"><div className="eyebrow">Your next favorite awaits</div><h1>{register ? 'Join GameMatch' : 'Welcome back'}</h1><p className="muted">{register ? 'Create an account to discover games picked for you.' : 'Log in to your library and personal recommendations.'}</p><ErrorMessage error={error}/><form className="stack" onSubmit={submit}><label>Username<input name="username" autoComplete="username" required maxLength={50}/></label>{register && <label>Email<input type="email" name="email" autoComplete="email" required maxLength={100}/></label>}<label>Password<input type="password" name="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 6 : 1} maxLength={72}/></label><button disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}</button></form><p className="muted text-sm">{register ? 'Already have an account? ' : 'New here? '}<Link href={register ? '/login' : '/register'}>{register ? 'Log in' : 'Create an account'}</Link></p></section>;
}
