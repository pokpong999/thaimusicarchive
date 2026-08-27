'use client';
// components/SongTypeAdmin.js — แผงจัดการบัญชีประเภทเพลง  (Pk 27 ส.ค. 69)
//
//   ผู้ดูแลเท่านั้น (RLS ใน sql/29 บังคับอีกชั้นที่ฐานข้อมูล ไม่ได้กันแค่ที่หน้าจอ)
//   เพิ่ม · เปลี่ยนชื่อ (ย้ายเพลงตามให้) · เรียงลำดับ · ปิดไม่ให้เลือกใหม่ · ลบ (เฉพาะที่ไม่มีเพลงใช้)
import { useCallback, useEffect, useState } from 'react';
import { KINDS, KIND_LABEL, KIND_HINT, loadSongTypesAdmin, addSongType, renameSongType,
         setSongTypeActive, deleteSongType, moveSongType, mergeSongType } from '../lib/songtypes';
import { SongTypeDot } from './SongTypeSelect';

export default function SongTypeAdmin() {
  const [list, setList] = useState({ type: [], style: [] });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState({ type: '', style: '' });
  const [edit, setEdit] = useState(null);      // { key, name }
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const r = await loadSongTypesAdmin();
    if (r.error) { setErr('อ่านบัญชีไม่ได้: ' + r.error.message + ' — ถ้ายังไม่ได้รัน sql/29 ให้รันก่อน'); return; }
    setErr(''); setList(r.list);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // แปลข้อความจากฐานให้อ่านรู้เรื่อง — แต่ต่อข้อความจริงไว้ท้ายเสมอ
  //   (บทเรียนจากรอบก่อน: แปลแล้วกลืนข้อความจริง ทำให้ตามหาสาเหตุไม่เจอ)
  const say = m => {
    if (/row-level security/i.test(m)) return 'ต้องเป็นผู้ดูแลถึงจะแก้บัญชีนี้ได้ · ' + m;
    if (/does not exist|schema cache/i.test(m)) return 'ยังไม่ได้รัน sql/29 · ' + m;
    return m;
  };

  const run = async (fn, okMsg) => {
    setBusy(true); setMsg(''); setErr('');
    const r = await fn();
    setBusy(false);
    if (r?.error) { setErr('⚠ ' + say(r.error.message)); return false; }
    setMsg(typeof okMsg === 'function' ? okMsg(r) : okMsg);
    await reload();
    return true;
  };

  const keyOf = r => `${r.kind}:${r.name}`;

  return (
    <div className="card">
      <div style={{fontWeight:600,marginBottom:'0.3rem'}}>🏷 บัญชีประเภทเพลง — เพิ่ม / แก้ไข / เรียงลำดับ</div>
      <div style={{fontSize:'0.74rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'0.9rem'}}>
        คำในบัญชีนี้คือคำที่กล่องเลือกทุกหน้าจะเห็น — หน้าเขียนโน้ต · หน้าผู้ดูแล · ตัวกรองหน้าแรก<br />
        เพิ่มคำใหม่แล้วใช้ได้ทันที ไม่ต้องแก้โค้ด · สมาชิกทั่วไปเพิ่มเองไม่ได้
      </div>
      {msg && <div style={{fontSize:'0.8rem',color:'var(--jade)',marginBottom:'0.6rem'}}>{msg}</div>}
      {err && <div style={{fontSize:'0.8rem',color:'var(--danger)',marginBottom:'0.6rem'}}>{err}</div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'1.1rem'}}>
        {KINDS.map(kind => (
          <div key={kind} data-kind={kind}>
            <div style={{fontWeight:600,fontSize:'0.88rem'}}>{KIND_LABEL[kind]}</div>
            <div style={{fontSize:'0.7rem',color:'var(--muted)',marginBottom:'0.5rem'}}>{KIND_HINT[kind]}</div>

            {list[kind].map((r, i) => {
              const k = keyOf(r);
              const editing = edit?.key === k;
              return (
                <div key={k} data-row={k} style={{display:'flex',gap:'5px',alignItems:'center',
                  padding:'5px 0',borderBottom:'1px solid rgba(42,63,92,0.35)',flexWrap:'wrap',
                  opacity: r.active ? 1 : 0.55}}>
                  {editing ? (
                    <>
                      <input className="form-input" style={{flex:1,minWidth:'130px'}} value={edit.name} autoFocus
                        onChange={e => setEdit({ ...edit, name: e.target.value })} />
                      <button className="btn btn-jade btn-sm" disabled={busy} onClick={async () => {
                        const ok = await run(() => renameSongType(r, edit.name),
                          res => res.moved ? `✓ เปลี่ยนชื่อแล้ว · ย้าย ${res.moved} เพลงตามไปด้วย` : '✓ เปลี่ยนชื่อแล้ว');
                        if (ok) setEdit(null);
                      }}>บันทึก</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEdit(null)}>ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <span style={{flex:1,minWidth:'120px',fontSize:'0.85rem'}}>
                        <SongTypeDot color={r.color} />{r.name}
                        <span style={{color:'var(--muted)',fontSize:'0.72rem'}}> · {r.count} เพลง</span>
                        {!r.active && <span style={{color:'var(--muted)',fontSize:'0.7rem'}}> · ปิดอยู่</span>}
                        {r.orphan && <span style={{color:'var(--gold2)',fontSize:'0.7rem'}} title="คำนี้มีเพลงใช้อยู่ แต่ยังไม่อยู่ในบัญชี"> · นอกบัญชี</span>}
                      </span>
                      <button className="btn btn-outline btn-sm btn-icon" title="เลื่อนขึ้น" disabled={busy || i === 0}
                        onClick={() => run(() => moveSongType(list[kind], r, -1), '')}>↑</button>
                      <button className="btn btn-outline btn-sm btn-icon" title="เลื่อนลง" disabled={busy || i === list[kind].length - 1}
                        onClick={() => run(() => moveSongType(list[kind], r, 1), '')}>↓</button>
                      <button className="btn btn-outline btn-sm" title="เปลี่ยนชื่อ — เพลงที่ใช้อยู่จะย้ายตามให้"
                        onClick={() => setEdit({ key: k, name: r.name })}>✎</button>
                      {r.id != null && (
                        <button className="btn btn-outline btn-sm" disabled={busy}
                          title={r.active ? 'ปิดไม่ให้เลือกใหม่ (เพลงเก่าที่ใช้อยู่ไม่หาย)' : 'เปิดให้เลือกได้อีก'}
                          onClick={() => run(() => setSongTypeActive(r, !r.active), r.active ? '✓ ปิดแล้ว' : '✓ เปิดแล้ว')}>
                          {r.active ? '🚫' : '↩'}</button>
                      )}
                      <button className="btn btn-danger btn-sm btn-icon" disabled={busy || r.count > 0}
                        title={r.count > 0 ? `ลบไม่ได้ — ยังมี ${r.count} เพลงใช้อยู่` : 'ลบ'}
                        onClick={async () => {
                          if (!confirm(`ลบ "${r.name}" ออกจากบัญชี?`)) return;
                          run(() => deleteSongType(r), '✓ ลบ ' + r.name + ' แล้ว');
                        }}>🗑</button>
                    </>
                  )}
                </div>
              );
            })}
            {list[kind].length === 0 && (
              <div style={{fontSize:'0.76rem',color:'var(--muted)',padding:'6px 0'}}>ยังไม่มีคำในบัญชีนี้</div>
            )}

            <div style={{display:'flex',gap:'6px',marginTop:'0.7rem'}}>
              <input className="form-input" style={{flex:1}} placeholder={`เพิ่ม${KIND_LABEL[kind]}ใหม่…`}
                value={adding[kind]} onChange={e => setAdding({ ...adding, [kind]: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.nextSibling?.click(); }} />
              <button className="btn btn-jade btn-sm" disabled={busy || !adding[kind].trim()}
                onClick={async () => {
                  const ok = await run(() => addSongType(kind, adding[kind]), '✓ เพิ่ม "' + adding[kind].trim() + '" แล้ว');
                  if (ok) setAdding({ ...adding, [kind]: '' });
                }}>＋ เพิ่ม</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
