'use client';
// app/admin/samples/page.js — คลังเสียงเครื่องดนตรีจริง (ผู้ดูแลเท่านั้น)
//
// หลักการ: โฟลเดอร์ = เครื่องดนตรี · ชื่อไฟล์ = เสียง
// เพิ่มเครื่องใหม่ได้เองโดยไม่ต้องแก้โค้ด แค่ตั้งชื่อโฟลเดอร์แล้วอัปไฟล์
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useMe } from '../../../components/Gate';
import { INSTRUMENT_SLUG, TOKEN_SLUG, RECOMMENDED } from '../../../lib/samplebank';

const BUCKET = 'instrument-samples';
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;
const THAI_OF_SLUG = Object.fromEntries(Object.entries(INSTRUMENT_SLUG).map(([th, sl]) => [sl, th]));
const THAI_OF_TOKEN = Object.fromEntries(Object.entries(TOKEN_SLUG).map(([th, sl]) => [sl, th]));

export default function SamplesAdmin() {
  const me = useMe();
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState({});      // slug → [{name,size}]
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [newFolder, setNewFolder] = useState('');

  const load = useCallback(async () => {
    const { data: top, error } = await supabase.storage.from(BUCKET).list('', { limit: 200 });
    if (error) { setMsg('⚠ อ่านคลังไม่ได้: ' + error.message); return; }
    // โฟลเดอร์ใน Supabase Storage = รายการที่ไม่มี metadata
    const slugs = (top ?? []).filter(x => !x.metadata).map(x => x.name);
    const known = Object.values(INSTRUMENT_SLUG);
    const all = [...new Set([...known, ...slugs])];
    const map = {};
    await Promise.all(all.map(async slug => {
      const { data } = await supabase.storage.from(BUCKET).list(slug, { limit: 200 });
      map[slug] = (data ?? []).filter(f => AUDIO_EXT.test(f.name));
    }));
    setFolders(all); setFiles(map);
  }, []);

  useEffect(() => { if (me.isAdmin) load(); }, [me.isAdmin, load]);

  async function upload(slug, fileList) {
    const picked = Array.from(fileList ?? []);
    if (!picked.length) return;
    setBusy(true);
    for (const f of picked) {
      const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
      const base = f.name.replace(AUDIO_EXT, '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (!base) { setMsg('⚠ ชื่อไฟล์ต้องเป็นอักษรอังกฤษ: ' + f.name); continue; }
      setMsg(`⏳ กำลังอัป ${base}.${ext} ...`);
      const { error } = await supabase.storage.from(BUCKET)
        .upload(`${slug}/${base}.${ext}`, f, { upsert: true, contentType: f.type || 'audio/mpeg' });
      if (error) { setMsg('⚠ ' + f.name + ': ' + error.message); setBusy(false); return; }
    }
    await load(); setBusy(false); setMsg('✓ อัปโหลดแล้ว');
    setTimeout(() => setMsg(''), 3000);
  }

  async function removeFile(slug, name) {
    if (!confirm(`ลบ ${slug}/${name} ?`)) return;
    setBusy(true);
    const { error } = await supabase.storage.from(BUCKET).remove([`${slug}/${name}`]);
    setBusy(false);
    if (error) { setMsg('⚠ ลบไม่สำเร็จ: ' + error.message); return; }
    await load();
  }

  function preview(slug, name) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${slug}/${name}`);
    new Audio(data.publicUrl).play().catch(() => setMsg('⚠ เล่นไม่ได้ — บัคเก็ตอาจยังไม่เป็นสาธารณะ'));
  }

  if (me.loading) return <main className="container" style={{paddingTop:'3rem',color:'var(--muted)'}}>กำลังโหลด...</main>;
  if (!me.isAdmin) return (
    <main className="container" style={{maxWidth:'520px',textAlign:'center',paddingTop:'4rem'}}>
      <div style={{fontSize:'2rem'}}>🔒</div>
      <div style={{margin:'0.8rem 0'}}>หน้านี้สำหรับผู้ดูแลเท่านั้น</div>
      <Link href="/"><button className="btn btn-outline btn-sm">← หน้าแรก</button></Link>
    </main>
  );

  return (
    <main className="container" style={{maxWidth:'860px'}}>
      <div className="section-title" style={{fontSize:'1.2rem'}}>🥁 คลังเสียงเครื่องดนตรี</div>
      <div className="section-subtitle">
        โฟลเดอร์ = เครื่องดนตรี · ชื่อไฟล์ = เสียง · อัปแล้วเว็บใช้ทันทีโดยไม่ต้องแก้โค้ด
      </div>

      <div className="card" style={{fontSize:'0.8rem',lineHeight:1.9,marginTop:'1rem'}}>
        <b>วิธีตั้งชื่อไฟล์</b><br/>
        ตั้งชื่อเป็นอักษรอังกฤษตามเสียงที่บันทึก แล้วอัปเข้าโฟลเดอร์ของเครื่องนั้น เช่น
        <span style={{fontFamily:'monospace',color:'var(--gold)'}}> taphon/theng.mp3</span> = ตะโพน เสียง "เท่ง"<br/>
        เสียงไหนยังไม่มีไฟล์ ระบบใช้เสียงสังเคราะห์แทนตัวนั้นโดยอัตโนมัติ — อัปทีละไฟล์ได้ ไม่ต้องครบ
      </div>

      {msg && <div style={{margin:'0.7rem 0',fontSize:'0.82rem',
        color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)'}}>{msg}</div>}

      {folders.map(slug => {
        const list = files[slug] ?? [];
        const have = list.map(f => f.name.replace(AUDIO_EXT, '').toLowerCase());
        const want = RECOMMENDED[slug] ?? [];
        const missing = want.filter(t => !have.includes(t));
        const thai = THAI_OF_SLUG[slug];
        return (
          <div key={slug} className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px',flexWrap:'wrap',
              cursor:'pointer'}} onClick={() => setOpen(open === slug ? null : slug)}>
              <div>
                <b style={{fontSize:'0.95rem'}}>{thai ?? slug}</b>
                <span style={{color:'var(--muted)',fontSize:'0.72rem',fontFamily:'monospace',marginLeft:'8px'}}>{slug}/</span>
              </div>
              <div style={{display:'flex',gap:'10px',alignItems:'center',fontSize:'0.76rem'}}>
                <span style={{color: list.length ? 'var(--jade)' : 'var(--muted)'}}>{list.length} ไฟล์</span>
                {want.length > 0 && (
                  <span style={{color: missing.length ? 'var(--gold)' : 'var(--jade)'}}>
                    {missing.length ? `ขาด ${missing.length}` : '✓ ครบชุดแนะนำ'}</span>
                )}
                <span style={{color:'var(--muted)'}}>{open === slug ? '▾' : '▸'}</span>
              </div>
            </div>

            {open === slug && (
              <div style={{marginTop:'0.8rem',borderTop:'1px solid var(--border)',paddingTop:'0.8rem'}}>
                {want.length > 0 && (
                  <div style={{fontSize:'0.76rem',marginBottom:'0.7rem',lineHeight:1.9}}>
                    <span style={{color:'var(--muted)'}}>ชุดแนะนำ: </span>
                    {want.map(t => (
                      <span key={t} style={{marginRight:'8px',
                        color: have.includes(t) ? 'var(--jade)' : 'var(--gold)'}}>
                        {have.includes(t) ? '✓' : '○'} {t}
                        <span style={{color:'var(--muted)',fontSize:'0.9em'}}> ({THAI_OF_TOKEN[t] ?? t})</span>
                      </span>
                    ))}
                  </div>
                )}
                {list.map(f => (
                  <div key={f.name} style={{display:'flex',gap:'8px',alignItems:'center',padding:'5px 0',
                    borderBottom:'1px solid rgba(42,63,92,0.3)',fontSize:'0.8rem'}}>
                    <span style={{flex:1,fontFamily:'monospace'}}>{f.name}</span>
                    <span style={{color:'var(--muted)',fontSize:'0.7rem'}}>
                      {Math.round((f.metadata?.size ?? 0) / 1024)} KB</span>
                    <button className="btn btn-outline btn-sm" onClick={() => preview(slug, f.name)}>▶ ฟัง</button>
                    <button className="btn btn-danger btn-sm" disabled={busy}
                      onClick={() => removeFile(slug, f.name)}>🗑</button>
                  </div>
                ))}
                <label className="btn btn-primary btn-sm" style={{marginTop:'0.8rem',cursor:'pointer',display:'inline-block'}}>
                  ＋ อัปไฟล์เสียงเข้า {slug}/
                  <input type="file" accept="audio/*" multiple hidden disabled={busy}
                    onChange={e => upload(slug, e.target.files)} />
                </label>
              </div>
            )}
          </div>
        );
      })}

      <div className="card">
        <div style={{fontWeight:600,fontSize:'0.88rem',marginBottom:'0.5rem'}}>เพิ่มเครื่องดนตรีใหม่</div>
        <div style={{fontSize:'0.76rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'0.6rem'}}>
          พิมพ์ชื่อโฟลเดอร์เป็นอักษรอังกฤษ เช่น <span style={{fontFamily:'monospace'}}>ranat_ek</span>
          {' '}แล้วอัปไฟล์เข้าไป — ระบบจะเห็นเองทันที
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <input className="form-input" style={{width:'220px'}} value={newFolder}
            onChange={e => setNewFolder(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            placeholder="ชื่อโฟลเดอร์ (อังกฤษ)" />
          <button className="btn btn-outline btn-sm" disabled={!newFolder}
            onClick={() => { if (!folders.includes(newFolder)) setFolders([...folders, newFolder]); setOpen(newFolder); setNewFolder(''); }}>
            เพิ่มในรายการ</button>
        </div>
      </div>

      <Link href="/admin"><button className="btn btn-outline btn-sm">← กลับหน้าผู้ดูแล</button></Link>
    </main>
  );
}
