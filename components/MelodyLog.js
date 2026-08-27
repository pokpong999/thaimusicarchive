'use client';
// components/MelodyLog.js — แผงดูประวัติการแก้โน้ต  (Pk 27 ส.ค. 69)
//
//   ใช้ตอนแอดมินหลายคนช่วยกันตรวจทาน จะได้เห็นว่าใครแก้อะไรไปแล้วบ้าง
//   และย้อนกลับได้ถ้าแก้ผิด
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ACTION, loadLog, revertMelody, diffLines, logError } from '../lib/melodylog';

const fmt = t => { const d = new Date(t); return isNaN(d) ? '' :
  d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

export default function MelodyLog() {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [songNames, setSongNames] = useState({});
  const [song, setSong] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setErr('');
    const { rows: r, error } = await loadLog({ songId: song || null, limit: 200 });
    if (error) { setErr(logError(error.message)); setRows([]); return; }
    setRows(r);
    const uids = [...new Set(r.map(x => x.changed_by).filter(Boolean))];
    if (uids.length) {
      const { data } = await supabase.from('profiles').select('id, display_name').in('id', uids);
      const m = {}; (data ?? []).forEach(p => { m[p.id] = p.display_name; }); setNames(n => ({ ...n, ...m }));
    }
    const sids = [...new Set(r.map(x => x.song_id).filter(Boolean))];
    if (sids.length) {
      const { data } = await supabase.from('songs').select('id, name_th').in('id', sids);
      const m = {}; (data ?? []).forEach(s => { m[s.id] = s.name_th; }); setSongNames(n => ({ ...n, ...m }));
    }
  }, [song]);
  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="card" data-melodylog>
      <div style={{fontWeight:600,marginBottom:'0.3rem'}}>📝 ประวัติการแก้โน้ต</div>
      <div style={{fontSize:'0.74rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'0.8rem'}}>
        ฐานข้อมูลจดให้อัตโนมัติทุกครั้งที่โน้ตเปลี่ยน — ไม่ว่าจะแก้จากหน้าไหน หรือจากสคริปต์นำเข้า<br />
        เก็บค่าก่อนแก้ไว้ด้วย จึงกดย้อนกลับได้ · เห็นเฉพาะผู้ดูแล
      </div>

      <div style={{display:'flex',gap:'8px',marginBottom:'0.8rem',flexWrap:'wrap'}}>
        <input className="form-input" style={{maxWidth:'220px'}} placeholder="กรองด้วย Song ID เช่น JJT001"
          value={song} onChange={e => setSong(e.target.value.trim())} />
        <button className="btn btn-outline btn-sm" onClick={reload}>↻ โหลดใหม่</button>
        <span style={{fontSize:'0.76rem',color:'var(--muted)',alignSelf:'center'}}>{rows.length} รายการล่าสุด</span>
      </div>

      {err && <div style={{fontSize:'0.8rem',color:'var(--danger)',marginBottom:'0.6rem'}}>⚠ {err}</div>}
      {msg && <div style={{fontSize:'0.8rem',color:'var(--jade)',marginBottom:'0.6rem'}}>{msg}</div>}
      {!err && rows.length === 0 && (
        <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>ยังไม่มีการแก้โน้ตที่บันทึกไว้</div>
      )}

      <div style={{maxHeight:'520px',overflow:'auto'}}>
        {rows.map(r => {
          const a = ACTION[r.action] ?? ACTION.update;
          const lines = diffLines(r);
          return (
            <div key={r.id} data-log={r.id} style={{padding:'7px 0',borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'baseline',flexWrap:'wrap',fontSize:'0.8rem'}}>
                <span style={{color:a.color,fontWeight:600}}>{a.icon} {a.label}</span>
                <span className="song-id">{r.song_id}</span>
                <span>{songNames[r.song_id] ?? ''}</span>
                <span style={{color:'var(--muted)'}}>ว.{r.verse_no}{r.section ? ' · ' + r.section : ''}</span>
                <span style={{marginLeft:'auto',color:'var(--muted)',fontSize:'0.72rem'}}>
                  {r.changed_by ? (names[r.changed_by] ?? 'ผู้ดูแล') : 'ระบบ/นำเข้า'} · {fmt(r.changed_at)}
                </span>
              </div>
              {lines.map(l => (
                <div key={l.key} style={{fontSize:'0.74rem',marginLeft:'14px',lineHeight:1.7}}>
                  <span style={{color:'var(--muted)'}}>{l.name}: </span>
                  <span style={{color:'var(--danger)',fontFamily:'monospace'}}>{l.before ?? '(ว่าง)'}</span>
                  <span style={{color:'var(--muted)'}}> → </span>
                  <span style={{color:'var(--jade)',fontFamily:'monospace'}}>{l.after ?? '(ว่าง)'}</span>
                </div>
              ))}
              {r.before && (
                <button className="btn btn-outline btn-sm" disabled={busy}
                  style={{marginTop:'4px',marginLeft:'14px',fontSize:'0.72rem',minHeight:'28px'}}
                  onClick={async () => {
                    if (!confirm(`ย้อนวรรค ${r.verse_no} ของ ${r.song_id} กลับเป็นค่าก่อนแก้?`)) return;
                    setBusy(true); setMsg(''); setErr('');
                    const { msg: m, error } = await revertMelody(r.id);
                    setBusy(false);
                    if (error) { setErr(logError(error.message)); return; }
                    setMsg('✓ ' + m); reload();
                  }}>↩ ย้อนวรรคนี้กลับ</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
