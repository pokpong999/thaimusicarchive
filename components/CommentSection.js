'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import RankBadge from './RankBadge';
import Avatar from './Avatar';
import Link from 'next/link';

export default function CommentSection({ targetType, targetId }) {
  const [user, setUser] = useState(null);
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [imgFile, setImgFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    load();
  }, [targetType, targetId]);

  async function load() {
    const { data } = await supabase.from('comments')
      .select('*, profiles(display_name, points, role, avatar_url)')
      .eq('target_type', targetType).eq('target_id', String(targetId))
      .order('created_at', { ascending: false }).limit(100);
    setComments(data ?? []);
  }

  async function submit() {
    if (!body.trim() && !imgFile) { setMsg('⚠ พิมพ์ข้อความหรือแนบรูป'); return; }
    setBusy(true);
    let imagePath = null;
    if (imgFile) {
      if (imgFile.size > 5 * 1024 * 1024) { setMsg('⚠ รูปใหญ่เกิน 5MB'); setBusy(false); return; }
      const path = `${targetType}/${targetId}/${Date.now()}_${imgFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('comment-images').upload(path, imgFile);
      if (!upErr) imagePath = path;
    }
    const { error } = await supabase.from('comments').insert({
      target_type: targetType, target_id: String(targetId),
      body: body.trim() || null, image_path: imagePath, user_id: user.id,
    });
    if (error) { setMsg('⚠ ' + error.message); setBusy(false); return; }
    setBody(''); setImgFile(null); setMsg(''); setBusy(false);
    load();
  }

  async function remove(id) {
    if (!confirm('ลบความคิดเห็นนี้?')) return;
    await supabase.from('comments').delete().eq('id', id);
    load();
  }

  return (
    <div style={{marginTop:'1.6rem'}}>
      <div style={{fontSize:'0.95rem',fontWeight:600,marginBottom:'0.8rem'}}>
        💬 ความคิดเห็น ({comments.length})
      </div>
      {user ? (
        <div className="card" style={{padding:'0.9rem'}}>
          <textarea className="form-input" rows="2" value={body}
            onChange={e => setBody(e.target.value)} placeholder="แสดงความคิดเห็น แบ่งปันความรู้ ความทรงจำ..."
            style={{resize:'vertical',marginBottom:'0.6rem'}} />
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            <input type="file" accept="image/*" onChange={e => setImgFile(e.target.files[0])}
              style={{fontSize:'0.75rem',color:'var(--muted)'}} />
            <button className="btn btn-jade btn-sm" disabled={busy} onClick={submit}>
              {busy ? '...' : 'ส่งความคิดเห็น'}
            </button>
          </div>
          {msg && <div style={{marginTop:'0.5rem',fontSize:'0.78rem',color:'var(--jade)'}}>{msg}</div>}
        </div>
      ) : (
        <div style={{fontSize:'0.8rem',color:'var(--muted)',marginBottom:'1rem'}}>
          เข้าสู่ระบบเพื่อร่วมแสดงความคิดเห็น
        </div>
      )}
      {comments.map(c => {
        const imgUrl = c.image_path
          ? supabase.storage.from('comment-images').getPublicUrl(c.image_path).data.publicUrl : null;
        return (
          <div key={c.id} className="card" style={{padding:'0.9rem',marginBottom:'0.6rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                <Link href={`/members/${c.user_id}`} style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <Avatar path={c.profiles?.avatar_url} name={c.profiles?.display_name} size={26} />
                  <span style={{fontWeight:600,fontSize:'0.84rem',cursor:'pointer'}}>{c.profiles?.display_name ?? 'สมาชิก'}</span>
                </Link>
                <RankBadge points={c.profiles?.points} />
                <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>
                  {new Date(c.created_at).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' })}
                </span>
              </div>
              {user && (user.id === c.user_id) && (
                <span onClick={() => remove(c.id)} style={{fontSize:'0.7rem',color:'var(--danger)',cursor:'pointer'}}>ลบ</span>
              )}
            </div>
            {c.body && <div style={{fontSize:'0.86rem',lineHeight:1.7,marginTop:'0.4rem',whiteSpace:'pre-wrap'}}>{c.body}</div>}
            {imgUrl && (
              <a href={imgUrl} target="_blank">
                <img src={imgUrl} alt="" style={{maxWidth:'260px',maxHeight:'200px',borderRadius:'6px',
                  border:'1px solid var(--border)',marginTop:'0.6rem',objectFit:'cover'}} />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
