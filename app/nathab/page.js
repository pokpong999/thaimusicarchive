'use client';
// app/nathab/page.js — คลังหน้าทับกลาง (ดู/ฟังได้ทุกคน · เขียนได้ตามสิทธิ์)
//
//   แอดมิน/ผู้ดูแล  → บันทึกเข้าคลังทันที (คีย์ซ้ำ = แทนที่ของเดิม)
//   superuser/student/สมาชิกศักดินา ≥ 300 → ส่งรออนุมัติ (เห็นของตัวเองในกล่อง "รออนุมัติ")
//   ทุกเพลงเลือกหน้าทับจากคลังนี้ได้ที่หน้าเพลง (แผง 🥁 หน้าทับ)
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { FeaturePage, useMe } from '../../components/Gate';
import NathabEditor, { NathabPreview } from '../../components/NathabEditor';
import { DRUMS, LEVELS, invalidateNathabLibrary, loadNathabLibrary, nathabNames } from '../../lib/nathab';

const LEVEL_ORDER = { 'สามชั้น': 0, 'สองชั้น': 1, 'ชั้นเดียว': 2, 'ทุกอัตรา': 3 };
const MIN_POINTS = 300;

export default function NathabLibraryPage() {
  const me = useMe();
  const [rows, setRows] = useState([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fInst, setFInst] = useState('');
  const [fLevel, setFLevel] = useState('');
  const [editing, setEditing] = useState(null);     // null | { row, mode: 'new' | 'edit' | 'propose' }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadNathabLibrary({ force: true });
    setRows(data); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!me.user) return;
    supabase.from('profiles').select('points').eq('id', me.user.id).single().then(({ data }) => setPoints(data?.points ?? 0));
  }, [me.user]);

  const canWrite = !me.loading && !!me.user && (me.isAdmin || me.isViewer || me.isStudent || points >= MIN_POINTS);
  const approved = useMemo(() => rows.filter(r => (r.status ?? 'approved') === 'approved'), [rows]);
  const mine = useMemo(() => rows.filter(r => r.status !== 'approved' && me.user && r.submitted_by === me.user.id), [rows, me.user]);
  const names = useMemo(() => nathabNames(rows), [rows]);

  const groups = useMemo(() => {
    const f = approved.filter(r =>
      (!q || r.nathab.includes(q) || (r.note ?? '').includes(q)) &&
      (!fInst || r.instrument === fInst) && (!fLevel || r.level === fLevel));
    const by = {};
    f.forEach(r => (by[r.nathab] = by[r.nathab] ?? []).push(r));
    return Object.keys(by).sort((a, b) => a.localeCompare(b, 'th')).map(n => ({
      name: n,
      rows: by[n].sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || a.instrument.localeCompare(b.instrument, 'th')),
    }));
  }, [approved, q, fInst, fLevel]);

  function flash(t, ms = 3500) { setMsg(t); setTimeout(() => setMsg(''), ms); }

  async function save(out) {
    setBusy(true);
    let error = null;
    if (editing?.mode === 'edit' && editing.row?.id != null) {
      ({ error } = await supabase.from('nathab_patterns').update(out).eq('id', editing.row.id));
    } else {
      ({ error } = await supabase.from('nathab_patterns').insert(out));
    }
    setBusy(false);
    if (error) { flash('⚠ บันทึกไม่สำเร็จ: ' + error.message, 6000); return; }
    invalidateNathabLibrary();
    setEditing(null);
    flash(me.isAdmin ? `✓ บันทึกหน้าทับ ${out.nathab} (${out.level} · ${out.instrument}) เข้าคลังแล้ว`
                     : `✓ ส่งหน้าทับ ${out.nathab} แล้ว รอผู้ดูแลอนุมัติ`);
    load();
  }
  async function remove(row) {
    if (!confirm(`ลบหน้าทับ ${row.nathab} · ${row.level} · ${row.instrument} ?`)) return;
    const { error } = await supabase.from('nathab_patterns').delete().eq('id', row.id);
    if (error) { flash('⚠ ลบไม่สำเร็จ: ' + error.message, 6000); return; }
    invalidateNathabLibrary(); load();
  }

  return (
    <FeaturePage feature="page_nathab">
    <main className="container" style={{ maxWidth: '900px' }}>
      <div className="section-title" style={{ fontSize: '1.2rem' }}>🥁 คลังหน้าทับกลาง</div>
      <div className="section-subtitle">
        โน้ตหน้าทับกลองทุกอัตรา ทุกเครื่อง เขียนไว้ที่เดียว แล้วเลือกใช้กับเพลงไหนก็ได้ในหอจดหมายเหตุ
        · {approved.length} รายการ · {names.length} หน้าทับ
      </div>

      {msg && <div className="card" style={{ fontSize: '0.82rem', color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)', marginTop: '0.8rem' }}>{msg}</div>}

      {/* เขียนใหม่ / แก้ */}
      {editing ? (
        <div className="card" style={{ marginTop: '1rem', borderColor: 'rgba(201,168,76,0.5)' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.6rem' }}>
            {editing.mode === 'new' ? '✏️ เขียนหน้าทับใหม่' : editing.mode === 'edit' ? `✏️ แก้ไข ${editing.row.nathab}` : `✏️ เสนอแก้ไข ${editing.row.nathab}`}
            {!me.isAdmin && <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: 8 }}>ส่งแล้วจะรอผู้ดูแลอนุมัติก่อนขึ้นคลัง</span>}
          </div>
          <NathabEditor key={editing.row?.id ?? 'new'} value={editing.row} names={names} busy={busy}
            lockMeta={editing.mode === 'propose'}
            saveLabel={me.isAdmin ? '💾 บันทึกเข้าคลัง' : '📨 ส่งรออนุมัติ'}
            onSave={save} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: '1rem' }}>
          {canWrite && <button className="btn btn-primary btn-sm" onClick={() => setEditing({ row: null, mode: 'new' })}>＋ เขียนหน้าทับใหม่</button>}
          {!me.loading && !canWrite && (
            <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
              {me.user ? `เขียนหน้าทับได้เมื่อถึงระดับขุน (${MIN_POINTS} ศักดินา) — ตอนนี้ ${points} ศักดินา` : 'เข้าสู่ระบบเพื่อเขียนหน้าทับ'}
            </span>
          )}
          <input className="form-input" style={{ width: 180 }} placeholder="ค้นชื่อหน้าทับ" value={q} onChange={e => setQ(e.target.value)} />
          <select className="filter-select" value={fInst} onChange={e => setFInst(e.target.value)}>
            <option value="">ทุกเครื่อง</option>{DRUMS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select className="filter-select" value={fLevel} onChange={e => setFLevel(e.target.value)}>
            <option value="">ทุกอัตรา</option>{LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
      )}

      {/* ของฉันที่รออนุมัติ */}
      {mine.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem' }}>⏳ ของฉันที่รออนุมัติ ({mine.length})</div>
          {mine.map(r => (
            <div key={r.id} style={{ padding: '6px 0', borderTop: '1px solid rgba(42,63,92,0.4)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', minWidth: 200 }}>
                <b>{r.nathab}</b> · {r.level} · {r.instrument}
                <span style={{ marginLeft: 6, fontSize: '0.68rem', color: r.status === 'rejected' ? 'var(--danger)' : 'var(--gold)' }}>
                  {r.status === 'rejected' ? 'ไม่ผ่าน' : 'รออนุมัติ'}</span>
              </span>
              <NathabPreview row={r} />
              {r.status === 'pending' && <>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing({ row: r, mode: 'edit' })}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(r)}>🗑</button>
              </>}
            </div>
          ))}
        </div>
      )}

      {/* คลัง */}
      {loading && <div style={{ color: 'var(--muted)', marginTop: '1rem' }}>กำลังโหลด...</div>}
      {!loading && groups.length === 0 && <div className="card" style={{ marginTop: '1rem', color: 'var(--muted)' }}>ยังไม่มีหน้าทับที่ตรงเงื่อนไข</div>}
      {groups.map(g => (
        <div key={g.name} className="card" style={{ marginTop: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            <b style={{ fontSize: '1rem', color: 'var(--gold)' }}>หน้าทับ{g.name}</b>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{g.rows.length} แบบ</span>
            {g.rows.find(r => r.note)?.note && <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>— {g.rows.find(r => r.note).note}</span>}
          </div>
          {g.rows.map(r => (
            <div key={r.id} style={{ padding: '7px 0', borderTop: '1px solid rgba(42,63,92,0.4)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', minWidth: 150 }}>
                <span style={{ color: 'var(--jade)' }}>{r.level}</span> · {r.instrument}
                {r.source && <div style={{ fontSize: '0.64rem', color: 'var(--muted)' }}>ที่มา: {r.source}</div>}
              </span>
              <NathabPreview row={r} />
              {canWrite && !editing && (
                me.isAdmin
                  ? <span style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-outline btn-sm" title="แก้ไข" onClick={() => setEditing({ row: r, mode: 'edit' })}>✏️</button>
                      <button className="btn btn-danger btn-sm" title="ลบ" onClick={() => remove(r)}>🗑</button>
                    </span>
                  : <button className="btn btn-outline btn-sm" onClick={() => setEditing({ row: { ...r, id: undefined }, mode: 'propose' })}>เสนอแก้ไข</button>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="card" style={{ marginTop: '1.2rem', fontSize: '0.78rem', lineHeight: 1.9, color: 'var(--muted)' }}>
        <b style={{ color: 'var(--cream)' }}>ใช้กับเพลงอย่างไร</b><br />
        เปิดหน้าเพลง → แผง 🥁 หน้าทับ → เลือก "หน้าทับหลัก" ของเพลง และเพิ่มข้อยกเว้นรายท่อนได้ (เพลงเถา เพลงออกภาษา)
        เครื่องเล่นโน้ตจะตีหน้าทับตามที่ตั้งไว้โดยอัตโนมัติ · โน้ตในคลังเป็นรูปแบบเดียวกับที่เครื่องเล่นใช้ (พยางค์ต่อตำแหน่ง คั่นห้องด้วย |)
      </div>
      <Link href="/"><button className="btn btn-outline btn-sm" style={{ marginTop: '0.6rem' }}>← หน้าแรก</button></Link>
    </main>
    </FeaturePage>
  );
}
