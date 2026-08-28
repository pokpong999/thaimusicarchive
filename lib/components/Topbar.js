'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavMode } from '../lib/navpref';
import RankBadge from './RankBadge';
import Avatar from './Avatar';
import NotificationBell from './NotificationBell';
import { useLang } from '../lib/i18n';

// รุ่นของแถบเมนู — ไว้ตรวจว่าไฟล์นี้ถูกอัพแล้ว (Pk 28 ส.ค. 69)
export const TOPBAR_VERSION = '28 ส.ค. 69 · r2';

// ช่องค้นหาบนแถบเมนู — Enter แล้วไปที่ฐานข้อมูลเพลงพร้อมคำค้น
function NavSearch() {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const go = () => {
    const v = q.trim();
    window.location.href = v ? '/songs?q=' + encodeURIComponent(v) : '/songs';
  };
  return (
    <div className="nav-search" data-navsearch>
      <input type="search" className="nav-search-input" placeholder={t('search_ph')} value={q}
        aria-label={t('search_go')}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') go(); }} />
      <button type="button" className="nav-search-go" onClick={go} title={t('search_go')}>🔍</button>
    </div>
  );
}

export default function Topbar() {
  const { lang, setLang, t } = useLang();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const { isRail, toggle: toggleNav } = useNavMode();

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
    // select('*') กันพังตอนที่ยังไม่ได้รัน sql/25 (คอลัมน์ is_teacher ยังไม่มี)
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    setProfile(data);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    isRail ? null : (
    <header className="topbar">
      <Link href="/"><div className="logo-wrap">
        <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="16" stroke="#C9A84C" strokeWidth="1.5"/>
          <circle cx="18" cy="18" r="9" stroke="#C9A84C" strokeWidth="1" strokeDasharray="2 3"/>
          <circle cx="18" cy="18" r="3.5" fill="#C9A84C" opacity="0.85"/>
        </svg>
        <div>
          <div className="logo-th">{t('brand')}</div>
          <div className="logo-en">{t('brand_sub')}</div>
        </div>
      </div></Link>
      <nav className="nav">
        <Link href="/songs">{t('nav_db')}</Link>
        <Link href="/archive">{t('nav_archive')}</Link>
        <Link href="/leaderboard">{t('nav_board')}</Link>
        {user && <Link href="/songs/new">{t('nav_add')}</Link>}
        {user && <Link href="/dashboard">{t('nav_mine')}</Link>}
        {/* เมนูการบ้าน — เห็นเฉพาะนักเรียนกับครู (Pk 27 ส.ค. 69) */}
        {user && (profile?.role === 'student' || profile?.is_teacher || profile?.role === 'teacher'
                  || profile?.role === 'admin' || profile?.role === 'moderator')
          && <Link href="/homework" title={t('nav_homework_ttl')}>{t('nav_homework')}</Link>}
        {user && (profile?.role === 'student' || profile?.is_teacher || profile?.role === 'teacher'
                  || profile?.role === 'admin' || profile?.role === 'moderator')
          && <Link href="/classroom" title={t('rail_class')}>{t('nav_class')}</Link>}
        {user && <Link href="/diary" title={t('nav_diary_ttl')}>{t('nav_diary')}</Link>}
        <NavSearch />
        <button type="button" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
          title={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
          style={{cursor:'pointer',fontSize:'0.8rem',border:'1px solid var(--border)',background:'transparent',
            borderRadius:'5px',padding:'6px 10px',minHeight:'32px',color:'var(--muted)',fontFamily:'inherit'}}>
          {lang === 'th' ? 'EN' : 'ไทย'}</button>
        {/* สลับไปใช้รางไอคอนซ้าย — ลองใช้แล้วไม่ชอบก็กดกลับได้ (Pk 27 ส.ค. 69) */}
        <button type="button" className="nav-switch" onClick={toggleNav}
          title={t('nav_side_ttl')}>{t('nav_side')}</button>
        {(profile?.role === 'admin' || profile?.role === 'moderator') && <Link href="/admin">{t('nav_admin')}</Link>}
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
            {profile?.role === 'moderator' && <span className="badge badge-fixed">Moderator</span>}
            <button className="btn btn-outline btn-sm" onClick={logout}>{t('nav_logout')}</button>
          </>
        ) : (
          <Link href="/login"><button className="btn btn-primary btn-sm">{t('nav_signup')}</button></Link>
        )}
      </div>
    </header>
    )
  );
}
