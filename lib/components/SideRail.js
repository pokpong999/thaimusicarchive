'use client';
// components/SideRail.js — รางไอคอนซ้าย  (Pk 27 ส.ค. 69)
//
//   กว้าง 56px · ชี้เมาส์แล้วกางออก 232px "ทับ" เนื้อหา ไม่ดันให้แคบลง
//   จึงไม่กินความกว้างของกระดานเขียนโน้ต ซึ่งต้องการราว 1,040px ที่ 8 ห้อง/บรรทัด
//
//   แบ่งเป็นสามโลกตามที่เว็บเป็นจริง: คลัง · สตูดิโอ · โรงเรียน
//   บนมือถือกลายเป็นลิ้นชักที่กด ☰ เปิด
//
//   เปิด-ปิดได้จาก lib/navpref.js — ไม่ชอบก็สลับกลับแถบบนได้ทันที
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavMode } from '../lib/navpref';
import Avatar from './Avatar';
import NotificationBell from './NotificationBell';
import { useLang } from '../lib/i18n';

const isStaff = p => p?.role === 'admin' || p?.role === 'moderator';
const isTeacher = p => !!p?.is_teacher || p?.role === 'teacher';
const isSchool = p => isStaff(p) || isTeacher(p) || p?.role === 'student';

export default function SideRail() {
  const { t } = useLang();
  const { isRail, toggle } = useNavMode();
  const path = usePathname();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [open, setOpen] = useState(false);      // ลิ้นชักบนมือถือ

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (!data.user) return;
      supabase.from('profiles').select('*').eq('id', data.user.id).single()
        .then(({ data: p }) => setProfile(p ?? null));
    });
  }, []);
  useEffect(() => { setOpen(false); }, [path]);   // เปลี่ยนหน้าแล้วปิดลิ้นชัก

  if (!isRail) return null;

  const groups = [
    { name: t('rail_g_archive'), items: [
      { href: '/songs',       ico: '🎼', label: t('rail_db') },
      { href: '/archive',     ico: '📜', label: t('rail_archive') },
      { href: '/leaderboard', ico: '🏆', label: t('rail_board') },
      { href: '/search',      ico: '🔍', label: t('rail_search') },
    ] },
    user && { name: t('rail_g_studio'), items: [
      { href: '/songs/new', ico: '✍️', label: t('rail_write') },
      { href: '/nathab',    ico: '🥁', label: t('rail_nathab') },
      { href: '/dashboard', ico: '📁', label: t('rail_mine') },
      { href: '/diary',     ico: '📔', label: t('rail_diary') },
    ] },
    user && isSchool(profile) && { name: t('rail_g_school'), items: [
      { href: '/classroom', ico: '🎓', label: t('rail_class') },
      { href: '/homework',  ico: '📚', label: t('rail_hw') },
    ] },
  ].filter(Boolean);

  // /songs ต้องไม่ติดไฟตอนอยู่ /songs/new — เทียบให้ตรงกว่านั้นหน่อย
  const active = href => (href === '/' ? path === '/'
    : href === '/songs' ? (path === '/songs' || /^\/songs\/(?!new)/.test(path || ''))
    : path?.startsWith(href));

  return (
    <>
      {/* แถบบางบนมือถือ — มีแค่ปุ่ม ☰ กับกระดิ่ง */}
      <div className="rail-mobbar">
        <button type="button" className="rail-burger" aria-label={t('rail_open')}
          aria-expanded={open} onClick={() => setOpen(v => !v)}>☰</button>
        <Link href="/" className="rail-mobname">{t('brand')}</Link>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'8px'}}>
          {user && <NotificationBell userId={user.id} />}
          {user
            ? <Link href="/profile"><Avatar path={profile?.avatar_url} name={profile?.display_name} size={28} /></Link>
            : <Link href="/login"><button className="btn btn-primary btn-sm">{t('cta_login')}</button></Link>}
        </div>
      </div>

      {open && <div className="rail-scrim" onClick={() => setOpen(false)} />}

      <nav className={'siderail' + (open ? ' open' : '')} aria-label={t('rail_menu')}>
        <Link href="/" className="rail-brand">
          <svg width="26" height="26" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <circle cx="18" cy="18" r="16" stroke="#C9A84C" strokeWidth="1.5" />
            <circle cx="18" cy="18" r="9" stroke="#C9A84C" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx="18" cy="18" r="3.5" fill="#C9A84C" opacity="0.85" />
          </svg>
          <span className="rail-lbl rail-brandtxt">{t('brand')}</span>
        </Link>

        <div className="rail-scroll">
          {groups.map(g => (
            <div key={g.name} className="rail-group">
              <div className="rail-gname"><span>{g.name}</span></div>
              {g.items.map(it => (
                <Link key={it.href} href={it.href}
                  className={'rail-item' + (active(it.href) ? ' on' : '')} title={it.label}>
                  <span className="rail-ico" aria-hidden="true">{it.ico}</span>
                  <span className="rail-lbl">{it.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="rail-foot">
          {isStaff(profile) && (
            <Link href="/admin" className={'rail-item' + (active('/admin') ? ' on' : '')} title={t('nav_admin')}>
              <span className="rail-ico" aria-hidden="true">⚙️</span><span className="rail-lbl">{t('nav_admin')}</span>
            </Link>
          )}
          {user ? (
            <Link href="/profile" className="rail-item" title={profile?.display_name ?? t('nav_profile')}>
              <span className="rail-ico" aria-hidden="true">
                <Avatar path={profile?.avatar_url} name={profile?.display_name} size={22} />
              </span>
              <span className="rail-lbl">{profile?.display_name ?? t('nav_profile')}</span>
            </Link>
          ) : (
            <Link href="/login" className="rail-item" title={t('cta_login')}>
              <span className="rail-ico" aria-hidden="true">→</span><span className="rail-lbl">{t('cta_login')}</span>
            </Link>
          )}
          <button type="button" className="rail-item rail-switch" onClick={toggle}
            title={t('nav_top_ttl')}>
            <span className="rail-ico" aria-hidden="true">⇧</span>
            <span className="rail-lbl">{t('nav_top')}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
