'use client';
import { supabase } from '../lib/supabase';

export default function Avatar({ path, name, size = 32 }) {
  const url = path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;
  const initial = (name ?? 'ส').trim().charAt(0);
  return url ? (
    <img src={url} alt="" style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',
      border:'1.5px solid var(--gold)',flexShrink:0}} />
  ) : (
    <div style={{width:size,height:size,borderRadius:'50%',background:'var(--navy3)',
      border:'1.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:size*0.45,color:'var(--gold)',flexShrink:0,fontWeight:600}}>{initial}</div>
  );
}
