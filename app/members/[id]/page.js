'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import RankBadge from '../../../components/RankBadge';
import Avatar from '../../../components/Avatar';

export default function MemberPage() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [records, setRecords] = useState([]);
  const [videos, setVideos] = useState([]);
  const [songs, setSongs] = useState([]);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, points, role, organization, province, bio, avatar_url')
      .eq('id', id).single().then(({ data }) => setP(data));
    supabase.from('archive_records').select('id, what_text, when_text').eq('approved', true)
      .eq('submitted_by', id).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setRecords(data ?? []));
    supabase.from('song_videos').select('id, song_id, songs(name_th)').eq('approved', true)
      .eq('submitted_by', id).limit(30).then(({ data }) => setVideos(data ?? []));
    supabase.from('songs').select('id, name_th').eq('contributed_by', id).limit(30)
      .then(({ data }) => setSongs(data ?? []));
  }, [id]);

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
                <span className="song-id" style={{marginRight:'8px'}}>{s.id}</span>{s.name_th}</div>
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
                {r.what_text} <span style={{color:'var(--muted)',fontSize:'0.74rem'}}>· {r.when_text}</span></div>
            </Link>
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎬 วิดีโอที่เพิ่ม ({videos.length})</div>
          {videos.map(v => (
            <Link key={v.id} href={`/songs/${v.song_id}`}>
              <div style={{padding:'6px 0',cursor:'pointer',fontSize:'0.86rem'}}>{v.songs?.name_th}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
