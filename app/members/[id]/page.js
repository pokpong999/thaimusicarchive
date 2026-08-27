'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import RankBadge from '../../../components/RankBadge';
import Avatar from '../../../components/Avatar';
import { useMe } from '../../../components/Gate';
import { fmtDT, ago } from '../../../lib/fmtdate';

export default function MemberPage() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [records, setRecords] = useState([]);
  // เดิมหน้านี้แสดงแค่ เพลง/จดหมายเหตุ/วิดีโอ — ผลงานอีก 3 ประเภทหายไปเฉย ๆ (Pk 27 ส.ค. 69)
  const [tangs, setTangs] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [audios, setAudios] = useState([]);
  const [videos, setVideos] = useState([]);
  const [songs, setSongs] = useState([]);
  const [act, setAct] = useState(null);      // วันสมัคร/เข้าใช้ล่าสุด (แอดมินเท่านั้น)
  const me = useMe();

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, points, role, organization, province, bio, avatar_url, created_at')
      .eq('id', id).single().then(({ data }) => setP(data));
    supabase.from('archive_records').select('id, what_text, when_text, created_at').eq('approved', true)
      .eq('submitted_by', id).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setRecords(data ?? []));
    supabase.from('song_videos').select('id, song_id, created_at, songs(name_th)').eq('approved', true)
      .eq('submitted_by', id).order('created_at', { ascending: false }).limit(30).then(({ data }) => setVideos(data ?? []));
    supabase.from('songs').select('id, name_th, created_at').eq('contributed_by', id).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setSongs(data ?? []));
    supabase.from('melody_submissions').select('id, song_id, instrument, created_at, songs(name_th)').eq('approved', true)
      .eq('submitted_by', id).order('created_at', { ascending: false }).limit(30).then(({ data }) => setTangs(data ?? []));
    supabase.from('song_files').select('id, song_id, title, created_at, songs(name_th)').eq('approved', true)
      .eq('submitted_by', id).order('created_at', { ascending: false }).limit(30).then(({ data }) => setPdfs(data ?? []));
    supabase.from('song_audio').select('id, song_id, title, created_at, songs(name_th)').eq('approved', true)
      .eq('submitted_by', id).order('created_at', { ascending: false }).limit(30).then(({ data }) => setAudios(data ?? []));
  }, [id]);
  useEffect(() => {
    if (!me.isAdmin) return;
    supabase.rpc('thma_member_activity').then(({ data }) => setAct((data ?? []).find(a => a.id === id) ?? null));
  }, [me.isAdmin, id]);

  if (!p) return <main className="container">กำลังโหลด...</main>;

  return (
    <main className="container" style={{maxWidth:'700px'}}>
      <div className="card" style={{borderColor:'rgba(201,168,76,0.35)'}}>
        <div style={{display:'flex',gap:'1.2rem',alignItems:'center'}}>
          <Avatar path={p.avatar_url} name={p.display_name} size={80} />
          <div>
            <div style={{fontSize:'1.25rem',fontWeight:700}}>{p.display_name ?? 'สมาชิก'}</div>
            <div style={{margin:'6px 0'}}><RankBadge points={p.points} showPoints /></div>
            <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>
              {[p.organization, p.province].filter(Boolean).join(' · ')}
            </div>
            {me.isAdmin && (act || p.created_at) && (
              <div style={{fontSize:'0.72rem',color:'var(--gold2)',marginTop:'6px'}} title="เห็นเฉพาะผู้ดูแล">
                🔐 สมัครเมื่อ {fmtDT(act?.joined_at ?? p.created_at) || '—'}
                {act?.last_sign_in_at && <> · เข้าใช้ล่าสุด {ago(act.last_sign_in_at)} ({fmtDT(act.last_sign_in_at)})</>}
                {act && !act.email_confirmed_at && <span style={{color:'var(--danger)'}}> · ยังไม่ยืนยันอีเมล</span>}
              </div>
            )}
          </div>
        </div>
        {p.bio && <div style={{marginTop:'1rem',fontSize:'0.85rem',lineHeight:1.8,
          borderTop:'1px solid var(--border)',paddingTop:'0.8rem'}}>{p.bio}</div>}
      </div>

      {songs.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎼 เพลงที่เพิ่ม ({songs.length})</div>
          {songs.map(s => (
            <Link key={s.id} href={`/songs/${s.id}`}>
              <div style={{padding:'6px 0',cursor:'pointer',fontSize:'0.86rem'}}>
                <span className="song-id" style={{marginRight:'8px'}}>{s.id}</span>{s.name_th}
                {s.created_at && <span style={{color:'var(--muted)',fontSize:'0.7rem'}}> · 🕒 {fmtDT(s.created_at)}</span>}</div>
            </Link>
          ))}
        </div>
      )}
      {records.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>📜 บันทึกจดหมายเหตุ ({records.length})</div>
          {records.map(r => (
            <Link key={r.id} href={`/archive/${r.id}`}>
              <div style={{padding:'6px 0',cursor:'pointer',fontSize:'0.86rem'}}>
                {r.what_text} <span style={{color:'var(--muted)',fontSize:'0.74rem'}}>· {r.when_text}</span>
                {r.created_at && <span style={{color:'var(--muted)',fontSize:'0.7rem'}}> · 🕒 {fmtDT(r.created_at)}</span>}</div>
            </Link>
          ))}
        </div>
      )}
      {tangs.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎻 ทางเครื่องที่ถอด ({tangs.length})</div>
          {tangs.map(t => (
            <Link key={t.id} href={`/songs/${t.song_id}`}>
              <div style={{padding:'6px 0',cursor:'pointer',fontSize:'0.86rem'}}>{t.songs?.name_th}
                <span className="badge badge-fixed" style={{marginLeft:'8px'}}>{t.instrument}</span>
                {t.created_at && <span style={{color:'var(--muted)',fontSize:'0.7rem'}}> · 🕒 {fmtDT(t.created_at)}</span>}</div>
            </Link>
          ))}
        </div>
      )}
      {pdfs.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>📄 โน้ต PDF ที่แนบ ({pdfs.length})</div>
          {pdfs.map(f => (
            <Link key={f.id} href={`/songs/${f.song_id}`}>
              <div style={{padding:'6px 0',cursor:'pointer',fontSize:'0.86rem'}}>{f.songs?.name_th}
                <span style={{color:'var(--muted)',fontSize:'0.74rem'}}> · {f.title}</span>
                {f.created_at && <span style={{color:'var(--muted)',fontSize:'0.7rem'}}> · 🕒 {fmtDT(f.created_at)}</span>}</div>
            </Link>
          ))}
        </div>
      )}
      {audios.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎙 บันทึกเสียงที่แนบ ({audios.length})</div>
          {audios.map(a => (
            <Link key={a.id} href={`/songs/${a.song_id}`}>
              <div style={{padding:'6px 0',cursor:'pointer',fontSize:'0.86rem'}}>{a.songs?.name_th}
                <span style={{color:'var(--muted)',fontSize:'0.74rem'}}> · {a.title ?? 'ไม่มีชื่อชุด'}</span>
                {a.created_at && <span style={{color:'var(--muted)',fontSize:'0.7rem'}}> · 🕒 {fmtDT(a.created_at)}</span>}</div>
            </Link>
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎬 วิดีโอที่เพิ่ม ({videos.length})</div>
          {videos.map(v => (
            <Link key={v.id} href={`/songs/${v.song_id}`}>
              <div style={{padding:'6px 0',cursor:'pointer',fontSize:'0.86rem'}}>{v.songs?.name_th}
                {v.created_at && <span style={{color:'var(--muted)',fontSize:'0.7rem'}}> · 🕒 {fmtDT(v.created_at)}</span>}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
