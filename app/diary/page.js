'use client';
// app/diary/page.js — 📔 ไดอารี่ดนตรี: บันทึกส่วนตัวของสมาชิก (2026-08-25)
//   เห็นเฉพาะเจ้าของ · ไม่ต้องอนุมัติ · ไม่ได้ศักดินา · วันหนึ่งเลือกใส่ "แฟ้มผลงาน" (/portfolio) ได้
//   ?e=<id> เปิดแก้บันทึกนั้นทันที (ลิงก์จากหน้าแฟ้ม)
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { shrinkImage } from '../../lib/imgresize';
import { diaryImageUrl, thaiDate, thaiMonth, todayISO, diaryStreak } from '../../lib/portfolio';

const MAX_IMAGES = 6;

export default function DiaryPage() {
  return <Suspense fallback={<main className="container">กำลังโหลด...</main>}><Diary /></Suspense>;
}

function Diary() {
  const sp = useSearchParams();
  const [user, setUser] = useState(undefined);       // undefined = ยังไม่รู้
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  // ฟอร์ม
  const [editId, setEditId] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState([]);           // path ที่อัปโหลดแล้ว
  const [pending, setPending] = useState([]);         // File ที่รออัปโหลด
  const formRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null)); }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('diary_entries').select('*').order('entry_date', { ascending: false }).order('id', { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  // ?e=id → เปิดแก้
  useEffect(() => {
    const e = sp.get('e');
    if (!e || !entries.length) return;
    const it = entries.find(x => String(x.id) === e);
    if (it) startEdit(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, sp]);

  function resetForm() { setEditId(null); setDate(todayISO()); setTitle(''); setBody(''); setImages([]); setPending([]); }
  function startEdit(it) {
    setEditId(it.id); setDate(it.entry_date); setTitle(it.title ?? ''); setBody(it.body ?? '');
    setImages(Array.isArray(it.images) ? it.images : []); setPending([]);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => bodyRef.current?.focus(), 300);
  }
  function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = Math.max(120, el.scrollHeight) + 'px'; }

  async function save() {
    if (!body.trim() && !title.trim() && !pending.length && !images.length) { setMsg('⚠ เขียนอะไรสักหน่อยก่อนบันทึก'); return; }
    setBusy(true); setMsg('');
    // อัปโหลดรูปที่รออยู่ (ย่อก่อน) — โฟลเดอร์ = user id (policy ของ bucket)
    const paths = [...images];
    const skipped = [];
    for (let i = 0; i < pending.length && paths.length < MAX_IMAGES; i++) {
      setMsg(`กำลังอัปโหลดรูป ${i + 1}/${pending.length}...`);
      const file = await shrinkImage(pending[i], 1800, 0.85);
      if (file.size > 5 * 1024 * 1024) { skipped.push(pending[i].name); continue; }
      const path = `${user.id}/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from('diary-images').upload(path, file);
      if (error) { skipped.push(pending[i].name); continue; }
      paths.push(path);
    }
    const row = { entry_date: date || todayISO(), title: title.trim() || null, body, images: paths };
    // ใส่ user_id/updated_at เอง ไม่พึ่ง default ในฐานอย่างเดียว (ดูเหตุผลใน app/portfolio/page.js)
    const { data: au } = await supabase.auth.getUser();
    const stamped = { ...row, updated_at: new Date().toISOString() };
    const { error } = editId
      ? await supabase.from('diary_entries').update(stamped).eq('id', editId)
      : await supabase.from('diary_entries').insert({ ...stamped, user_id: au?.user?.id ?? null });
    setBusy(false);
    if (error) { setMsg('⚠ บันทึกไม่สำเร็จ: ' + error.message); return; }
    setMsg((editId ? '✓ แก้ไขแล้ว' : '✓ บันทึกแล้ว') + (skipped.length ? ` · รูปที่ข้าม: ${skipped.join(', ')}` : ''));
    resetForm(); load();
    setTimeout(() => setMsg(''), 4000);
  }
  async function del(it) {
    if (!confirm(`ลบบันทึก "${it.title || thaiDate(it.entry_date)}" ?`)) return;
    setBusy(true);
    if (Array.isArray(it.images) && it.images.length) await supabase.storage.from('diary-images').remove(it.images).catch(() => {});
    const { error } = await supabase.from('diary_entries').delete().eq('id', it.id);
    setBusy(false);
    if (error) { setMsg('⚠ ลบไม่สำเร็จ: ' + error.message); return; }
    if (editId === it.id) resetForm();
    load();
  }
  function removeImage(p) { setImages(images.filter(x => x !== p)); }
  function addFiles(files) {
    const room = MAX_IMAGES - images.length - pending.length;
    const picked = Array.from(files ?? []).filter(f => /^image\//.test(f.type)).slice(0, Math.max(0, room));
    if (Array.from(files ?? []).length > picked.length) setMsg(`⚠ ใส่รูปได้สูงสุด ${MAX_IMAGES} รูปต่อบันทึก`);
    setPending([...pending, ...picked]);
  }

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return entries;
    return entries.filter(e => (e.title ?? '').toLowerCase().includes(k) || (e.body ?? '').toLowerCase().includes(k));
  }, [entries, q]);
  const byMonth = useMemo(() => {
    const g = [];
    filtered.forEach(e => {
      const key = String(e.entry_date).slice(0, 7);
      let m = g[g.length - 1];
      if (!m || m.key !== key) { m = { key, label: thaiMonth(e.entry_date), items: [] }; g.push(m); }
      m.items.push(e);
    });
    return g;
  }, [filtered]);
  const streak = useMemo(() => diaryStreak(entries.map(e => e.entry_date)), [entries]);

  if (user === undefined) return <main className="container">กำลังโหลด...</main>;
  if (!user) return (
    <main className="container" style={{ maxWidth: 500 }}>
      <div className="lock-box">
        <div style={{ fontSize: '2rem' }}>📔</div>
        <div style={{ margin: '0.6rem 0 1rem' }}>ไดอารี่ดนตรีเป็นพื้นที่ส่วนตัวของสมาชิก — เข้าสู่ระบบเพื่อเริ่มเขียน</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ / สมัคร</button></Link>
      </div>
    </main>
  );

  return (
    <main className="container" style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>📔 ไดอารี่ดนตรี</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 2 }}>
            บันทึกส่วนตัว เห็นเฉพาะคุณ · เขียนอะไรก็ได้ที่เกี่ยวกับดนตรี — ซ้อม เรียน งาน ความคิด · วันหนึ่งเลือกมาทำเป็นแฟ้มผลงานได้
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ fontSize: '0.74rem', color: 'var(--muted)', textAlign: 'right' }}>
          <div><b style={{ color: 'var(--gold)' }}>{entries.length}</b> บันทึก{streak > 1 && <> · 🔥 เขียนต่อเนื่อง <b style={{ color: 'var(--gold)' }}>{streak}</b> วัน</>}</div>
          <Link href="/portfolio" style={{ color: 'var(--gold2)' }}>📁 แฟ้มผลงาน ↗</Link>
        </div>
      </div>

      {/* ฟอร์มเขียน */}
      <div ref={formRef} className="card" style={{ borderColor: editId ? 'rgba(201,168,76,0.6)' : undefined }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{editId ? '✏️ แก้บันทึก' : '✍️ เขียนบันทึกใหม่'}</span>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
          <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{thaiDate(date, { long: true, weekday: true })}</span>
          <span style={{ flex: 1 }} />
          {editId && <button className="btn btn-outline btn-sm" onClick={resetForm}>ยกเลิกแก้</button>}
        </div>
        <input className="form-input" placeholder="หัวเรื่อง (ไม่บังคับ) เช่น ซ้อมเพลงสาธุการกับครู" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
        <textarea ref={bodyRef} className="form-input" placeholder="วันนี้..." value={body}
          onChange={e => { setBody(e.target.value); autoGrow(e.target); }} onFocus={e => autoGrow(e.target)}
          style={{ width: '100%', minHeight: 120, lineHeight: 1.8, resize: 'vertical' }} />
        {(images.length > 0 || pending.length > 0) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {images.map(p => (
              <div key={p} style={{ position: 'relative' }}>
                <img src={diaryImageUrl(p)} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                <button onClick={() => { if (confirm('เอารูปนี้ออกจากบันทึก?')) removeImage(p); }} title="เอารูปออก" style={{ position: 'absolute', top: -8, right: -8, width: 30, height: 30, borderRadius: 15, border: '2px solid var(--navy2)', background: 'var(--danger, #c0392b)', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
            {pending.map((f, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={URL.createObjectURL(f)} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 6, border: '1px dashed var(--gold)', opacity: 0.85 }} />
                <button onClick={() => setPending(pending.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -8, right: -8, width: 30, height: 30, borderRadius: 15, border: '2px solid var(--navy2)', background: 'var(--danger, #c0392b)', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
            📷 ใส่รูป <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{images.length + pending.length}/{MAX_IMAGES} รูป · ย่ออัตโนมัติ</span>
          <span style={{ flex: 1 }} />
          {msg && <span style={{ fontSize: '0.76rem', color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)' }}>{msg}</span>}
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? '⏳' : editId ? '💾 บันทึกการแก้' : '💾 บันทึก'}</button>
        </div>
      </div>

      {/* รายการ */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0 6px' }}>
        <input className="form-input" placeholder="🔍 ค้นในไดอารี่" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, maxWidth: 320 }} />
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{filtered.length} รายการ</span>
      </div>
      {loading ? <div style={{ color: 'var(--muted)' }}>กำลังโหลด...</div>
        : !entries.length ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.84rem', lineHeight: 1.9 }}>
            ยังไม่มีบันทึก — เริ่มจากวันนี้ก็ได้ เขียนสั้น ๆ ว่าซ้อมอะไร เรียนอะไร ฟังอะไร<br />
            พอสะสมไปเรื่อย ๆ จะเลือกบันทึกที่ภูมิใจไปทำเป็น <Link href="/portfolio" style={{ color: 'var(--gold2)' }}>แฟ้มผลงาน</Link> สวย ๆ ได้
          </div>
        ) : byMonth.map(m => (
          <div key={m.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gold)', margin: '8px 0 6px', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>{m.label}</div>
            {m.items.map(e => <Entry key={e.id} e={e} onEdit={() => startEdit(e)} onDel={() => del(e)} busy={busy} />)}
          </div>
        ))}
    </main>
  );
}

function Entry({ e, onEdit, onDel, busy }) {
  const [open, setOpen] = useState(false);
  const bodyText = e.body ?? '';
  const long = bodyText.length > 320;
  const shown = open || !long ? bodyText : bodyText.slice(0, 320) + '…';
  const imgs = Array.isArray(e.images) ? e.images : [];
  return (
    <div className="card diary-entry" style={{ padding: '0.7rem 0.9rem', marginBottom: 8, display: 'flex', gap: 12 }}>
      <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1, color: 'var(--gold)' }}>{new Date(e.entry_date + 'T00:00:00').getDate()}</div>
        <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>{thaiDate(e.entry_date).split(' ').slice(1).join(' ')}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {e.title && <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 2 }}>{e.title}</div>}
        <div style={{ fontSize: '0.84rem', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{shown}
          {long && <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', color: 'var(--gold2)', cursor: 'pointer', fontSize: '0.76rem', marginLeft: 6 }}>{open ? 'ย่อ' : 'อ่านต่อ'}</button>}
        </div>
        {imgs.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {imgs.map(p => <a key={p} href={diaryImageUrl(p)} target="_blank" rel="noreferrer"><img src={diaryImageUrl(p)} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} /></a>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
          <span style={{ fontSize: '0.64rem', color: 'var(--muted)', flex: 1 }}>{e.updated_at && e.updated_at !== e.created_at ? 'แก้ไขล่าสุด ' + thaiDate(e.updated_at) : ''}</span>
          <button className="btn btn-outline btn-sm" onClick={onEdit} disabled={busy}>✏️ แก้</button>
          <button className="btn btn-danger btn-sm btn-icon" onClick={onDel} disabled={busy}>🗑</button>
        </div>
      </div>
    </div>
  );
}
