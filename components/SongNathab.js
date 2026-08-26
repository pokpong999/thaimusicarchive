'use client';
// components/SongNathab.js — แผง "🥁 หน้าทับ" ในหน้าเพลง: ผูกเพลงกับหน้าทับในคลังกลาง
//
//   หน้าทับหลัก (section = null) ใช้ทั้งเพลง + กฎรายท่อน 2 แบบ (scope)
//     only = เฉพาะท่อนนั้น (เพลงเถา: ลูกหมด → หน้าทับลูกหมด)
//     from = ตั้งแต่ท่อนนั้นไปจนกว่าจะถึงกฎ from ถัดไป (เพลงเรื่อง: ปรบไก่ → สองไม้ → เพลงเร็ว → ลา)
//   ชื่อท่อนพิมพ์เองได้ เทียบ "ขึ้นต้นด้วย" (กฎ 'เพลงเร็ว' ครอบ 'เพลงเร็ว ท่อน 1/2') · ปุ่ม ✨ เดากฎจากชื่อท่อน
//   ตั้งได้โดย แอดมิน/ผู้ดูแล หรือเจ้าของเพลง (songs.contributed_by) · ทุกคนดูได้
//   บันทึกลงตาราง song_nathab แล้วส่ง rules กลับให้ NotationPlayer ผ่าน onRules
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useMe } from './Gate';
import { DRUMS, drumLabel, loadNathabLibrary, loadSongNathab, nathabNames, guessSongNathab, matchSection } from '../lib/nathab';

const LEVEL_OPTS = ['สามชั้น', 'สองชั้น', 'ชั้นเดียว'];
const SCOPE_LABEL = { only: 'เฉพาะท่อนนี้', from: 'ตั้งแต่ท่อนนี้ไป' };

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
  useEffect(() => { loadNathabLibrary({ force: true }).then(rows => setNames(nathabNames(rows))).catch(() => {}); }, []);

  const main = rules.find(r => !r.section) ?? null;
  const extra = rules.filter(r => r.section);

  function startEdit() {
    setDraft({
      main: { nathab: main?.nathab ?? (names[0] ?? ''), level: main?.level ?? '', drum: main?.drum ?? '' },
      extra: extra.map(r => ({ section: r.section, nathab: r.nathab, level: r.level ?? '', drum: r.drum ?? '', scope: r.scope === 'from' ? 'from' : 'only' })),
    });
    setOpen(true);
  }
  async function save() {
    if (!draft.main.nathab) { setMsg('⚠ เลือกหน้าทับหลักก่อน'); return; }
    const keys = draft.extra.map(x => x.section.trim()).filter(Boolean);
    if (new Set(keys).size !== keys.length) { setMsg('⚠ มีชื่อท่อนซ้ำกันในกฎ'); return; }
    setBusy(true); setMsg('');
    const out = [
      { song_id: songId, section: null, nathab: draft.main.nathab, level: draft.main.level || null, drum: draft.main.drum || null, scope: 'only' },
      ...draft.extra.filter(x => x.section.trim() && x.nathab).map(x => ({ song_id: songId, section: x.section.trim(), nathab: x.nathab, level: x.level || null, drum: x.drum || null, scope: x.scope === 'from' ? 'from' : 'only' })),
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
  function guess() {
    const g = guessSongNathab(sections, names, { main: draft.main.nathab });
    if (!g.length) { setMsg('⚠ เดาไม่ได้ — ชื่อท่อนไม่มีคำว่า ลูกหมด/สองไม้/เพลงเร็ว/ลา หรือคลังยังไม่มีหน้าทับชื่อนั้น'); return; }
    setDraft(d => ({ ...d, extra: g.map(x => ({ ...x, level: '', drum: '' })) }));
    setMsg(`✨ เดาได้ ${g.length} กฎ — ตรวจแล้วกดบันทึก`);
  }
  // ท่อนที่กฎแต่ละข้อจะครอบจริง (โชว์ใต้กฎ) — ให้เห็นว่ากฎ 'from' กินไปถึงไหน
  const coverage = useMemo(() => {
    if (!draft) return [];
    const from = draft.extra.filter(x => x.scope === 'from' && x.section.trim());
    const only = draft.extra.filter(x => x.scope !== 'from' && x.section.trim());
    let running = null;
    const best = (list, sec) => list.reduce((b, r) => { const sc = matchSection(r.section, sec); return sc > b.score ? { rule: r, score: sc } : b; }, { rule: null, score: 0 });
    const owner = sections.map(sec => {
      const f = best(from, sec), o = best(only, sec);
      if (f.rule) running = f.rule;
      return (o.rule && o.score >= f.score) ? o.rule : running;
    });
    return draft.extra.map(x => sections.filter((_, i) => owner[i] === x));
  }, [draft, sections]);
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
                {r.section}{r.scope === 'from' ? ' ▸' : ''} → <span style={{ color: 'var(--cream)' }}>{r.nathab}</span>{r.level ? ` (${r.level})` : ''}
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
              <option value="">เครื่องใดก็ได้</option>{DRUMS.map(d => <option key={d} value={d}>{drumLabel(d)}</option>)}
            </select>
          </div>
          {draft.extra.map((x, i) => (
            <div key={i} style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="form-input" list={`sn-sections-${songId}`} style={{ width: 150, fontSize: '0.8rem' }} value={x.section}
                  placeholder="ชื่อท่อน" title="พิมพ์ชื่อท่อน หรือเลือกจากรายการ · พิมพ์แค่ต้นชื่อก็ได้ เช่น 'เพลงเร็ว' ครอบทุกท่อนที่ขึ้นต้นด้วยคำนี้"
                  onChange={e => setExtra(i, { section: e.target.value })} />
                <select className="filter-select" value={x.scope} onChange={e => setExtra(i, { scope: e.target.value })} title="ขอบเขตของกฎ">
                  {Object.entries(SCOPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <NathabSelect names={names} value={x.nathab} onChange={v => setExtra(i, { nathab: v })} />
                <select className="filter-select" value={x.level} onChange={e => setExtra(i, { level: e.target.value })}>
                  <option value="">อัตราเดิม</option>{LEVEL_OPTS.map(l => <option key={l}>{l}</option>)}
                </select>
                <select className="filter-select" value={x.drum} onChange={e => setExtra(i, { drum: e.target.value })}>
                  <option value="">เครื่องเดิม</option>{DRUMS.map(d => <option key={d} value={d}>{drumLabel(d)}</option>)}
                </select>
                <button className="btn btn-outline btn-sm" onClick={() => setDraft(d => ({ ...d, extra: d.extra.filter((_, j) => j !== i) }))}>🗑</button>
              </div>
              <div className="sn-cover" style={{ fontSize: '0.64rem', color: coverage[i]?.length ? 'var(--muted)' : 'var(--gold)', marginLeft: 4 }}>
                {coverage[i]?.length ? `ครอบ: ${coverage[i].join(' · ')}` : x.section.trim() ? 'ไม่ตรงกับท่อนไหนในโน้ตเลย' : ''}
              </div>
            </div>
          ))}
          <datalist id={`sn-sections-${songId}`}>{sections.map(sname => <option key={sname} value={sname} />)}</datalist>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <button className="btn btn-outline btn-sm" disabled={!sections.length}
              title={sections.length ? 'เพิ่มข้อยกเว้นเฉพาะท่อน' : 'โน้ตเพลงนี้ยังไม่ได้แบ่งท่อน'}
              onClick={() => setDraft(d => ({ ...d, extra: [...d.extra, { section: sections.find(sn => !d.extra.some(x => x.section === sn)) ?? '', nathab: d.main.nathab, level: '', drum: '', scope: 'only' }] }))}>
              ＋ ท่อนที่ใช้หน้าทับต่างออกไป</button>
            <button className="btn btn-outline btn-sm" disabled={!sections.length} onClick={guess}
              title="เดากฎจากชื่อท่อน: ลูกหมด → หน้าทับลูกหมด · สองไม้/เพลงเร็ว/ลา → ตั้งแต่ท่อนนั้นไป">✨ เดาจากชื่อท่อน</button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? '⏳' : '💾 บันทึก'}</button>
            <button className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>ยกเลิก</button>
            {main && <button className="btn btn-danger btn-sm" disabled={busy} onClick={clearAll}>เอาออก</button>}
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: 6 }}>
            ท่อนที่ไม่ได้ระบุใช้หน้าทับหลัก · <b>เฉพาะท่อนนี้</b> = ท่อนเดียว (เช่น ลูกหมด) · <b>ตั้งแต่ท่อนนี้ไป</b> = ใช้ต่อเนื่องจนถึงกฎถัดไป (เพลงเรื่อง: สองไม้ → เพลงเร็ว → ลา)
            · พิมพ์แค่ต้นชื่อท่อนได้ ('เพลงเร็ว' ครอบ 'เพลงเร็ว ท่อน 1/2') · ท่อนในโน้ต: {sections.length ? sections.join(' / ') : 'ไม่มี'}
            · ไม่มีหน้าทับที่ต้องการ? <Link href="/nathab" style={{ color: 'var(--gold2)' }}>เขียนเพิ่มในคลัง</Link>
          </div>
        </div>
      )}
    </div>
  );
}
