'use client';
// components/Topbar.js — แถบเมนูบน r4  (Pk 5 ก.ย. 69: "หน้าแรกมันดูรกและเละเทะ")
//
//   เดิม: ลิงก์ 8 อัน + ช่องค้นหา + EN + เมนูข้าง + ผู้ดูแล + กระดิ่ง + อวตาร + ศักดินา + ชื่อ + Admin + ออกจากระบบ
//         อัดอยู่บรรทัดเดียว
//   ใหม่: โลโก้ · ลิงก์หลัก 2 อัน · 🔍 (กดแล้วช่องพิมพ์กางออก) · "เมนู ▾" · 🔔 · อวตาร ▾
//         - เมนู ▾  รวมทุกอย่างที่เหลือ แบ่งกลุ่ม คลัง · สตูดิโอ · โรงเรียน เหมือนรางข้าง + ภาษา + สลับเมนูข้าง
//         - อวตาร ▾ ชื่อ ศักดินา โปรไฟล์ ผลงานของฉัน บันทึกโน้ต ผู้ดูแล ออกจากระบบ
//   จอแคบ: ลิงก์หลัก 2 อันย้ายเข้าไปอยู่ใน เมนู ▾ ด้วย
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavMode } from '../lib/navpref';
import { getRank } from '../lib/ranks';
import Avatar from './Avatar';
import NotificationBell from './NotificationBell';
import { useLang } from '../lib/i18n';

// รุ่นของแถบเมนู — ไว้ตรวจว่าไฟล์นี้ถูกอัพแล้ว
export const TOPBAR_VERSION = '5 ก.ย. 69 · r4 (เมนู ▾ + อวตาร ▾)';

const isStaff = p => p?.role === 'admin' || p?.role === 'moderator';
const isSchool = p => isStaff(p) || !!p?.is_teacher || p?.role === 'teacher' || p?.role === 'student';

// ปิดเมนูเมื่อคลิกนอกกรอบ หรือกด Esc
function useOutside(ref, on, off) {
  useEffect(() => {
    if (!on) return;
    const click = e => { if (ref.current && !ref.current.contains(e.target)) off(); };
    const key = e => { if (e.key === 'Escape') off(); };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, [ref, on, off]);
}

function SearchBox() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inp = useRef(null);
  const go = () => {
    const v = q.trim();
    window.location.href = v ? '/search?q=' + encodeURIComponent(v) : '/search';
  };
  useEffect(() => { if (open) inp.current?.focus(); }, [open]);
  return (
    <div className={'tb-search' + (open ? ' open' : '')} data-navsearch>
      <input ref={inp} type="search" placeholder={t('search_ph')} value={q} aria-label={t('search_go')}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') go(); if (e.key === 'Escape') setOpen(false); }}
        onBlur={() => { if (!q) setOpen(false); }} />
      <button type="button" className="tb-ico" title={t('search_go')} aria-label={t('search_go')}
        onClick={() => (open && q ? go() : setOpen(v => !v))}>🔍</button>
    </div>
  );
}

export default function Topbar() {
  const { lang, setLang, t } = useLang();
  const path = usePathname();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [menu, setMenu] = useState(false);
  const [me, setMe] = useState(false);
  const menuRef = useRef(null), meRef = useRef(null);
  const { isRail, toggle: toggleNav } = useNavMode();

  useOutside(menuRef, menu, () => setMenu(false));
  useOutside(meRef, me, () => setMe(false));
  useEffect(() => { setMenu(false); setMe(false); }, [path]);   // เปลี่ยนหน้าแล้วปิดเมนู

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

  if (isRail) return null;

  const on = href => (href === '/songs'
    ? (path === '/songs' || /^\/songs\/(?!new)/.test(path || ''))
    : path?.startsWith(href));
  const rank = getRank(profile?.points);

  return (
    <header className="topbar">
      <Link href="/"><div className="logo-wrap">
        <svg width="32" height="32" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <circle cx="18" cy="18" r="16" stroke="#C9A84C" strokeWidth="1.5"/>
          <circle cx="18" cy="18" r="9" stroke="#C9A84C" strokeWidth="1" strokeDasharray="2 3"/>
          <circle cx="18" cy="18" r="3.5" fill="#C9A84C" opacity="0.85"/>
        </svg>
        <div>
          <div className="logo-th">{t('brand')}</div>
          <div className="logo-en">{t('brand_sub')}</div>
        </div>
      </div></Link>

      <nav className="tb-main" aria-label="main">
        <Link href="/songs" className={on('/songs') ? 'on' : ''}>{t('nav_db')}</Link>
        <Link href="/archive" className={on('/archive') ? 'on' : ''}>{t('nav_archive')}</Link>
      </nav>

      <div className="tb-right">
        <SearchBox />

        {/* เมนู ▾ — ทุกอย่างที่เหลือ */}
        <div className="tb-menu" ref={menuRef}>
          <button type="button" className="tb-ico" aria-haspopup="menu" aria-expanded={menu}
            onClick={() => { setMenu(v => !v); setMe(false); }}>☰ <span>{t('tb_menu')}</span></button>
          {menu && (
            <div className="tb-pop" role="menu">
              <div className="tb-pop-g">{t('rail_g_archive')}</div>
              <Link href="/songs" role="menuitem">🎼 {t('rail_db')}</Link>
              <Link href="/archive" role="menuitem">📜 {t('rail_archive')}</Link>
              <Link href="/leaderboard" role="menuitem">🏆 {t('rail_board')}</Link>
              <Link href="/nathab" role="menuitem">🥁 {t('rail_nathab')}</Link>
              {user && (
                <>
                  <div className="tb-pop-g">{t('rail_g_studio')}</div>
                  <Link href="/songs/new" role="menuitem">✍️ {t('nav_add')}</Link>
                  <Link href="/dashboard" role="menuitem">📁 {t('rail_mine')}</Link>
                  <Link href="/diary" role="menuitem">📔 {t('rail_diary')}</Link>
                </>
              )}
              {user && isSchool(profile) && (
                <>
                  <div className="tb-pop-g">{t('rail_g_school')}</div>
                  <Link href="/classroom" role="menuitem">🎓 {t('rail_class')}</Link>
                  <Link href="/homework" role="menuitem">📚 {t('rail_hw')}</Link>
                </>
              )}
              <hr />
              <button type="button" role="menuitem" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}>
                🌐 {lang === 'th' ? 'English' : 'ภาษาไทย'}</button>
              <button type="button" role="menuitem" onClick={toggleNav} title={t('nav_side_ttl')}>{t('nav_side')}</button>
            </div>
          )}
        </div>

        {user ? (
          <>
            <NotificationBell userId={user.id} />
            {/* อวตาร ▾ — เรื่องของตัวเอง */}
            <div className="tb-menu" ref={meRef}>
              <button type="button" className="tb-ico tb-avbtn" aria-haspopup="menu" aria-expanded={me}
                title={profile?.display_name ?? user.email}
                onClick={() => { setMe(v => !v); setMenu(false); }}>
                <Avatar path={profile?.avatar_url} name={profile?.display_name} size={30} />
                <span aria-hidden="true" style={{fontSize:'0.7rem'}}>▾</span>
              </button>
              {me && (
                <div className="tb-pop" role="menu">
                  <div className="tb-me">
                    <b>{profile?.display_name ?? user.email}</b>
                    <span>{rank.icon} {rank.name} · {(profile?.points ?? 0).toLocaleString()} {t('tb_points')}
                      {profile?.role === 'admin' ? ' · Admin' : profile?.role === 'moderator' ? ' · Moderator' : ''}</span>
                  </div>
                  <hr />
                  <Link href="/profile" role="menuitem">👤 {t('nav_profile')}</Link>
                  <Link href="/dashboard" role="menuitem">📁 {t('nav_mine')}</Link>
                  <Link href="/songs/new" role="menuitem">✎ {t('tb_write')}</Link>
                  <Link href="/archive/new" role="menuitem">📜 {t('tb_record')}</Link>
                  {isStaff(profile) && <Link href="/admin" role="menuitem">⚙️ {t('nav_admin')}</Link>}
                  <hr />
                  <button type="button" role="menuitem" onClick={logout}>↪ {t('nav_logout')}</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <Link href="/login"><button className="btn btn-primary btn-sm">{t('nav_signup')}</button></Link>
        )}
      </div>
    </header>
  );
}
