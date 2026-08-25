'use client';
// components/SongNathab.js — แผง "🥁 หน้าทับ" ในหน้าเพลง: ผูกเพลงกับหน้าทับในคลังกลาง
//
//   หน้าทับหลัก (section = null) ใช้ทั้งเพลง + ข้อยกเว้นรายท่อน (เพลงเถา / ออกภาษา / ไม้เดิน–ไม้ลา)
//   ตั้งได้โดย แอดมิน/ผู้ดูแล หรือเจ้าของเพลง (songs.contributed_by) · ทุกคนดูได้
//   บันทึกลงตาราง song_nathab แล้วส่ง rules กลับให้ NotationPlayer ผ่าน onRules
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useMe } from './Gate';
import { DRUMS, loadNathabLibrary, loadSongNathab, nathabNames } from '../lib/nathab';

const LEVEL_OPTS = ['สามชั้น', 'สองชั้น', 'ชั้นเดียว'];

function NathabSelect({ names, value, onChange }) {
  return (
    <select className="filter-select" value={value} onChange={e => onChange(e.target.value)}>
      {!value && <option value="">— เลือกหน้าทับ —</option>}
      {names.map(n => <option key={n} value={n}>{n}</option>)}
      {value && !names.includes(value) && <option value={value}>{value}</option>}
    </select>
  );
}

export default function SongNathab({ song, verses, onRules }) {
  const me = useMe();
  const songId = song?.id;
  const [rules, setRules] = useState([]);
  const [names, setNames] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);      // { main: {nathab, level, drum}, extra: [{section, nathab, level, drum}] }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const sections = useMemo(() => [...new Set((verses ?? []).map(v => (v.section ?? '').trim()).filter(Boolean))], [verses]);
  const canEdit = !me.loading && !!me.user && (me.isAdmin || (song?.contributed_by && song.contributed_by === me.user.id));

  const load = useCallback(async () => {
    if (!songId) return;
    const r = await loadSongNathab(songId);
    setRules(r); onRules?.(r);
  }, [songId, onRules]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadNathabLibrary().then(rows => setNames(nathabNames(rows))).catch(() => {}); }, []);

  const main = rules.find(r => !r.section) ?? null;
  const extra = rules.filter(r => r.section);

  function startEdit() {
    setDraft({
      main: { nathab: main?.nathab ?? (names[0] ?? ''), level: main?.level ?? '', drum: main?.drum ?? '' },
      extra: extra.map(r => ({ section: r.section, nathab: r.nathab, level: r.level ?? '', drum: r.drum ?? '' })),
    });
    setOpen(true);
  }
  async function save() {
    if (!draft.main.nathab) { setMsg('⚠ เลือกหน้าทับหลักก่อน'); return; }
    setBusy(true); setMsg('');
    const out = [
      { song_id: songId, section: null, nathab: draft.main.nathab, level: draft.main.level || null, drum: draft.main.drum || null },
      ...draft.extra.filter(x => x.section && x.nathab).map(x => ({ song_id: songId, section: x.section, nathab: x.nathab, level: x.level || null, drum: x.drum || null })),
    ];
    // ชุดใหม่แทนชุดเก่าทั้งหมด (ตารางเล็ก แถวต่อเพลงไม่กี่แถว)
    const { error: e1 } = await supabase.from('song_nathab').delete().eq('song_id', songId);
    const { error: e2 } = e1 ? { error: e1 } : await supabase.from('song_nathab').insert(out);
    setBusy(false);
    if (e2) { setMsg('⚠ บันทึกไม่สำเร็จ: ' + e2.message); return; }
    setOpen(false); setMsg('✓ บันทึกแล้ว เครื่องเล่นจะตีหน้าทับนี้ให้อัตโนมัติ');
    setTimeout(() => setMsg(''), 4000);
    load();
  }
  async function clearAll() {
    if (!confirm('เอาหน้าทับออกจากเพลงนี้?')) return;
    setBusy(true);
    const { error } = await supabase.from('song_nathab').delete().eq('song_id', songId);
    setBusy(false);
    if (error) { setMsg('⚠ ' + error.message); return; }
    setOpen(false); load();
  }
  const setMain = patch => setDraft(d => ({ ...d, main: { ...d.main, ...patch } }));
  const setExtra = (i, patch) => setDraft(d => ({ ...d, extra: d.extra.map((x, j) => j === i ? { ...x, ...patch } : x) }));

  return (
    <div className="card" style={{ padding: '0.7rem 0.9rem', marginBottom: '0.8rem' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>🥁 หน้าทับ</span>
        {main ? (
          <span style={{ fontSize: '0.8rem' }}>
            <b style={{ color: 'var(--gold)' }}>{main.nathab}</b>
            {main.level && <span style={{ color: 'var(--muted)' }}> · {main.level}</span>}
            {main.drum && <span style={{ color: 'var(--muted)' }}> · {main.drum}</span>}
            {extra.map(r => (
              <span key={r.id} style={{ marginLeft: 10, fontSize: '0.74rem', color: 'var(--muted)' }}>
                {r.section} → <span style={{ color: 'var(--cream)' }}>{r.nathab}</span>{r.level ? ` (${r.level})` : ''}
              </span>
            ))}
          </span>
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>ยังไม่ได้ระบุ — ผู้ฟังเลือกเองในเครื่องเล่น</span>
        )}
        <Link href="/nathab" style={{ fontSize: '0.7rem', color: 'var(--gold2)' }}>ดูคลังหน้าทับ ↗</Link>
        {canEdit && !open && <button className="btn btn-outline btn-sm" onClick={startEdit}>{main ? '✎ แก้' : '＋ ตั้งหน้าทับ'}</button>}
      </div>
      {msg && <div style={{ fontSize: '0.76rem', color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)', marginTop: 6 }}>{msg}</div>}

      {open && draft && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.76rem', width: 110 }}>หน้าทับหลัก</span>
            <NathabSelect names={names} value={draft.main.nathab} onChange={v => setMain({ nathab: v })} />
            <select className="filter-select" value={draft.main.level} onChange={e => setMain({ level: e.target.value })} title="อัตราที่ใช้ตี">
              <option value="">อัตราตามโน้ต/ผู้ฟังเลือก</option>{LEVEL_OPTS.map(l => <option key={l}>{l}</option>)}
            </select>
            <select className="filter-select" value={draft.main.drum} onChange={e => setMain({ drum: e.target.value })} title="เครื่องกำกับจังหวะที่แนะนำ">
              <option value="">เครื่องใดก็ได้</option>{DRUMS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          {draft.extra.map((x, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
              <select className="filter-select" style={{ width: 110 }} value={x.section} onChange={e => setExtra(i, { section: e.target.value })}>
                <option value="">— ท่อน —</option>
                {sections.map(sname => <option key={sname} value={sname}>{sname}</option>)}
                {x.section && !sections.includes(x.section) && <option value={x.section}>{x.section}</option>}
              </select>
              <NathabSelect names={names} value={x.nathab} onChange={v => setExtra(i, { nathab: v })} />
              <select className="filter-select" value={x.level} onChange={e => setExtra(i, { level: e.target.value })}>
                <option value="">อัตราเดิม</option>{LEVEL_OPTS.map(l => <option key={l}>{l}</option>)}
              </select>
              <select className="filter-select" value={x.drum} onChange={e => setExtra(i, { drum: e.target.value })}>
                <option value="">เครื่องเดิม</option>{DRUMS.map(d => <option key={d}>{d}</option>)}
              </select>
              <button className="btn btn-outline btn-sm" onClick={() => setDraft(d => ({ ...d, extra: d.extra.filter((_, j) => j !== i) }))}>🗑</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <button className="btn btn-outline btn-sm" disabled={!sections.length}
              title={sections.length ? 'เพิ่มข้อยกเว้นเฉพาะท่อน' : 'โน้ตเพลงนี้ยังไม่ได้แบ่งท่อน'}
              onClick={() => setDraft(d => ({ ...d, extra: [...d.extra, { section: sections.find(sn => !d.extra.some(x => x.section === sn)) ?? '', nathab: d.main.nathab, level: '', drum: '' }] }))}>
              ＋ ท่อนที่ใช้หน้าทับต่างออกไป</button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? '⏳' : '💾 บันทึก'}</button>
            <button className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>ยกเลิก</button>
            {main && <button className="btn btn-danger btn-sm" disabled={busy} onClick={clearAll}>เอาออก</button>}
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: 6 }}>
            ท่อนที่ไม่ได้ระบุใช้หน้าทับหลัก · ชื่อท่อนอ่านจากโน้ตของทางที่เปิดอยู่ ({sections.length ? sections.join(' / ') : 'ไม่มี'})
            · ไม่มีหน้าทับที่ต้องการ? <Link href="/nathab" style={{ color: 'var(--gold2)' }}>เขียนเพิ่มในคลัง</Link>
          </div>
        </div>
      )}
    </div>
  );
}
