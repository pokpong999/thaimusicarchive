'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import RankBadge from '../../components/RankBadge';
import Avatar from '../../components/Avatar';
import { getRank, getNextRank } from '../../lib/ranks';

const Status = ({ ok }) => (
  <span className="badge" style={{
    background: ok ? 'rgba(76,154,132,0.15)' : 'rgba(201,168,76,0.15)',
    color: ok ? 'var(--jade)' : 'var(--gold)',
    border: `1px solid ${ok ? 'rgba(76,154,132,0.4)' : 'rgba(201,168,76,0.4)'}`,
  }}>{ok ? '✓ อนุมัติแล้ว' : '⏳ รอตรวจ'}</span>
);

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [videos, setVideos] = useState([]);
  const [tangs, setTangs] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [songs, setSongs] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) load(data.user.id);
      else setLoading(false);
    });
  }, []);

  async function load(uid) {
    const [p, r, v, t, f, s, c] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('archive_records').select('id, what_text, when_text, approved, created_at')
        .eq('submitted_by', uid).order('created_at', { ascending: false }),
      supabase.from('song_videos').select('id, song_id, title, approved, created_at, songs(name_th)')
        .eq('submitted_by', uid).order('created_at', { ascending: false }),
      supabase.from('melody_submissions').select('id, song_id, instrument, approved, created_at, songs(name_th)')
        .eq('submitted_by', uid).order('created_at', { ascending: false }),
      supabase.from('song_files').select('id, song_id, title, approved, created_at, songs(name_th)')
        .eq('submitted_by', uid).order('created_at', { ascending: false }),
      supabase.from('song_submissions').select('id, name_th, instrument, approved, assigned_song_id, created_at')
        .eq('submitted_by', uid).order('created_at', { ascending: false }),
      supabase.from('comments').select('id, target_type, target_id, body, created_at')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
    ]);
    setProfile(p.data); setRecords(r.data ?? []); setVideos(v.data ?? []);
    setTangs(t.data ?? []); setPdfs(f.data ?? []); setSongs(s.data ?? []);
    setComments(c.data ?? []);
    setLoading(false);
  }

  async function del(table, id, item) {
    if (!confirm('ลบรายการนี้? (ลบแล้วหายจากเว็บทันที)')) return;
    // ทางเครื่องที่อนุมัติแล้ว: ลบโน้ตจริงในเพลงด้วย
    if (table === 'melody_submissions' && item?.approved) {
      await supabase.from('song_melody').delete()
        .eq('song_id', item.song_id).eq('instrument', item.instrument).eq('submitted_by', user.id);
    }
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    load(user.id);
  }

  if (!user && !loading) return (
    <main className="container" style={{maxWidth:'500px'}}>
      <div className="lock-box">
        <div style={{marginBottom:'1rem'}}>เข้าสู่ระบบเพื่อดูผลงานของคุณ</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ</button></Link>
      </div>
    </main>
  );
  if (loading) return <main className="container">กำลังโหลด...</main>;

  const rank = getRank(profile?.points);
  const next = getNextRank(profile?.points);
  const pts = profile?.points ?? 0;
  const progress = next ? Math.min(100, Math.round((pts - rank.min) / (next.min - rank.min) * 100)) : 100;
  const totalApproved = [records, videos, tangs, pdfs].flat().filter(x => x.approved).length
    + songs.filter(x => x.approved).length;

  const Section = ({ title, items, render, table }) => (
    <div className="card">
      <div style={{fontWeight:600,marginBottom:'0.7rem'}}>{title} ({items.length})</div>
      {items.length === 0
        ? <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>ยังไม่มีรายการ</div>
        : items.map(it => (
          <div key={it.id} style={{display:'flex',gap:'8px',alignItems:'center',
            padding:'6px 0',borderBottom:'1px solid rgba(42,63,92,0.35)',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:'220px',fontSize:'0.83rem'}}>{render(it)}</div>
            <Status ok={it.approved} />
            {table && (
              <button className="btn btn-danger btn-sm" onClick={() => del(table, it.id, it)}>🗑 ลบ</button>
            )}
          </div>
        ))}
    </div>
  );

  return (
    <main className="container" style={{maxWidth:'820px'}}>
      {/* สรุปบรรดาศักดิ์ */}
      <div className="card" style={{borderColor:'rgba(201,168,76,0.35)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'1rem'}}>
          <div style={{display:'flex',gap:'1rem',alignItems:'center'}}>
            <Avatar path={profile?.avatar_url} name={profile?.display_name} size={56} />
            <div>
            <div style={{fontSize:'1.15rem',fontWeight:700}}>
              {profile?.display_name ?? 'สมาชิก'} <RankBadge points={pts} />
            </div>
            <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:'4px'}}>
              ผลงานอนุมัติแล้ว {totalApproved} ชิ้น · {pts.toLocaleString()} แต้ม
            </div>
            </div>
          </div>
          <Link href="/profile"><button className="btn btn-outline btn-sm">✏️ แก้โปรไฟล์</button></Link>
        </div>
        {next && (
          <div style={{marginTop:'0.9rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.72rem',color:'var(--muted)',marginBottom:'4px'}}>
              <span>{rank.icon} {rank.name}</span>
              <span>อีก {(next.min - pts).toLocaleString()} แต้ม → {next.icon} {next.name}</span>
            </div>
            <div style={{height:'8px',background:'var(--navy3)',borderRadius:'4px',overflow:'hidden'}}>
              <div style={{width:`${progress}%`,height:'100%',background:'linear-gradient(90deg,var(--gold),var(--gold2))'}} />
            </div>
          </div>
        )}
      </div>

      <Section title="📜 บันทึกจดหมายเหตุ" items={records} table="archive_records"
        render={r => <Link href={`/archive/${r.id}`}><span style={{cursor:'pointer'}}>{r.what_text} <span style={{color:'var(--muted)'}}>· {r.when_text}</span></span></Link>} />
      <Section title="🎬 วิดีโอเพลง" items={videos} table="song_videos"
        render={v => <Link href={`/songs/${v.song_id}`}><span style={{cursor:'pointer'}}>{v.songs?.name_th} <span style={{color:'var(--muted)'}}>· {v.title ?? ''}</span></span></Link>} />
      <Section title="🎹 ทางเครื่องดนตรี" items={tangs} table="melody_submissions"
        render={t => <Link href={`/songs/${t.song_id}`}><span style={{cursor:'pointer'}}>{t.songs?.name_th} <span className="badge badge-fixed">{t.instrument}</span></span></Link>} />
      <Section title="🎼 เพลงที่เพิ่ม" items={songs} table="song_submissions"
        render={s => s.assigned_song_id
          ? <Link href={`/songs/${s.assigned_song_id}`}><span style={{cursor:'pointer'}}>{s.name_th} <span className="song-id">({s.assigned_song_id})</span></span></Link>
          : <span>{s.name_th} <span className="badge badge-fixed">{s.instrument}</span></span>} />
      <Section title="📁 ไฟล์ PDF ต้นฉบับ" items={pdfs} table="song_files"
        render={f => <Link href={`/songs/${f.song_id}`}><span style={{cursor:'pointer'}}>{f.songs?.name_th} <span style={{color:'var(--muted)'}}>· {f.title}</span></span></Link>} />

      <div className="card">
        <div style={{fontWeight:600,marginBottom:'0.7rem'}}>💬 ความคิดเห็นล่าสุด ({comments.length})</div>
        {comments.length === 0
          ? <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>ยังไม่มีความคิดเห็น</div>
          : comments.map(c => (
            <div key={c.id} style={{display:'flex',gap:'8px',alignItems:'center',padding:'6px 0',
              borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
              <Link href={c.target_type === 'song' ? `/songs/${c.target_id}` : `/archive/${c.target_id}`} style={{flex:1}}>
                <span style={{fontSize:'0.8rem',cursor:'pointer'}}>{(c.body ?? '(รูปภาพ)').slice(0, 90)}</span>
              </Link>
              <button className="btn btn-danger btn-sm" onClick={() => del('comments', c.id)}>🗑</button>
            </div>
          ))}
      </div>
    </main>
  );
}
