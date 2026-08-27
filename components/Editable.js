'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { shrinkImage } from '../lib/imgresize';
import { useMe } from './Gate';

const Ctx = createContext({ map: {}, ready: false, reload: () => {} });

export function ContentProvider({ children }) {
  const [map, setMap] = useState({});
  const [ready, setReady] = useState(false);
  async function load() {
    const { data } = await supabase.from('site_content').select('*');
    const m = {}; (data ?? []).forEach(r => { m[r.key] = r; });
    setMap(m); setReady(true);
  }
  useEffect(() => {
    load();
    let ch = null;
    try {
      ch = supabase.channel('sc-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, load)
        .subscribe();
    } catch {}
    return () => { if (ch) supabase.removeChannel(ch); };
  }, []);
  return <Ctx.Provider value={{ map, ready, reload: load }}>{children}</Ctx.Provider>;
}

export function imgUrl(path) {
  if (!path) return null;
  return supabase.storage.from('site-images').getPublicUrl(path).data.publicUrl;
}

// ── ข้อความแก้ไขได้ ──
export function EText({ k, children, as: Tag = 'div', className, style, multiline = true }) {
  const { map, reload } = useContext(Ctx);
  const { isAdmin } = useMe();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const stored = map[k]?.text_value;
  const value = (stored ?? '').trim() ? stored : (typeof children === 'string' ? children : null);

  async function save() {
    setBusy(true);
    await supabase.from('site_content')
      .upsert({ key: k, text_value: draft, updated_at: new Date().toISOString() });
    await reload(); setBusy(false); setEditing(false);
  }
  async function reset() {
    setBusy(true);
    await supabase.from('site_content').upsert({ key: k, text_value: null });
    await reload(); setBusy(false); setEditing(false);
  }

  if (editing) return (
    <div style={{background:'var(--navy3)',border:'1px solid var(--gold)',borderRadius:'8px',padding:'0.7rem',margin:'0.3rem 0'}}>
      <div style={{fontSize:'0.66rem',color:'var(--muted)',marginBottom:'4px'}}>🔑 {k}</div>
      {multiline
        ? <textarea className="form-input" rows="4" value={draft} onChange={e => setDraft(e.target.value)} style={{resize:'vertical'}} />
        : <input className="form-input" value={draft} onChange={e => setDraft(e.target.value)} />}
      <div style={{display:'flex',gap:'6px',marginTop:'6px'}}>
        <button className="btn btn-jade btn-sm" disabled={busy} onClick={save}>✓ บันทึก</button>
        <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setEditing(false)}>ยกเลิก</button>
        <button className="btn btn-outline btn-sm" disabled={busy} onClick={reset}
          style={{marginLeft:'auto',fontSize:'0.68rem'}}>↺ คืนค่าเดิม</button>
      </div>
    </div>
  );

  return (
    <Tag className={className} style={{...style, position: isAdmin ? 'relative' : style?.position}}>
      {value !== null ? (typeof value === 'string'
        ? value.split('\n').map((ln, i) => <span key={i}>{i > 0 && <br/>}{ln}</span>)
        : value) : children}
      {isAdmin && (
        <button title={'แก้ไข: ' + k} onClick={e => { e.preventDefault(); e.stopPropagation();
            setDraft(stored ?? (typeof children === 'string' ? children : '')); setEditing(true); }}
          style={{marginLeft:'6px',verticalAlign:'middle',background:'rgba(201,168,76,0.15)',
            border:'1px solid var(--gold)',color:'var(--gold)',borderRadius:'6px',
            fontSize:'0.8rem',padding:'5px 9px',minHeight:'30px',cursor:'pointer',lineHeight:1.2}}>✏️</button>
      )}
    </Tag>
  );
}

// ── รูปภาพแก้ไขได้ (ว่างได้ — Admin เห็นปุ่มเพิ่มรูป) ──
export function EImage({ k, alt = '', style, className, height = 220 }) {
  const { map, reload } = useContext(Ctx);
  const { isAdmin } = useMe();
  const [busy, setBusy] = useState(false);
  const path = map[k]?.image_path;
  const url = imgUrl(path);

  async function upload(raw) {
    if (!raw) return;
    setBusy(true);
    const file = await shrinkImage(raw, 2000, 0.85);
    if (file.size > 5 * 1024 * 1024) { alert('รูปใหญ่เกินไป ลองรูปอื่น'); setBusy(false); return; }
    const ext = file.type === 'image/jpeg' ? 'jpg'
      : (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const p = `${k.replace(/[^\w.-]/g,'_')}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('site-images').upload(p, file);
    if (error) { alert('อัปโหลดไม่สำเร็จ: ' + error.message); setBusy(false); return; }
    if (path) await supabase.storage.from('site-images').remove([path]);
    await supabase.from('site_content').upsert({ key: k, image_path: p, updated_at: new Date().toISOString() });
    await reload(); setBusy(false);
  }
  async function removeImg() {
    setBusy(true);
    if (path) await supabase.storage.from('site-images').remove([path]);
    await supabase.from('site_content').upsert({ key: k, image_path: null });
    await reload(); setBusy(false);
  }

  if (!url && !isAdmin) return null;
  return (
    <div className={className} style={{position:'relative', ...style}}>
      {url
        ? <img src={url} alt={alt} style={{width:'100%',height:`${height}px`,objectFit:'cover',
            borderRadius:'10px',display:'block'}} />
        : <div style={{height:`${height}px`,border:'1px dashed var(--gold)',borderRadius:'10px',
            display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',
            fontSize:'0.8rem',background:'var(--navy3)'}}>ยังไม่มีรูป — {k}</div>}
      {isAdmin && (
        <div style={{position:'absolute',right:'8px',bottom:'8px',display:'flex',gap:'6px'}}>
          <label className="btn btn-sm" style={{cursor:'pointer',background:'rgba(15,27,45,0.9)',
            border:'1px solid var(--gold)',color:'var(--gold)',fontSize:'0.7rem'}}>
            {busy ? '⏳' : url ? '🖼 เปลี่ยนรูป' : '＋ เพิ่มรูป'}
            <input type="file" accept="image/*" style={{display:'none'}} disabled={busy}
              onChange={e => upload(e.target.files[0])} />
          </label>
          {url && <button className="btn btn-sm btn-icon" disabled={busy} onClick={removeImg}
            style={{background:'rgba(15,27,45,0.9)',border:'1px solid #C0574B',color:'#E08878',fontSize:'0.7rem'}}>🗑</button>}
        </div>
      )}
    </div>
  );
}
