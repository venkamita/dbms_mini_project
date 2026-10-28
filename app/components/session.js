'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/client';
const Context = createContext({ user: null, loading: true });
export const useSession = () => useContext(Context);
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    api('/api/auth/me').then(data => { if (active) { setUser(data.user); setError(''); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pathname]);
  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); setUser(null); router.replace('/login'); router.refresh(); }
    catch (err) { setError(err.message); }
  }
  const links = [['/catalog', 'Catalog'], ['/wishlist', 'Wishlist'], ['/library', 'Library'], ['/recommendations', 'For You']];
  if (user?.role === 'admin') links.push(['/admin/games', 'Manage games'], ['/admin/analytics', 'Analytics']);
  return <Context.Provider value={{ user, loading }}><header><nav aria-label="Main navigation"><Link className="brand" href="/catalog">◈ GameMatch</Link>{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}<div className="nav-account">{user ? <><span>{user.username}</span><button className="secondary" onClick={logout}>Log out</button></> : <Link className="button secondary" href="/login">Log in</Link>}</div></nav></header>{error && <div role="alert" className="error">{error}</div>}{children}</Context.Provider>;
}
