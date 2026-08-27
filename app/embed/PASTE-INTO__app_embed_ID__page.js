'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import NotationPlayer from '../../../components/NotationPlayer';
import { fetchMelody } from '../../../lib/songparts';

export default function EmbedPage() {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [verses, setVerses] = useState([]);

  useEffect(() => {
    supabase.from('songs').select('id, name_th').eq('id', id).single().then(({ data }) => setSong(data));
    fetchMelody(id, { approvedOnly: true, columns: 'id, verse_no, instrument, part_section, section, combined' })
      .then(({ rows }) => setVerses((rows ?? [])
        .filter(r => (r.instrument ?? 'ทำนองหลัก') === 'ทำนองหลัก').slice(0, 400)));
  }, [id]);

  return (
    <div style={{padding:'0.8rem'}}>
      <style jsx global>{`nav, footer, .footer { display:none !important; } body { background:var(--navy); }`}</style>
      {song && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.6rem'}}>
          <b style={{fontSize:'0.95rem'}}>{song.name_th}</b>
          <a href={`https://thaimusicarchive.com/songs/${id}`} target="_blank"
            style={{fontSize:'0.68rem',color:'var(--gold)'}}>หอจดหมายเหตุดนตรีไทย ↗</a>
        </div>
      )}
      <NotationPlayer verses={verses} />
    </div>
  );
}
