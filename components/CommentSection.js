'use client';
import { useEffect, useState } from 'react';
import { fmtDT } from '../lib/fmtdate';
import { supabase } from '../lib/supabase';
import { shrinkImage } from '../lib/imgresize';
import { useMe } from './Gate';
import RankBadge from './RankBadge';
import Avatar from './Avatar';
import Link from 'next/link';

export default function CommentSection({ targetType, targetId, canPost = true }) {
  const { user, isAdmin } = useMe();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [imgFile, setImgFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [targetType, targetId]);

  // อ่านความคิดเห็นแล้วค่อยดึงโปรไฟล์แยก
  // (ของเดิมใช้ select('*, profiles(...)') ซึ่งต้องมี foreign key comments.user_id → profiles.id
  //  ถ้าไม่มี PostgREST ตอบ 400 ทั้งก้อน → ความคิดเห็นหายหมดโดยไม่มีข้อความบอก)
  async function load() {
    setLoading(true); setLoadErr('');
    const { data, error } = await supabase.from('comments')
      .select('*')
      .eq('target_type', targetType).eq('target_id', String(targetId))
      .order('created_at', { ascending: false }).limit(200);
    if (error) { setLoadErr(error.message); setComments([]); setLoading(false); return; }

    const rows = data ?? [];
    const ids = [...new Set(rows.map(c => c.user_id).filter(Boolean))];
    const byId = {};
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles')
        .select('id, display_name, points, role, avatar_url').in('id', ids);
      (ps ?? []).forEach(p => { byId[p.id] = p; });
    }
    setComments(rows.map(c => ({ ...c, profiles: byId[c.user_id] ?? null })));
    setLoading(false);
  }

  async function submit() {
    if (!user) { setMsg('⚠ เข้าสู่ระบบก่อนจึงจะแสดงความคิดเห็นได้'); return; }
    if (!body.trim() && !imgFile) { setMsg('⚠ พิมพ์ข้อความหรือแนบรูป'); return; }
    setBusy(true); setMsg('');
    let imagePath = null;
    if (imgFile) {
      setMsg('⏳ กำลังย่อรูป...');
      const file = await shrinkImage(imgFile, 1600, 0.85);
      if (file.size > 5 * 1024 * 1024) { setMsg('⚠ รูปใหญ่เกินไป ลองรูปอื่น'); setBusy(false); return; }
      setMsg('⏳ กำลังอัปโหลดรูป...');
      const path = `${targetType}/${targetId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('comment-images').upload(path, file);
      if (upErr) { setMsg('⚠ อัปโหลดรูปไม่สำเร็จ: ' + upErr.message); setBusy(false); return; }
      imagePath = path;
    }
    setMsg('⏳ กำลังส่ง...');
    const { data: inserted, error } = await supabase.from('comments').insert({
      target_type: targetType, target_id: String(targetId),
      body: body.trim() || null, image_path: imagePath, user_id: user.id,
    }).select().single();

    if (error) {
      // เดิมข้อความนี้ไม่เคยขึ้น เพราะโหลดใหม่แล้วเงียบไปเฉย ๆ
      setMsg('⚠ ส่งไม่สำเร็จ: ' + error.message);
      setBusy(false); return;
    }
    setBody(''); setImgFile(null); setMsg('✓ ส่งแล้ว'); setBusy(false);
    // แสดงทันทีโดยไม่ต้องรอโหลดใหม่ แล้วค่อย sync กับฐาน
    if (inserted) setComments(cs => [{ ...inserted, profiles: null }, ...cs]);
    load();
    setTimeout(() => setMsg(''), 2500);
  }

  async function remove(c) {
    if (!confirm('ลบความคิดเห็นนี้?')) return;
    const { error, count } = await supabase.from('comments')
      .delete({ count: 'exact' }).eq('id', c.id);
    if (error) { setMsg('⚠ ลบไม่สำเร็จ: ' + error.message); return; }
    if (count === 0) { setMsg('⚠ ลบไม่สำเร็จ — ไม่มีสิทธิ์ลบความคิดเห็นนี้'); return; }
    if (c.image_path) await supabase.storage.from('comment-images').remove([c.image_path]);
    setComments(cs => cs.filter(x => x.id !== c.id));
  }

  const fileInputKey = imgFile ? 'has' : 'empty';

  return (
    <div style={{marginTop:'1.6rem'}}>
      <div style={{fontSize:'0.95rem',fontWeight:600,marginBottom:'0.8rem'}}>
        💬 ความคิดเห็น ({comments.length})
      </div>

      {user && !canPost && (
        <div style={{fontSize:'0.78rem',color:'var(--muted)',marginBottom:'0.8rem'}}>
          บัญชีของคุณยังไม่ได้รับสิทธิ์แสดงความคิดเห็นในหน้านี้
        </div>
      )}
      {user && canPost ? (
        <div className="card" style={{padding:'0.9rem'}}>
          <textarea className="form-input" rows="2" value={body}
            onChange={e => setBody(e.target.value)} placeholder="แสดงความคิดเห็น แบ่งปันความรู้ ความทรงจำ..."
            style={{resize:'vertical',marginBottom:'0.6rem'}} />
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            <input key={fileInputKey} type="file" accept="image/*"
              onChange={e => setImgFile(e.target.files[0] ?? null)}
              style={{fontSize:'0.75rem',color:'var(--muted)'}} />
            <button className="btn btn-jade btn-sm" disabled={busy} onClick={submit}>
              {busy ? '...' : 'ส่งความคิดเห็น'}
            </button>
          </div>
          {msg && <div style={{marginTop:'0.5rem',fontSize:'0.78rem',
            color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)'}}>{msg}</div>}
        </div>
      ) : !user ? (
        <div style={{fontSize:'0.8rem',color:'var(--muted)',marginBottom:'1rem'}}>
          <Link href="/login" style={{color:'var(--jade)'}}>เข้าสู่ระบบ</Link> เพื่อร่วมแสดงความคิดเห็น
        </div>
      ) : null}

      {loadErr && (
        <div style={{marginTop:'0.8rem',fontSize:'0.78rem',color:'var(--gold)',lineHeight:1.7}}>
          ⚠ โหลดความคิดเห็นไม่สำเร็จ
          <div style={{fontSize:'0.68rem',color:'var(--muted)',fontFamily:'monospace'}}>{loadErr}</div>
        </div>
      )}
      {!loading && !loadErr && comments.length === 0 && (
        <div style={{marginTop:'0.9rem',fontSize:'0.8rem',color:'var(--muted)'}}>
          ยังไม่มีความคิดเห็น — เป็นคนแรกได้เลย
        </div>
      )}

      {comments.map(c => {
        const imgUrl = c.image_path
          ? supabase.storage.from('comment-images').getPublicUrl(c.image_path).data.publicUrl : null;
        const canDelete = user && (user.id === c.user_id || isAdmin);
        return (
          <div key={c.id} className="card" style={{padding:'0.9rem',marginBottom:'0.6rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                <Link href={`/members/${c.user_id}`} style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <Avatar path={c.profiles?.avatar_url} name={c.profiles?.display_name} size={26} />
                  <span style={{fontWeight:600,fontSize:'0.84rem',cursor:'pointer'}}>{c.profiles?.display_name ?? 'สมาชิก'}</span>
                </Link>
                <RankBadge points={c.profiles?.points} />
                <span style={{fontSize:'0.68rem',color:'var(--muted)'}} title="วัน-เวลาที่โพสต์">
                  {fmtDT(c.created_at)}
                </span>
              </div>
              {canDelete && (
                <span onClick={() => remove(c)} style={{fontSize:'0.7rem',color:'var(--danger)',cursor:'pointer'}}>
                  {user.id === c.user_id ? 'ลบ' : 'ลบ (แอดมิน)'}
                </span>
              )}
            </div>
            {c.body && <div style={{fontSize:'0.86rem',lineHeight:1.7,marginTop:'0.4rem',whiteSpace:'pre-wrap'}}>{c.body}</div>}
            {imgUrl && (
              <a href={imgUrl} target="_blank" rel="noreferrer">
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
