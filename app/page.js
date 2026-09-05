'use client';
// app/page.js — หน้าแรก r6 "ประตูสองหอ"  (Pk 5 ก.ย. 69: "หน้าแรกมันดูรกและเละเทะ" → รื้อใหม่ทั้งหน้า)
//
//   ของเด่นชิ้นเดียว: แผงรูปใหญ่สองบาน (ฐานข้อมูลเพลง / หอจดหมายเหตุ)
//   รูปพื้นหลังใช้คีย์เดิม home.banner.left / home.banner.right — ผู้ดูแลอัปโหลดได้จากปุ่มมุมแผง
//   ยังไม่มีรูป → พื้นไล่สีเรียบ ๆ
//
//   ลำดับ: ชื่อเว็บ + ช่องค้นหาเดียว + สถิติบรรทัดเดียว → ประตูสองบาน
//          → ดุริยกาล (วันนี้ในอดีต) + สุ่มเหตุการณ์ → ดีเด่น 3 คน (รายชื่อนิ่ง) คู่กับป้ายเป้าหมาย
//   ตัดออก: ช่องค้นหาซ้ำ · ตัววิ่ง · ลายอักษรพื้นหลัง · ป้าย "ปลดล็อกแล้ว" (ย้ายไปเมนูอวตาร) · ปุ่มสมัครซ้ำ
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AnniversaryBanner from '../components/AnniversaryBanner';
import GoalBanner from '../components/GoalBanner';
import TopThree from '../components/TopThree';
import RandomEvents from '../components/RandomEvents';
import { EImage } from '../components/Editable';
import { useLang } from '../lib/i18n';

// รุ่นของหน้าแรก — ขึ้นเป็นข้อความเล็ก ๆ ใต้เนื้อหา ไว้ตรวจว่าไฟล์นี้ถูกอัพแล้ว
export const HOME_VERSION = '5 ก.ย. 69 · r6 (ประตูสองหอ)';

function HomeSearch() {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const go = () => {
    const s = q.trim();
    window.location.href = s ? '/search?q=' + encodeURIComponent(s) : '/search';
  };
  return (
    <div className="home-search" data-homesearch>
      <input placeholder={t('search_ph')} value={q} aria-label={t('search_go')}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') go(); }} />
      <button className="btn btn-primary" onClick={go} style={{whiteSpace:'nowrap',padding:'0 1.3rem'}}>{t('search_go')}</button>
    </div>
  );
}

// ประตูหนึ่งบาน — แผงเป็น div (ไม่ใช่ <a>) เพราะข้างในมีปุ่มอัปโหลดรูปของผู้ดูแล
// ชื่อหอกับปุ่มเป็นลิงก์ ทั้งสองอันไปหน้าเดียวกัน
function Door({ href, imgKey, cls, title, sub, cta }) {
  return (
    <div className={`door ${cls} nopic`}>
      <div className="door-img"><EImage k={imgKey} height={400} /></div>
      <div className="door-fx" />
      <div className="door-txt">
        <a href={href} className="door-name" style={{whiteSpace:'pre-line'}}>{title}</a>
        <div className="door-sub">{sub}</div>
        <a href={href} className="door-cta">{cta} →</a>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { t } = useLang();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const [sc, ac, mc, pc] = await Promise.all([
        supabase.from('songs').select('id', { count: 'exact', head: true }),
        supabase.from('archive_records').select('id', { count: 'exact', head: true }).eq('approved', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('pattern_library').select('pattern_id', { count: 'exact', head: true }),
      ]);
      setStats({ songs: sc.count ?? 0, records: ac.count ?? 0, members: mc.count ?? 0, patterns: pc.count ?? 0 });
    })();
  }, []);

  return (
    <main className="container">
      <header className="home-head">
        <h1 className="home-title">{t('brand')}</h1>
        <p className="home-tag">{t('home_tag')}</p>
        <HomeSearch />
        {stats && (
          <div className="home-stats" data-homestats>
            <span><b>{stats.songs.toLocaleString()}</b>{t('st_songs')}</span>
            <span><b>{stats.records.toLocaleString()}</b>{t('st_records')}</span>
            <span><b>{stats.patterns.toLocaleString()}</b>{t('st_patterns')}</span>
            <span><b>{stats.members.toLocaleString()}</b>{t('st_members')}</span>
          </div>
        )}
      </header>

      {/* ── ประตูสองหอ ── */}
      <section className="doors" aria-label="doors">
        <Door href="/songs" imgKey="home.banner.left" cls="door-songs"
          title={t('home_db_title')} sub={t('home_db_sub')} cta={t('home_db_cta')} />
        <Door href="/archive" imgKey="home.banner.right" cls="door-history"
          title={t('home_ar_title')} sub={t('home_ar_sub')} cta={t('home_ar_cta')} />
      </section>

      {/* ── จากหอจดหมายเหตุ: ดุริยกาล (วันนี้ในอดีต) + สุ่มเหตุการณ์ ── */}
      <AnniversaryBanner boxed />
      <RandomEvents />

      {/* ── ดีเด่น 3 คน · ป้ายเป้าหมาย (เฉพาะแขก / สมาชิกที่ยังไม่ถึงขุน) ── */}
      <div className="home-2col">
        <TopThree />
        <GoalBanner homeOnly />
      </div>

      <div style={{fontSize:'0.66rem',color:'var(--muted)',margin:'0.3rem 0',textAlign:'center'}} data-homever>
        หน้าแรกรุ่น {HOME_VERSION}
      </div>
    </main>
  );
}
