'use client';
// components/SuiteSplitter.js — เครื่องมือแยกเพลงย่อยออกจากเพลงเรื่อง  (Pk 27 ส.ค. 69)
//
//   ขั้นตอน
//     ๑ เลือกเพลงเรื่อง
//     ๒ ระบบอ่านชื่อท่อนในฐาน แล้วเสนอว่าน่าจะเป็นเพลงย่อยกี่เพลง ช่วงวรรคไหน
//     ๓ คนตรวจ/แก้ชื่อ · ขยับขอบเขต · ตัดเพลงที่ไม่อยากแยกออก
//     ๔ กดแยก — สร้างเพลงย่อยทีละเพลง บอกผลรายเพลง
//
//   ★ ไม่คัดลอกโน้ต · โน้ตยังเป็นชุดเดียวที่เพลงเรื่อง
//     แก้ที่เพลงย่อยหรือที่เพลงเรื่องก็คือแถวเดียวกัน
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { suggestParts, partIdFor, makePart, unmakePart, listParts, partError } from '../lib/songparts';

const MAIN = 'ทำนองหลัก';

export default function SuiteSplitter() {
  const [suites, setSuites] = useState([]);
  const [sid, setSid] = useState('');
  const [rows, setRows] = useState(null);        // วรรคของทำนองหลัก
  const [parts, setParts] = useState([]);        // ที่จะแยก (แก้ได้)
  const [done, setDone] = useState([]);          // ที่แยกไปแล้ว
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  // เพลงที่น่าจะเป็นเพลงเรื่อง — ดูจากประเภท หรือชื่อที่มีคำว่า เรื่อง/ตับ
  useEffect(() => {
    supabase.from('songs').select('id, name_th, type, total_verses, parent_song_id').order('name_th')
      .then(({ data }) => setSuites((data ?? []).filter(s => !s.parent_song_id
        && (/เรื่อง|ตับ/.test(s.type ?? '') || /เรื่อง|ตับ/.test(s.name_th ?? '')))));
  }, []);

  const loadSuite = useCallback(async id => {
    setMsg(''); setErr(''); setLog([]); setRows(null); setParts([]); setDone([]);
    if (!id) return;
    const { data, error } = await supabase.from('song_melody')
      .select('id, verse_no, section, part_song_id').eq('song_id', id).eq('instrument', MAIN).order('verse_no');
    if (error) { setErr('อ่านโน้ตไม่ได้: ' + partError(error.message)); return; }
    const vs = data ?? [];
    setRows(vs);
    setDone(await listParts(id));
    setParts(suggestParts(vs).map(p => ({ ...p, id: partIdFor(id, p.partNo), take: true })));
  }, []);

  useEffect(() => { loadSuite(sid); }, [sid, loadSuite]);

  const upd = (i, patch) => setParts(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  // ตรวจก่อนแยก — บอกทุกปัญหาพร้อมกัน ไม่ใช่เจอทีละอย่าง
  const taken = parts.filter(p => p.take);
  const problems = [];
  if (rows) {
    const ids = taken.map(p => p.id);
    if (new Set(ids).size !== ids.length) problems.push('Song ID ซ้ำกันเอง');
    if (taken.some(p => !p.name.trim())) problems.push('มีเพลงที่ยังไม่ได้ตั้งชื่อ');
    if (taken.some(p => p.from > p.to)) problems.push('มีช่วงวรรคที่กลับหัว');
    const sorted = [...taken].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].from <= sorted[i - 1].to) { problems.push(`ช่วงวรรคทับกัน: ${sorted[i - 1].name} กับ ${sorted[i].name}`); break; }
    }
    const covered = taken.reduce((n, p) => n + (p.to - p.from + 1), 0);
    if (taken.length && covered !== rows.length) {
      problems.push(`เลือกไว้ ${covered} วรรค จากทั้งหมด ${rows.length} วรรค — ${rows.length - covered} วรรคจะไม่อยู่ในเพลงย่อยไหนเลย`);
    }
  }

  async function runSplit() {
    if (!confirm(`แยก ${taken.length} เพลงย่อยออกจาก ${sid}?\n\nโน้ตไม่ถูกคัดลอก — แก้ที่ไหนก็เปลี่ยนทั้งสองที่\nยกเลิกทีหลังได้ โน้ตไม่หาย`)) return;
    setBusy(true); setErr(''); setMsg(''); setLog([]);
    const out = [];
    for (const p of taken) {
      const { verses, error } = await makePart(sid, p);
      out.push({ name: p.name, id: p.id, verses, error: error ? partError(error.message) : null });
      setLog([...out]);
    }
    setBusy(false);
    const bad = out.filter(x => x.error);
    if (bad.length) setErr(`แยกไม่สำเร็จ ${bad.length} เพลง — ดูรายละเอียดข้างล่าง`);
    else setMsg(`✓ แยกครบ ${out.length} เพลง · รวม ${out.reduce((n, x) => n + x.verses, 0)} วรรค`);
    setDone(await listParts(sid));
  }

  return (
    <div className="card" data-splitter>
      <div style={{fontWeight:600,marginBottom:'0.3rem'}}>🧩 แยกเพลงย่อยจากเพลงเรื่อง</div>
      <div style={{fontSize:'0.74rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'0.9rem'}}>
        เพลงย่อยจะขึ้นในคลังเหมือนเพลงทั่วไป มีหน้าเพลงของตัวเอง เล่นได้ พิมพ์ได้<br />
        <b style={{color:'var(--gold2)'}}>โน้ตไม่ถูกคัดลอก</b> — ยังเป็นชุดเดียวที่เพลงเรื่อง
        แก้ที่เพลงย่อยหรือที่เพลงเรื่องก็คือแถวเดียวกัน ไม่มีทางไม่ตรงกัน
      </div>

      <select className="form-input" style={{maxWidth:'480px'}} value={sid} onChange={e => setSid(e.target.value)}>
        <option value="">— เลือกเพลงเรื่อง —</option>
        {suites.map(s => <option key={s.id} value={s.id}>{s.id} · {s.name_th} ({s.total_verses ?? '?'} วรรค)</option>)}
      </select>

      {msg && <div style={{fontSize:'0.82rem',color:'var(--jade)',marginTop:'0.6rem'}}>{msg}</div>}
      {err && <div style={{fontSize:'0.82rem',color:'var(--danger)',marginTop:'0.6rem'}}>⚠ {err}</div>}

      {done.length > 0 && (
        <div style={{marginTop:'0.9rem'}} data-done>
          <div style={{fontWeight:600,fontSize:'0.84rem',marginBottom:'0.4rem'}}>แยกไปแล้ว {done.length} เพลง</div>
          {done.map(d => (
            <div key={d.id} style={{display:'flex',gap:'8px',alignItems:'center',fontSize:'0.82rem',padding:'4px 0'}}>
              <span className="song-id" style={{width:'110px'}}>{d.id}</span>
              <span style={{flex:1}}>{d.name_th} <span style={{color:'var(--muted)',fontSize:'0.72rem'}}>· {d.total_verses} วรรค</span></span>
              <a className="btn btn-outline btn-sm" href={`/songs/${d.id}`} target="_blank" rel="noreferrer">เปิดดู ↗</a>
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={async () => {
                if (!confirm(`ยกเลิกการแยก "${d.name_th}"?\n\nโน้ตไม่หาย — กลับไปเป็นของ ${sid} อย่างเดียวเหมือนเดิม`)) return;
                setBusy(true);
                const { error } = await unmakePart(d.id);
                setBusy(false);
                if (error) setErr(partError(error.message));
                else { setMsg('✓ ยกเลิก ' + d.name_th + ' แล้ว · โน้ตอยู่ครบ'); setDone(await listParts(sid)); }
              }}>ยกเลิกการแยก</button>
            </div>
          ))}
        </div>
      )}

      {rows && (
        <div style={{marginTop:'1rem'}}>
          <div style={{fontWeight:600,fontSize:'0.84rem',marginBottom:'0.2rem'}}>
            อ่านชื่อท่อนแล้วเสนอ {parts.length} เพลงย่อย <span style={{color:'var(--muted)',fontWeight:400}}>· ทำนองหลัก {rows.length} วรรค</span>
          </div>
          <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:'0.6rem'}}>
            ตรวจชื่อและช่วงวรรคก่อนกดแยก · ติ๊กออกได้ถ้าไม่อยากแยกเพลงไหน
          </div>

          {problems.length > 0 && (
            <div style={{fontSize:'0.76rem',color:'var(--gold2)',lineHeight:1.8,marginBottom:'0.6rem'}} data-problems>
              {problems.map(x => <div key={x}>⚠ {x}</div>)}
            </div>
          )}

          <div style={{overflowX:'auto'}}>
            <table style={{fontSize:'0.8rem',width:'100%'}}>
              <thead><tr>
                <th style={{width:'34px'}}></th><th>Song ID</th><th>ชื่อเพลงย่อย</th>
                <th style={{width:'80px'}}>วรรคแรก</th><th style={{width:'80px'}}>วรรคท้าย</th>
                <th style={{width:'70px'}}>จำนวน</th><th>ท่อนที่รวมอยู่</th>
              </tr></thead>
              <tbody>
                {parts.map((p, i) => (
                  <tr key={i} data-part={i} style={{opacity: p.take ? 1 : 0.45}}>
                    <td><input type="checkbox" checked={p.take} onChange={e => upd(i, { take: e.target.checked })}
                      style={{accentColor:'var(--gold)',width:'18px',height:'18px'}} /></td>
                    <td><input className="form-input" style={{width:'120px',fontSize:'0.78rem'}} value={p.id}
                      onChange={e => upd(i, { id: e.target.value })} /></td>
                    <td><input className="form-input" style={{minWidth:'150px',fontSize:'0.8rem'}} value={p.name}
                      onChange={e => upd(i, { name: e.target.value })} /></td>
                    <td><input className="form-input" type="number" style={{width:'72px'}} value={p.from}
                      onChange={e => upd(i, { from: +e.target.value })} /></td>
                    <td><input className="form-input" type="number" style={{width:'72px'}} value={p.to}
                      onChange={e => upd(i, { to: +e.target.value })} /></td>
                    <td style={{fontFamily:'monospace',color:'var(--jade)'}}>{Math.max(0, p.to - p.from + 1)}</td>
                    <td style={{fontSize:'0.7rem',color:'var(--muted)'}}>{p.sections.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{display:'flex',gap:'8px',alignItems:'center',marginTop:'0.8rem',flexWrap:'wrap'}}>
            <button className="btn btn-jade" disabled={busy || !taken.length || problems.length > 0} onClick={runSplit}>
              {busy ? 'กำลังแยก…' : `🧩 แยก ${taken.length} เพลง`}
            </button>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => loadSuite(sid)}>↺ เสนอใหม่</button>
            {problems.length > 0 && <span style={{fontSize:'0.74rem',color:'var(--gold2)'}}>แก้ข้อที่เตือนก่อนถึงจะแยกได้</span>}
          </div>

          {log.length > 0 && (
            <div style={{marginTop:'0.8rem',fontSize:'0.78rem',lineHeight:1.9}} data-log>
              {log.map(x => (
                <div key={x.id} style={{color: x.error ? 'var(--danger)' : 'var(--jade)'}}>
                  {x.error ? '✗' : '✓'} {x.id} {x.name} — {x.error ?? `${x.verses} วรรค`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
