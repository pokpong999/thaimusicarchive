'use client';
// app/page.js — หน้าแรก  (Pk 27 ส.ค. 69)
//
//   "ผมอยากแยกหน้า หน้าแรกไม่แสดงรายการเพลง นำไปไว้หน้าฐานข้อมูลเพลงไทย"
//
//   หน้าแรกเหลือแค่ทางเข้าสองหอ + ข่าวสาร + ช่องค้นหา
//   รายชื่อเพลงทั้งหมดย้ายไปที่ /songs แล้ว (app/songs/page.js)
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';
import AnniversaryBanner from '../components/AnniversaryBanner';
import GoalBanner from '../components/GoalBanner';
import TopArchivists from '../components/TopArchivists';
import RandomEvents from '../components/RandomEvents';
import { EImage } from '../components/Editable';
import { useLang } from '../lib/i18n';

// รุ่นของหน้าแรก — ขึ้นเป็นข้อความเล็ก ๆ ใต้เนื้อหา ไว้ตรวจว่าไฟล์นี้ถูกอัพแล้ว
export const HOME_VERSION = '28 ส.ค. 69 · r4 (แยกหน้า · สองภาษา)';

function HeroAuth() {
  const { t } = useLang();
  const [user, setUser] = useState(undefined);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null)); }, []);
  if (user !== null) return null;
  return (
    <div style={{margin:'-0.2rem 0 1.8rem'}}>
      <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
        <a href="/login"><button className="btn btn-primary" style={{padding:'0.7rem 2rem',fontSize:'0.95rem'}}>{t('cta_signup')}</button></a>
        <a href="/login"><button className="btn btn-outline" style={{padding:'0.7rem 2rem',fontSize:'0.95rem'}}>{t('cta_login')}</button></a>
      </div>
    </div>
  );
}

// ช่องค้นหาใหญ่กลางหน้าแรก — พิมพ์แล้ว Enter ไปที่ฐานข้อมูลเพลงพร้อมคำค้น
function HomeSearch() {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const go = () => {
    const s = q.trim();
    window.location.href = s ? '/songs?q=' + encodeURIComponent(s) : '/songs';
  };
  return (
    <div data-homesearch style={{display:'flex',gap:'8px',maxWidth:'620px',margin:'0 auto 1.6rem'}}>
      <input className="search-input" style={{flex:1}} placeholder={t('search_ph')}
        value={q} onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') go(); }} />
      <button className="btn btn-primary" onClick={go} style={{whiteSpace:'nowrap'}}>🔍 {t('search_go')}</button>
    </div>
  );
}

export default function HomePage() {
  const { t } = useLang();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const [sc, ac, mc, pc, kc] = await Promise.all([
        supabase.from('songs').select('id', { count: 'exact', head: true }),
        supabase.from('archive_records').select('id', { count: 'exact', head: true }).eq('approved', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('pattern_library').select('pattern_id', { count: 'exact', head: true }),
        supabase.from('krasuan_catalog').select('id', { count: 'exact', head: true }),
      ]);
      setStats({ songs: sc.count ?? 0, records: ac.count ?? 0, members: mc.count ?? 0,
        patterns: pc.count ?? 0, verses: kc.count ?? 0 });
    })();
  }, []);

  return (
    <>
      <AnniversaryBanner />
      <main className="container">
        {/* ป้ายเป้าหมาย: โพสต์เหตุการณ์ → 300 ศักดินา → ขุน → ปลดล็อกกระดานโน้ตฟรี */}
        <GoalBanner />

        {/* ตัววิ่งอันดับ 1-2-3 ของทำเนียบ (Pk 27 ส.ค. 69) */}
        <TopArchivists />

        {/* ช่องค้นหาด้านบน — "จะได้ค้นง่าย" (Pk 28 ส.ค. 69) */}
        <HomeSearch />

        {/* ── ทางเข้าสองหอ ── */}
        <section className="hero2">
          <a href="/songs" className="hero-card hero-songs">
            <div className="hero-glyphs" aria-hidden>ด ร ม ฟ ซ ล ท<br/>― ― ๐ ― ― ๐ ―<br/>ซ ล ดํ รํ มํ<br/>๐ ― ― ๐</div>
            <div className="hero-inner">
              <div className="hero-kicker">{t('home_db_kicker')}</div>
              <div className="hero-title" style={{whiteSpace:'pre-line'}}>{t('home_db_title')}</div>
              <div className="hero-sub">{t('home_db_sub')}</div>
              <span className="hero-cta">{t('home_db_cta')}</span>
            </div>
          </a>
          <a href="/archive" className="hero-card hero-history">
            <div className="hero-glyphs" aria-hidden>๒๓๑๐ · ๒๔๔๓<br/>๛ ๏ ๛<br/>๒๔๖๖ · ๒๕๖๙</div>
            <div className="hero-inner">
              <div className="hero-kicker">{t('home_ar_kicker')}</div>
              <div className="hero-title" style={{whiteSpace:'pre-line'}}>{t('home_ar_title')}</div>
              <div className="hero-sub">{t('home_ar_sub')}</div>
              <span className="hero-cta">{t('home_ar_cta')}</span>
            </div>
          </a>
        </section>

        <div className="m1col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',margin:'0 0 1.2rem'}}>
          <EImage k="home.banner.left" height={200} />
          <EImage k="home.banner.right" height={200} />
        </div>
        <HeroAuth />

        {/* สุ่มเหตุการณ์จากหอจดหมายเหตุ (Pk 27 ส.ค. 69) */}
        <RandomEvents />

        {stats && (
          <div data-homestats style={{display:'flex',gap:'18px',flexWrap:'wrap',justifyContent:'center',
            fontSize:'0.8rem',color:'var(--muted)',margin:'1.4rem 0 0.4rem'}}>
            <span><b style={{color:'var(--jade)'}}>{stats.songs}</b> {t('st_songs')}</span>
            <span><b style={{color:'var(--jade)'}}>{stats.records}</b> {t('st_records')}</span>
            <span><b style={{color:'var(--jade)'}}>{stats.members}</b> {t('st_members')}</span>
            <span><b style={{color:'var(--jade)'}}>{stats.patterns}</b> {t('st_patterns')}</span>
          </div>
        )}

        <div style={{fontSize:'0.66rem',color:'var(--muted)',margin:'0.3rem 0',textAlign:'center'}} data-homever>
          หน้าแรกรุ่น {HOME_VERSION}
        </div>
      </main>
    </>
  );
}
