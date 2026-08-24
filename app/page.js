'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AnniversaryBanner from '../components/AnniversaryBanner';

const PAGE_SIZE = 25;


function HeroAuth() {
  const [user, setUser] = useState(undefined);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null)); }, []);
  if (user !== null) return null;
  return (
    <div style={{display:'flex',gap:'12px',justifyContent:'center',margin:'-0.2rem 0 1.8rem',flexWrap:'wrap'}}>
      <a href="/login"><button className="btn btn-primary" style={{padding:'0.7rem 2rem',fontSize:'0.95rem'}}>✦ สมัครสมาชิก</button></a>
      <a href="/login"><button className="btn btn-outline" style={{padding:'0.7rem 2rem',fontSize:'0.95rem'}}>เข้าสู่ระบบ</button></a>
    </div>
  );
}

export default function HomePage() {
  const [songs, setSongs] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [videoCounts, setVideoCounts] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { load(); }, [page, q]);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      setIsAdmin(p?.role === 'admin');
    });
  }, []);

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

  async function adminDeleteSong(s) {
    if (!confirm(`ลบเพลง "${s.name_th}" (${s.id}) ถาวร?\nโน้ต วิดีโอ ไฟล์ และคอมเมนต์ของเพลงนี้จะถูกลบทั้งหมด`)) return;
    const { error } = await supabase.from('songs').delete().eq('id', s.id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    load();
  }

  async function load() {
    setLoading(true);
    let query = supabase.from('songs').select('*', { count: 'exact' }).order('name_th');
    if (q) query = query.or(`name_th.ilike.%${q}%,id.ilike.%${q}%`);
    const { data, count: c } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setSongs(data ?? []);
    setCount(c ?? 0);
    setLoading(false);
    if (data?.length) {
      const ids = data.map(s => s.id);
      const { data: vids } = await supabase.from('song_videos')
        .select('song_id').in('song_id', ids).eq('approved', true);
      const vc = {};
      (vids ?? []).forEach(v => { vc[v.song_id] = (vc[v.song_id] ?? 0) + 1; });
      setVideoCounts(vc);
    }
  }

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <>
      <AnniversaryBanner />
      <main className="container">

        {/* ── Hero: สองหอ ── */}
        <section className="hero2">
          <a href="#songs" className="hero-card hero-songs">
            <div className="hero-glyphs" aria-hidden>ด ร ม ฟ ซ ล ท<br/>― ― ๐ ― ― ๐ ―<br/>ซ ล ดํ รํ มํ<br/>๐ ― ― ๐</div>
            <div className="hero-inner">
              <div className="hero-kicker">SONG ARCHIVE</div>
              <div className="hero-title">หอจดหมายเหตุ<br/>เพลงไทย</div>
              <div className="hero-sub">โน้ต 300 เพลง · 20,000+ วรรค · รหัสกระสวน · เล่นเสียงฆ้องวงจริง</div>
              <span className="hero-cta">เข้าชมคลังเพลง →</span>
            </div>
          </a>
          <a href="/archive" className="hero-card hero-history">
            <div className="hero-glyphs" aria-hidden>๒๓๑๐ · ๒๔๔๓<br/>๛ ๏ ๛<br/>๒๔๖๖ · ๒๕๖๙</div>
            <div className="hero-inner">
              <div className="hero-kicker">HISTORY ARCHIVE</div>
              <div className="hero-title">หอจดหมายเหตุ<br/>ดนตรีไทย</div>
              <div className="hero-sub">เหตุการณ์ 270+ รายการ · แผนที่ · เส้นเวลา 700 ปี · ครูดนตรี</div>
              <span className="hero-cta">เข้าชมหอประวัติศาสตร์ →</span>
            </div>
          </a>
        </section>
        <HeroAuth />

        <div id="songs" className="section-title">รายการเพลงทั้งหมด</div>
        <div className="section-subtitle">Thai Classical Music Catalog · {count} songs</div>
        <div className="search-bar">
          <input className="search-input" placeholder="ค้นหาชื่อเพลง หรือ Song ID..."
            value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Song ID</th><th>ชื่อเพลง</th><th>ประเภท</th><th>วรรค</th><th>กระสวน</th><th>วิดีโอ</th>{isAdmin && <th></th>}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} style={{textAlign:'center',color:'var(--muted)'}}>กำลังโหลด...</td></tr>
              ) : songs.map(s => (
                <tr key={s.id}>
                  <td className="song-id">{s.id}</td>
                  <td><Link href={`/songs/${s.id}`}><span className="song-name">{s.name_th}</span></Link></td>
                  <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{s.type}</td>
                  <td style={{fontFamily:'monospace',color:'var(--jade)'}}>{s.total_verses}</td>
                  <td style={{fontFamily:'monospace',color:'var(--jade)'}}>{s.unique_patterns}</td>
                  <td>{videoCounts[s.id]
                    ? <span style={{color:'var(--jade)',fontSize:'0.78rem'}}>▶ {videoCounts[s.id]}</span>
                    : <span style={{color:'var(--border)'}}>—</span>}</td>
                  {isAdmin && <td>
                    <button className="btn btn-danger btn-sm" onClick={() => adminDeleteSong(s)}
                      title="ลบเพลง (Admin)">🗑</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>
            หน้า {page + 1} / {totalPages || 1} · ทั้งหมด {count} เพลง
          </div>
          <div style={{display:'flex',gap:'4px'}}>
            <button className="page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ ก่อนหน้า</button>
            <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>ถัดไป ›</button>
          </div>
        </div>
      </main>
    </>
  );
}
