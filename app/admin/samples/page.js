'use client';
// app/admin/samples/page.js — คลังเสียงเครื่องดนตรี + ทะเบียนเครื่อง (ผู้ดูแลเท่านั้น)
//
//   สองส่วน
//   1) 🎵 เครื่องดำเนินทำนอง — ทะเบียนในตาราง instruments (ขิม ระนาด ฆ้อง จะเข้ …)
//      เพิ่มเครื่อง → อัปไฟล์เสียง → เครื่องนั้นโผล่ในตัวเลือก "เสียง" ของกระดานและเครื่องเล่นทันที
//      ไฟล์ตั้งชื่อได้ 2 แบบ: 01.mp3 ไล่จากเสียงต่ำสุด (index) หรือ d_mid.mp3 (note)
//      เสียงที่ยังไม่มีไฟล์ ระบบขยับระดับเสียงจากไฟล์ที่ใกล้ที่สุดให้เอง — อัปไม่ครบก็เล่นได้ทุกเสียง
//   2) 🥁 เครื่องกำกับจังหวะ — โฟลเดอร์ = เครื่อง · ชื่อไฟล์ = พยางค์ (ตะโพน กลองแขก ฉิ่ง …)
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useMe } from '../../../components/Gate';
import { INSTRUMENT_SLUG, TOKEN_SLUG, RECOMMENDED } from '../../../lib/samplebank';
import { loadInstruments, invalidateInstruments, fileChecklist, NOTES_TH, REG_NAME, noteLabel } from '../../../lib/instruments';
import { invalidateMelodyBank, stepOfFile } from '../../../lib/melodybank';
import { SYSTEMS, SYSTEM_KEYS } from '../../../lib/notation-systems';

const BUCKET = 'instrument-samples';
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;
const THAI_OF_SLUG = Object.fromEntries(Object.entries(INSTRUMENT_SLUG).map(([th, sl]) => [sl, th]));
const THAI_OF_TOKEN = Object.fromEntries(Object.entries(TOKEN_SLUG).map(([th, sl]) => [sl, th]));
const REGS = [['-2', 'ต่ำมาก'], ['-1', 'ต่ำ'], ['0', 'กลาง'], ['1', 'สูง'], ['2', 'สูงมาก']];
const blankInst = () => ({ slug: '', name_th: '', kind: 'melody', naming: 'index', low_note: 'ด', low_reg: 0, note_count: 21, transpose: 0, system: 'melody1', sort: 100, enabled: true, note: '' });

export default function SamplesAdmin() {
  const me = useMe();
  const [files, setFiles] = useState({});      // slug → [{name, metadata}]
  const [percFolders, setPercFolders] = useState([]);
  const [insts, setInsts] = useState([]);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);      // ทะเบียนที่กำลังแก้ {..inst}
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [newFolder, setNewFolder] = useState('');

  const load = useCallback(async () => {
    const list = await loadInstruments({ force: true });
    setInsts(list);
    const { data: top, error } = await supabase.storage.from(BUCKET).list('', { limit: 300 });
    if (error) { setMsg('⚠ อ่านคลังไม่ได้: ' + error.message); return; }
    const slugs = (top ?? []).filter(x => !x.metadata).map(x => x.name);
    const percKnown = Object.values(INSTRUMENT_SLUG);
    const melodySlugs = new Set(list.map(i => i.slug));
    const all = [...new Set([...percKnown, ...slugs, ...list.map(i => i.slug)])];
    const map = {};
    await Promise.all(all.map(async slug => {
      const { data } = await supabase.storage.from(BUCKET).list(slug, { limit: 300 });
      map[slug] = (data ?? []).filter(f => AUDIO_EXT.test(f.name));
    }));
    setFiles(map);
    setPercFolders(all.filter(s => !melodySlugs.has(s)));
  }, []);
  useEffect(() => { if (me.isAdmin) load(); }, [me.isAdmin, load]);

  async function upload(slug, fileList) {
    const picked = Array.from(fileList ?? []);
    if (!picked.length) return;
    setBusy(true);
    for (const f of picked) {
      const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
      const base = f.name.replace(AUDIO_EXT, '').trim().toLowerCase().replace(/[^a-z0-9_ก-๙ํฺ-]/g, '');
      if (!base) { setMsg('⚠ ชื่อไฟล์ใช้ไม่ได้: ' + f.name); continue; }
      setMsg(`⏳ กำลังอัป ${base}.${ext} ...`);
      const { error } = await supabase.storage.from(BUCKET)
        .upload(`${slug}/${base}.${ext}`, f, { upsert: true, contentType: f.type || 'audio/mpeg' });
      if (error) { setMsg('⚠ ' + f.name + ': ' + error.message); setBusy(false); return; }
    }
    invalidateMelodyBank(slug);
    await load(); setBusy(false); setMsg('✓ อัปโหลดแล้ว — เว็บใช้เสียงใหม่ทันที');
    setTimeout(() => setMsg(''), 4000);
  }
  async function removeFile(slug, name) {
    if (!confirm(`ลบ ${slug}/${name} ?`)) return;
    setBusy(true);
    const { error } = await supabase.storage.from(BUCKET).remove([`${slug}/${name}`]);
    setBusy(false);
    if (error) { setMsg('⚠ ลบไม่สำเร็จ: ' + error.message); return; }
    invalidateMelodyBank(slug);
    await load();
  }
  function preview(slug, name) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${slug}/${name}`);
    new Audio(data.publicUrl).play().catch(() => setMsg('⚠ เล่นไม่ได้ — บัคเก็ตอาจยังไม่เป็นสาธารณะ'));
  }
  async function saveInst(row, isNew) {
    if (!row.slug || !row.name_th) { setMsg('⚠ ใส่ชื่อเครื่องและชื่อโฟลเดอร์ให้ครบ'); return; }
    setBusy(true);
    const payload = { ...row, low_reg: +row.low_reg, note_count: +row.note_count, transpose: +row.transpose, sort: +row.sort };
    delete payload.created_at; delete payload.updated_at;
    const { error } = isNew
      ? await supabase.from('instruments').insert(payload)
      : await supabase.from('instruments').update(payload).eq('slug', row.slug);
    setBusy(false);
    if (error) { setMsg('⚠ บันทึกไม่สำเร็จ: ' + (error.message.includes('does not exist') ? 'ยังไม่ได้รัน sql/15_instruments.sql' : error.message)); return; }
    invalidateInstruments(); invalidateMelodyBank(row.slug);
    setEdit(null); setAdding(false); setMsg('✓ บันทึกทะเบียนแล้ว'); await load();
    setTimeout(() => setMsg(''), 4000);
  }
  async function delInst(slug) {
    if (!confirm(`เอา ${slug} ออกจากทะเบียน? (ไฟล์เสียงยังอยู่ในคลัง)`)) return;
    const { error } = await supabase.from('instruments').delete().eq('slug', slug);
    if (error) { setMsg('⚠ ' + error.message); return; }
    invalidateInstruments(); await load();
  }

  if (me.loading) return <main className="container" style={{ paddingTop: '3rem', color: 'var(--muted)' }}>กำลังโหลด...</main>;
  if (!me.isAdmin) return (
    <main className="container" style={{ maxWidth: '520px', textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ fontSize: '2rem' }}>🔒</div>
      <div style={{ margin: '0.8rem 0' }}>หน้านี้สำหรับผู้ดูแลเท่านั้น</div>
      <Link href="/"><button className="btn btn-outline btn-sm">← หน้าแรก</button></Link>
    </main>
  );

  const InstForm = ({ row, isNew }) => {
    const [f, setF] = useState(row);
    const set = p => setF(x => ({ ...x, ...p }));
    const chk = useMemo(() => fileChecklist(f), [f]);
    return (
      <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.7rem', paddingTop: '0.7rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem' }}>
          <label>ชื่อเครื่อง <input className="form-input" style={{ width: 150 }} value={f.name_th} onChange={e => set({ name_th: e.target.value })} /></label>
          <label>โฟลเดอร์ <input className="form-input" style={{ width: 130, fontFamily: 'monospace' }} value={f.slug} disabled={!isNew}
            onChange={e => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} placeholder="khim" /></label>
          <label>ชนิด <select className="filter-select" value={f.kind} onChange={e => set({ kind: e.target.value })}>
            <option value="melody">ดำเนินทำนอง</option><option value="perc">กำกับจังหวะ</option></select></label>
        </div>
        {f.kind === 'melody' && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', marginTop: 6 }}>
              <label>ชื่อไฟล์ <select className="filter-select" value={f.naming} onChange={e => set({ naming: e.target.value })}>
                <option value="index">01.mp3 ไล่จากต่ำสุด</option><option value="note">d_mid.mp3 (ชื่อโน้ต)</option></select></label>
              <label>ไฟล์ 01 = <select className="filter-select" value={f.low_note} onChange={e => set({ low_note: e.target.value })}>
                {NOTES_TH.map(n => <option key={n}>{n}</option>)}</select></label>
              <select className="filter-select" value={String(f.low_reg)} onChange={e => set({ low_reg: e.target.value })}>
                {REGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <label>จำนวนเสียง <input type="number" className="form-input" style={{ width: 70 }} min={1} max={60} value={f.note_count} onChange={e => set({ note_count: e.target.value })} /></label>
              <label title="เลื่อนระดับเสียงทั้งเครื่องกี่ขั้น เวลาเล่นเทียบกับโน้ตที่เขียน">เทียบเสียง <input type="number" className="form-input" style={{ width: 60 }} min={-14} max={14} value={f.transpose} onChange={e => set({ transpose: e.target.value })} /> ขั้น</label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', marginTop: 6 }}>
              <label>ระบบบันทึกที่แนะนำ <select className="filter-select" value={f.system} onChange={e => set({ system: e.target.value })}>
                {SYSTEM_KEYS.map(k => <option key={k} value={k}>{SYSTEMS[k].short}</option>)}</select></label>
              <label>ลำดับ <input type="number" className="form-input" style={{ width: 60 }} value={f.sort} onChange={e => set({ sort: e.target.value })} /></label>
              <label><input type="checkbox" checked={f.enabled !== false} onChange={e => set({ enabled: e.target.checked })} /> เปิดใช้</label>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.8 }}>
              ไฟล์ที่ควรมี: {chk.slice(0, 6).map(c => `${c.name} = ${c.note}`).join(' · ')}
              {chk.length > 6 && <> … ถึง {chk[chk.length - 1].name} = {chk[chk.length - 1].note}</>}
            </div>
          </>
        )}
        <input className="form-input" style={{ width: '100%', marginTop: 6, fontSize: '0.78rem' }} placeholder="หมายเหตุ (ไม่บังคับ)" value={f.note ?? ''} onChange={e => set({ note: e.target.value })} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveInst(f, isNew)}>💾 บันทึกทะเบียน</button>
          <button className="btn btn-outline btn-sm" onClick={() => { setEdit(null); setAdding(false); }}>ยกเลิก</button>
          {!isNew && <button className="btn btn-danger btn-sm" onClick={() => delInst(f.slug)}>🗑 เอาออกจากทะเบียน</button>}
        </div>
      </div>
    );
  };

  return (
    <main className="container" style={{ maxWidth: '900px' }}>
      <div className="section-title" style={{ fontSize: '1.2rem' }}>🎼 คลังเสียงเครื่องดนตรี</div>
      <div className="section-subtitle">
        เพิ่มเครื่อง → อัปไฟล์เสียง → เลือกใช้ในกระดานโน้ตและเครื่องเล่นได้ทันที (ไม่ต้องแก้โค้ด)
      </div>
      {msg && <div style={{ margin: '0.7rem 0', fontSize: '0.82rem', color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)' }}>{msg}</div>}

      <div className="card" style={{ fontSize: '0.8rem', lineHeight: 1.9 }}>
        <b>เสียงไม่ครบก็ใช้ได้</b> — เสียงไหนยังไม่มีไฟล์ ระบบจะขยับระดับเสียงจากไฟล์ที่ใกล้ที่สุดให้อัตโนมัติ
        (บันไดเสียงไทย 7 เสียงเท่ากัน) ยิ่งอัปครบยิ่งเหมือนเครื่องจริง · ไฟล์ที่รับ: mp3 wav ogg m4a
      </div>

      <div className="section-title" style={{ fontSize: '1rem', marginTop: '1.2rem' }}>🎵 เครื่องดำเนินทำนอง</div>
      {!insts.length && <div className="card" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
        ยังไม่มีทะเบียนเครื่อง — ถ้าเพิ่งติดตั้ง ให้รัน <span style={{ fontFamily: 'monospace' }}>sql/15_instruments.sql</span> ใน Supabase ก่อน
      </div>}
      {insts.filter(i => (i.kind || 'melody') === 'melody').map(inst => {
        const list = files[inst.slug] ?? [];
        const mapped = list.map(f => stepOfFile(inst, f.name.replace(AUDIO_EXT, ''))).filter(x => x != null);
        const want = inst.note_count || 0;
        const chk = fileChecklist(inst);
        const haveSteps = new Set(mapped);
        return (
          <div key={inst.slug} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => setOpen(open === inst.slug ? null : inst.slug)}>
              <div>
                <b style={{ fontSize: '0.95rem' }}>{inst.name_th}</b>
                <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontFamily: 'monospace', marginLeft: 8 }}>{inst.slug}/</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.7rem', marginLeft: 8 }}>{SYSTEMS[inst.system]?.short ?? inst.system}</span>
                {inst.enabled === false && <span className="badge" style={{ marginLeft: 6 }}>ปิดอยู่</span>}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.76rem' }}>
                <span style={{ color: mapped.length ? 'var(--jade)' : 'var(--muted)' }}>{mapped.length}/{want} เสียง</span>
                {mapped.length > 0 && mapped.length < want && <span style={{ color: 'var(--gold)' }}>ที่ขาดขยับจากตัวใกล้สุด</span>}
                <span style={{ color: 'var(--muted)' }}>{open === inst.slug ? '▾' : '▸'}</span>
              </div>
            </div>
            {open === inst.slug && (
              <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
                <div style={{ fontSize: '0.74rem', lineHeight: 2, marginBottom: '0.6rem' }}>
                  <span style={{ color: 'var(--muted)' }}>ไฟล์ที่ควรมี ({inst.naming === 'note' ? 'ชื่อโน้ต' : 'เลขลำดับ'}): </span>
                  {chk.map(c => (
                    <span key={c.index} style={{ marginRight: 9, color: haveSteps.has(c.step) ? 'var(--jade)' : 'var(--muted)' }}>
                      {haveSteps.has(c.step) ? '✓' : '○'} <span style={{ fontFamily: 'monospace' }}>{c.name}</span>={c.note}
                    </span>
                  ))}
                </div>
                {list.map(f => {
                  const st = stepOfFile(inst, f.name.replace(AUDIO_EXT, ''));
                  return (
                    <div key={f.name} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(42,63,92,0.3)', fontSize: '0.8rem' }}>
                      <span style={{ flex: 1, fontFamily: 'monospace' }}>{f.name}</span>
                      <span style={{ color: st == null ? 'var(--gold)' : 'var(--jade)', fontSize: '0.75rem' }}>
                        {st == null ? '⚠ อ่านชื่อไม่ออก' : '= ' + noteLabel(NOTES_TH[((st % 7) + 7) % 7], Math.floor(st / 7))}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{Math.round((f.metadata?.size ?? 0) / 1024)} KB</span>
                      <button className="btn btn-outline btn-sm" onClick={() => preview(inst.slug, f.name)}>▶</button>
                      <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => removeFile(inst.slug, f.name)}>🗑</button>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: '0.8rem', flexWrap: 'wrap' }}>
                  <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                    ＋ อัปไฟล์เสียงเข้า {inst.slug}/
                    <input type="file" accept="audio/*" multiple hidden disabled={busy} onChange={e => { upload(inst.slug, e.target.files); e.target.value = ''; }} />
                  </label>
                  <button className="btn btn-outline btn-sm" onClick={() => setEdit(edit?.slug === inst.slug ? null : { ...inst })}>⚙ แก้ทะเบียน</button>
                </div>
                {edit?.slug === inst.slug && <InstForm row={edit} isNew={false} />}
              </div>
            )}
          </div>
        );
      })}

      <div className="card">
        {!adding
          ? <button className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setEdit(null); }}>＋ เพิ่มเครื่องดนตรีใหม่</button>
          : <InstForm row={blankInst()} isNew />}
      </div>

      <div className="section-title" style={{ fontSize: '1rem', marginTop: '1.4rem' }}>🥁 เครื่องกำกับจังหวะ (ชื่อไฟล์ = พยางค์)</div>
      {percFolders.map(slug => {
        const list = files[slug] ?? [];
        const have = list.map(f => f.name.replace(AUDIO_EXT, '').toLowerCase());
        const want = RECOMMENDED[slug] ?? [];
        const missing = want.filter(t => !have.includes(t));
        return (
          <div key={slug} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => setOpen(open === slug ? null : slug)}>
              <div>
                <b style={{ fontSize: '0.95rem' }}>{THAI_OF_SLUG[slug] ?? slug}</b>
                <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontFamily: 'monospace', marginLeft: 8 }}>{slug}/</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.76rem' }}>
                <span style={{ color: list.length ? 'var(--jade)' : 'var(--muted)' }}>{list.length} ไฟล์</span>
                {want.length > 0 && <span style={{ color: missing.length ? 'var(--gold)' : 'var(--jade)' }}>{missing.length ? `ขาด ${missing.length}` : '✓ ครบชุดแนะนำ'}</span>}
                <span style={{ color: 'var(--muted)' }}>{open === slug ? '▾' : '▸'}</span>
              </div>
            </div>
            {open === slug && (
              <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
                {want.length > 0 && (
                  <div style={{ fontSize: '0.76rem', marginBottom: '0.7rem', lineHeight: 1.9 }}>
                    <span style={{ color: 'var(--muted)' }}>ชุดแนะนำ: </span>
                    {want.map(t => (
                      <span key={t} style={{ marginRight: 8, color: have.includes(t) ? 'var(--jade)' : 'var(--gold)' }}>
                        {have.includes(t) ? '✓' : '○'} {t}<span style={{ color: 'var(--muted)', fontSize: '0.9em' }}> ({THAI_OF_TOKEN[t] ?? t})</span>
                      </span>
                    ))}
                  </div>
                )}
                {list.map(f => (
                  <div key={f.name} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(42,63,92,0.3)', fontSize: '0.8rem' }}>
                    <span style={{ flex: 1, fontFamily: 'monospace' }}>{f.name}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{Math.round((f.metadata?.size ?? 0) / 1024)} KB</span>
                    <button className="btn btn-outline btn-sm" onClick={() => preview(slug, f.name)}>▶ ฟัง</button>
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => removeFile(slug, f.name)}>🗑</button>
                  </div>
                ))}
                <label className="btn btn-primary btn-sm" style={{ marginTop: '0.8rem', cursor: 'pointer', display: 'inline-block' }}>
                  ＋ อัปไฟล์เสียงเข้า {slug}/
                  <input type="file" accept="audio/*" multiple hidden disabled={busy} onChange={e => { upload(slug, e.target.files); e.target.value = ''; }} />
                </label>
              </div>
            )}
          </div>
        );
      })}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>เพิ่มโฟลเดอร์เครื่องกำกับจังหวะ</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-input" style={{ width: 220 }} value={newFolder}
            onChange={e => setNewFolder(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="ชื่อโฟลเดอร์ (อังกฤษ)" />
          <button className="btn btn-outline btn-sm" disabled={!newFolder}
            onClick={() => { if (!percFolders.includes(newFolder)) setPercFolders([...percFolders, newFolder]); setOpen(newFolder); setNewFolder(''); }}>เพิ่มในรายการ</button>
        </div>
      </div>

      <Link href="/admin"><button className="btn btn-outline btn-sm">← กลับหน้าผู้ดูแล</button></Link>
    </main>
  );
}
