'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Topbar() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadRole(data.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadRole(session.user.id);
      else setRole(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRole(uid) {
    const { data } = await supabase.from('profiles').select('role').eq('id', uid).single();
    setRole(data?.role ?? 'contributor');
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <header className="topbar">
      <Link href="/"><div className="logo-wrap">
        <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="16" stroke="#C9A84C" strokeWidth="1.5"/>
          <circle cx="18" cy="18" r="9" stroke="#C9A84C" strokeWidth="1" strokeDasharray="2 3"/>
          <circle cx="18" cy="18" r="3.5" fill="#C9A84C" opacity="0.85"/>
        </svg>
        <div>
          <div className="logo-th">ฐานข้อมูลเพลงไทย</div>
          <div className="logo-en">Thai Music Archive · THMA</div>
        </div>
      </div></Link>
      <nav className="nav">
        <Link href="/">รายการเพลง</Link>
        {role === 'admin' && <Link href="/admin">Admin</Link>}
      </nav>
      <div className="topbar-right">
        {user ? (
          <>
            <span style={{fontSize:'0.8rem',color:'var(--muted)'}}>
              {user.email} {role === 'admin' && <span className="badge badge-fixed">Admin</span>}
            </span>
            <button className="btn btn-outline btn-sm" onClick={logout}>ออกจากระบบ</button>
          </>
        ) : (
          <Link href="/login"><button className="btn btn-primary btn-sm">เข้าสู่ระบบ / สมัคร</button></Link>
        )}
      </div>
    </header>
  );
}
