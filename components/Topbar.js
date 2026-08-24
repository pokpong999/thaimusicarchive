'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import RankBadge from './RankBadge';
import Avatar from './Avatar';
import NotificationBell from './NotificationBell';

export default function Topbar() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadProfile(data.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProfile(uid) {
    const { data } = await supabase.from('profiles').select('role, points, display_name, avatar_url').eq('id', uid).single();
    setProfile(data);
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
          <div className="logo-th">หอจดหมายเหตุดนตรีไทย</div>
          <div className="logo-en">Thai Music Archive · THMA</div>
        </div>
      </div></Link>
      <nav className="nav">
        <Link href="/">จดหมายเหตุเพลงไทย</Link>
        <Link href="/archive">จดหมายเหตุดนตรีไทย</Link>
        <Link href="/leaderboard">ทำเนียบ</Link>
        {user && <Link href="/songs/new">➕ เพิ่มเพลง</Link>}
        {user && <Link href="/dashboard">ของฉัน</Link>}
        <Link href="/search" title="ค้นหา">🔍</Link>
        {profile?.role === 'admin' && <Link href="/admin">Admin</Link>}
      </nav>
      <div className="topbar-right">
        {user ? (
          <>
            <NotificationBell userId={user.id} />
            <Avatar path={profile?.avatar_url} name={profile?.display_name} size={30} />
            <RankBadge points={profile?.points} showPoints />
            <Link href="/profile"><span style={{fontSize:'0.78rem',color:'var(--muted)',cursor:'pointer',textDecoration:'underline dotted'}}>
              {profile?.display_name ?? user.email}</span></Link>
            {profile?.role === 'admin' && <span className="badge badge-fixed">Admin</span>}
            <button className="btn btn-outline btn-sm" onClick={logout}>ออกจากระบบ</button>
          </>
        ) : (
          <Link href="/login"><button className="btn btn-primary btn-sm">เข้าสู่ระบบ / สมัคร</button></Link>
        )}
      </div>
    </header>
  );
}
