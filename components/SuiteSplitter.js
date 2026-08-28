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
import { suggestParts, partIdFor, makePart, unmakePart, listParts, partError,
         suiteReport, reportSummary, fetchMelody, suiteCheck, fixSuiteVerses, checkError, suitePeek } from '../lib/songparts';

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
  const [report, setReport] = useState(null);   // ตรวจข้อมูลในฐาน (sql/31)
  const [instUsed, setInstUsed] = useState(null);
  const [gap, setGap] = useState(null);        // โน้ตในฐานไม่ครบตามที่บันทึกไว้
  const [verify, setVerify] = useState(null);  // อ่านโน้ตของเพลงย่อยได้จริงไหม
  const [dups, setDups] = useState(null);      // ผลตรวจลำดับวรรค (sql/39)
  const [dupErr, setDupErr] = useState('');    // ★ ตรวจไม่ได้ก็ต้องบอก ไม่ใช่เงียบ
  const [peek, setPeek] = useState(null);      // ลำดับจริงในฐาน 14 แถวแรก

  // เพลงที่น่าจะเป็นเพลงเรื่อง — ดูจากประเภท หรือชื่อที่มีคำว่า เรื่อง/ตับ
  useEffect(() => {
    supabase.from('songs').select('id, name_th, type, total_verses, parent_song_id').order('name_th')
      .then(({ data }) => setSuites((data ?? []).filter(s => !s.parent_song_id
        && (/เรื่อง|ตับ/.test(s.type ?? '') || /เรื่อง|ตับ/.test(s.name_th ?? '')))));
  }, []);

  const loadSuite = useCallback(async id => {
    setMsg(''); setErr(''); setLog([]); setRows(null); setParts([]); setDone([]); setGap(null); setVerify(null);
    if (!id) return;
    // ★ ต้องรับแถวที่ instrument เป็น null ด้วย — ข้อมูลนำเข้าจาก Excel หลายแถวไม่ได้ระบุทางไว้
    //   ถ้าใช้ eq('instrument','ทำนองหลัก') เฉย ๆ จะได้วรรคไม่ครบ แล้วแยกเพลงได้ไม่ครบตามไปด้วย
    const { data, error } = await supabase.from('song_melody')
      .select('id, verse_no, section, instrument, part_song_id').eq('song_id', id)
      .or(`instrument.eq.${MAIN},instrument.is.null`).order('verse_no');
    if (error) { setErr('อ่านโน้ตไม่ได้: ' + partError(error.message)); return; }
    const vs = data ?? [];
    setInstUsed([...new Set(vs.map(r => r.instrument ?? '(ไม่ระบุทาง)'))]);
    // ★ ฐานบอกว่าเพลงเรื่องมีกี่วรรค เทียบกับโน้ตที่มีอยู่จริง — ต่างกันมากแปลว่านำเข้ามาไม่ครบ
    const meta = suites.find(x => x.id === id);
    setGap(meta?.total_verses && meta.total_verses > vs.length
      ? { said: meta.total_verses, got: vs.length } : null);
    setRows(vs);
    setDone(await listParts(id));
    setReport(null);
    setParts(suggestParts(vs).map(p => ({ ...p, id: partIdFor(id, p.partNo), take: true })));
  }, [suites]);

  useEffect(() => { loadSuite(sid); }, [sid, loadSuite]);

  // ★ ตรวจลำดับวรรคทันทีที่เลือกเพลงเรื่อง — ไม่ต้องรอให้กดปุ่มอื่นก่อน
  //   รอบก่อนพลาดตรงนี้: โค้ดตรวจไปอยู่ในปุ่ม "ตรวจข้อมูลในฐาน" แผงเลยไม่เคยขึ้นให้เห็นเลย
  //   Pk เลือกเพลงแล้วไม่เจอปุ่มซ่อม จึงซ่อมไม่ได้สักที (Pk 28 ส.ค. 69)
  useEffect(() => {
    if (!sid) { setDups(null); setDupErr(''); return; }
    let alive = true;
    suiteCheck(sid).then(x => {
      if (!alive) return;
      if (x.error) { setDups(null); setDupErr(checkError(x.error.message)); }
      else { setDups(x.rows); setDupErr(''); }
    });
    suitePeek(sid, 14).then(x => { if (alive) setPeek(x.error ? null : x.rows); });
    return () => { alive = false; };
  }, [sid]);

  const upd = (i, patch) => setParts(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  // ตรวจก่อนแยก — บอกทุกปัญหาพร้อมกัน ไม่ใช่เจอทีละอย่าง
  const taken = parts.filter(p => p.take);
  const problems = [];
  if (rows) {
    const ids = taken.map(p => p.id);
    if (new Set(ids).size !== ids.length) problems.push('Song ID ซ้ำกันเอง');
    if (taken.some(p => !p.name.trim())) problems.push('มีเพลงที่ยังไม่ได้ตั้งชื่อ');
    const blank = taken.filter(p => !p.name.trim());
    if (blank.length) problems.push(`ต้นฉบับเก็บชื่อท่อนไว้แค่ "ท่อน N" ไม่มีชื่อเพลง — `
      + `พิมพ์ชื่อเพลงเองอีก ${blank.length} ช่อง (วรรค ` + blank.map(p => `${p.from}–${p.to}`).join(', ') + ')');
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
    const bad = out.filter(x => x.error);
    if (bad.length) setErr(`แยกไม่สำเร็จ ${bad.length} เพลง — ดูรายละเอียดข้างล่าง`);
    else setMsg(`✓ แยกครบ ${out.length} เพลง · รวม ${out.reduce((n, x) => n + x.verses, 0)} วรรค`);
    setDone(await listParts(sid));
    // ── พิสูจน์ว่าเปิดเพลงย่อยแล้วอ่านโน้ตได้จริง ──
    //   ตรวจจากที่นี่ เพราะไฟล์นี้อัพผ่าน GitHub ได้ตามปกติ
    //   ถ้าตรงนี้บอกว่าอ่านได้ แต่หน้าเพลงยังว่าง = ไฟล์ของหน้าเพลงยังไม่ถูกวางทับ
    const vf = [];
    for (const p of taken.filter(x => !out.find(o => o.id === x.id)?.error)) {
      const { rows, error } = await fetchMelody(p.id, { instrument: 'ทำนองหลัก' });
      vf.push({ id: p.id, name: p.name, n: rows.length, error: error ? partError(error.message) : null });
    }
    setVerify(vf);
    setBusy(false);
  }

  async function repair() {
    setBusy(true); setErr(''); setMsg('');
    const { rows: r, error } = await fixSuiteVerses(sid);
    setBusy(false);
    if (error) { setErr(partError(error.message)); return; }
    const n = (r ?? []).reduce((a, x) => a + Number(x.fixed ?? 0), 0);
    setMsg(n > 0
      ? `✓ เรียงลำดับวรรคใหม่แล้ว ${n} วรรค — เปิดหน้าเพลงเรื่องดูได้เลย`
      : '✓ ตรวจแล้ว ลำดับถูกต้องอยู่แล้ว ไม่มีอะไรต้องแก้');
    suitePeek(sid, 14).then(x => setPeek(x.error ? null : x.rows));
    suiteCheck(sid).then(x => {
              if (x.error) { setDups(null); setDupErr(checkError(x.error.message)); }
              else { setDups(x.rows); setDupErr(''); }
            });
  }

  return (
    <div className="card" data-splitter>
      <div style={{fontWeight:600,marginBottom:'0.3rem'}}>🧩 แยกเพลงย่อยจากเพลงเรื่อง</div>
      <div style={{fontSize:'0.74rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'0.9rem'}}>
        เพลงย่อยจะขึ้นในคลังเหมือนเพลงทั่วไป มีหน้าเพลงของตัวเอง เล่นได้ พิมพ์ได้<br />
        <b style={{color:'var(--gold2)'}}>โน้ตไม่ถูกคัดลอก</b> — ยังเป็นชุดเดียวที่เพลงเรื่อง
        แก้ที่เพลงย่อยหรือที่เพลงเรื่องก็คือแถวเดียวกัน ไม่มีทางไม่ตรงกัน
      </div>

      {/* ★ ตรวจไม่ได้ = ต้องบอก ไม่ใช่ไม่แสดงอะไรเลย
          รอบก่อนพลาดตรงนี้: ยังไม่ได้รัน sql แล้วแผงหายไปทั้งแผง Pk เลยไม่มีปุ่มให้กด */}
      {sid && dupErr && (
        <div data-duperr style={{border:'1px solid var(--gold)',borderRadius:'8px',
          padding:'0.8rem 1rem',marginBottom:'0.9rem',fontSize:'0.82rem',lineHeight:1.8}}>
          <div style={{color:'var(--gold2)',fontWeight:600}}>ตรวจลำดับวรรคไม่ได้</div>
          <div style={{color:'var(--muted)'}}>{dupErr}</div>
        </div>
      )}

      {/* ── ลำดับวรรคของเพลงเรื่อง (sql/39) ── */}
      {sid && dups && (
        <div data-suiteorder style={{border:'1px solid ' + (dups.some(d => +d.misordered > 0) ? 'var(--danger)' : 'var(--border)'),
          borderRadius:'8px',padding:'0.8rem 1rem',marginBottom:'0.9rem',fontSize:'0.82rem',lineHeight:1.8}}>
          {dups.some(d => +d.misordered > 0) ? (
            <>
              <div style={{color:'var(--danger)',fontWeight:600}}>⚠ ลำดับวรรคของเพลงเรื่องนี้ผิด</div>
              <div style={{color:'var(--muted)'}}>
                เกิดจากการบันทึกที่หน้าเพลงย่อยรุ่นก่อน แล้วเลขวรรคของเพลงย่อยไปทับเลขของเพลงเรื่อง
                เปิดหน้าเพลงเรื่องจะเห็นท่อนละวรรคเดียวสลับกันไปมา — <b>ตัวโน้ตไม่ได้หายไปไหน แค่เรียงผิด</b>
              </div>
            </>
          ) : (
            <div style={{color:'var(--jade)',fontWeight:600}}>✓ ลำดับวรรคของเพลงเรื่องนี้เรียบร้อยดี</div>
          )}
          <div style={{marginTop:'0.5rem',overflowX:'auto'}}>
            <table style={{fontSize:'0.76rem',borderCollapse:'collapse',minWidth:'380px'}}>
              <thead><tr style={{color:'var(--muted)'}}>
                <th style={{textAlign:'left',padding:'2px 12px 2px 0'}}>ทาง</th>
                <th style={{textAlign:'right',padding:'2px 12px 2px 0'}}>วรรคทั้งหมด</th>
                <th style={{textAlign:'right',padding:'2px 12px 2px 0'}}>อยู่ผิดที่</th>
                <th style={{textAlign:'right',padding:'2px 12px 2px 0'}}>เลขซ้ำ</th>
                <th style={{textAlign:'right',padding:'2px 12px 2px 0'}}>เพลงย่อย</th>
                <th style={{textAlign:'right',padding:'2px 0'}}>ไม่อยู่ในเพลงย่อย</th>
              </tr></thead>
              <tbody>
                {dups.map(d => (
                  <tr key={d.instrument}>
                    <td style={{padding:'2px 12px 2px 0'}}>{d.instrument}</td>
                    <td style={{textAlign:'right',padding:'2px 12px 2px 0',fontFamily:'monospace'}}>{d.rows_n}</td>
                    <td style={{textAlign:'right',padding:'2px 12px 2px 0',fontFamily:'monospace',
                      color:+d.misordered > 0 ? 'var(--danger)' : 'var(--jade)'}}>{d.misordered}</td>
                    <td style={{textAlign:'right',padding:'2px 12px 2px 0',fontFamily:'monospace'}}>{d.dups}</td>
                    <td style={{textAlign:'right',padding:'2px 12px 2px 0',fontFamily:'monospace'}}>{d.parts_n}</td>
                    <td style={{textAlign:'right',padding:'2px 0',fontFamily:'monospace'}}>{d.unclaimed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* ★★ ของจริงในฐาน 14 วรรคแรก — ไม่ต้องเดากันอีก
              "ควรเป็น" ต่างจาก "ตอนนี้" เมื่อไหร่ = ลำดับผิดตรงนั้น */}
          {peek?.length > 0 && (
            <div data-suitepeek style={{marginTop:'0.7rem'}}>
              <div style={{fontSize:'0.76rem',color:'var(--muted)',marginBottom:'0.25rem'}}>
                ลำดับจริงในฐาน (14 วรรคแรก ทางทำนองหลัก)
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{fontSize:'0.72rem',borderCollapse:'collapse',minWidth:'520px'}}>
                  <thead><tr style={{color:'var(--muted)'}}>
                    <th style={{textAlign:'right',padding:'2px 8px 2px 0'}}>ที่</th>
                    <th style={{textAlign:'right',padding:'2px 8px 2px 0'}}>เลขวรรค</th>
                    <th style={{textAlign:'right',padding:'2px 8px 2px 0'}}>ควรเป็น</th>
                    <th style={{textAlign:'left',padding:'2px 8px 2px 0'}}>ชื่อท่อน</th>
                    <th style={{textAlign:'left',padding:'2px 8px 2px 0'}}>เพลงย่อย</th>
                    <th style={{textAlign:'right',padding:'2px 0'}}>ลำดับเพลงย่อย</th>
                  </tr></thead>
                  <tbody>
                    {peek.map(r => {
                      const bad = String(r.verse_no) !== String(r.want_no);
                      return (
                        <tr key={r.row_id} style={{color: bad ? 'var(--danger)' : 'inherit'}}>
                          <td style={{textAlign:'right',padding:'2px 8px 2px 0',fontFamily:'monospace'}}>{r.pos}</td>
                          <td style={{textAlign:'right',padding:'2px 8px 2px 0',fontFamily:'monospace'}}>{r.verse_no}</td>
                          <td style={{textAlign:'right',padding:'2px 8px 2px 0',fontFamily:'monospace'}}>{r.want_no}</td>
                          <td style={{padding:'2px 8px 2px 0'}}>{r.section}</td>
                          <td style={{padding:'2px 8px 2px 0',fontFamily:'monospace'}}>{r.part_song_id ?? '—'}</td>
                          <td style={{textAlign:'right',padding:'2px 0',fontFamily:'monospace',
                            color: r.part_song_id && r.part_no == null ? 'var(--danger)' : 'inherit'}}>
                            {r.part_no ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:'0.25rem'}}>
                แถวสีแดง = วรรคนั้นอยู่ผิดที่ · ช่อง "ลำดับเพลงย่อย" เป็น — ทั้งที่มีเพลงย่อย = ต้องแยกเพลงใหม่
              </div>
            </div>
          )}

          {/* ★ ปุ่มอยู่ตลอด ไม่ใช่โผล่เฉพาะตอนตรวจเจอ — ซ่อมซ้ำไม่ทำอะไรเสียหาย */}
          <button className={'btn btn-sm ' + (dups.some(d => +d.misordered > 0) ? 'btn-primary' : 'btn-outline')}
            disabled={busy} onClick={repair} style={{marginTop:'0.5rem'}}>
            🔧 เรียงลำดับวรรคใหม่ให้ถูกต้อง
          </button>
        </div>
      )}

      <select className="form-input" style={{maxWidth:'480px'}} value={sid} onChange={e => setSid(e.target.value)}>
        <option value="">— เลือกเพลงเรื่อง —</option>
        {suites.map(s => <option key={s.id} value={s.id}>{s.id} · {s.name_th} ({s.total_verses ?? '?'} วรรค)</option>)}
      </select>

      {sid && (
        <div style={{display:'flex',gap:'8px',alignItems:'center',marginTop:'0.6rem',flexWrap:'wrap'}}>
          <button className="btn btn-outline btn-sm" disabled={busy} onClick={async () => {
            setBusy(true); setErr('');
            suiteCheck(sid).then(x => {
              if (x.error) { setDups(null); setDupErr(checkError(x.error.message)); }
              else { setDups(x.rows); setDupErr(''); }
            });
            const { rows: rr, error } = await suiteReport(sid);
            setBusy(false);
            if (error) { setErr('ตรวจไม่ได้: ' + partError(error.message)); setReport(null); return; }
            setReport(rr);
          }}>🔍 ตรวจข้อมูลในฐาน</button>
          {instUsed && <span style={{fontSize:'0.72rem',color:'var(--muted)'}}>
            ทางที่พบ: {instUsed.join(' · ')}</span>}
          {report && <button className="btn btn-outline btn-sm" onClick={() => setReport(null)}>ปิด</button>}
        </div>
      )}

      {report && (
        <div style={{marginTop:'0.7rem'}} data-report>
          <div style={{fontSize:'0.76rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'0.4rem'}}>
            นี่คือ<b style={{color:'var(--gold2)'}}>ชื่อท่อนตามต้นฉบับในฐาน</b> ไม่ได้ผ่านการตัดคำใด ๆ
            — ใช้ตัดสินใจว่าจะแยกตรงไหน
          </div>
          {reportSummary(report).map(x => (
            <div key={x.instrument} style={{fontSize:'0.76rem',color:'var(--jade)'}}>
              ทาง{x.instrument}: {x.verses} วรรค · {x.groups} ท่อน · อนุมัติแล้ว {x.approved} ·
              แยกไปแล้ว {x.claimed}{x.noName > 0 && <span style={{color:'var(--danger)'}}> · ไม่มีชื่อท่อน {x.noName} วรรค</span>}
            </div>
          ))}
          <div style={{maxHeight:'320px',overflow:'auto',marginTop:'0.5rem',border:'1px solid var(--border)',borderRadius:'6px'}}>
            <table style={{fontSize:'0.76rem',width:'100%'}}>
              <thead><tr><th>#</th><th>ชื่อท่อนตามต้นฉบับ</th><th>ทาง</th><th>วรรค</th><th>จำนวน</th><th>แยกแล้ว</th></tr></thead>
              <tbody>
                {report.map(r => (
                  <tr key={`${r.instrument}-${r.seq}`} data-rep={r.seq}>
                    <td style={{color:'var(--muted)'}}>{r.seq}</td>
                    <td>{r.section ?? <span style={{color:'var(--danger)'}}>(ต้นฉบับไม่ได้บันทึกชื่อท่อน)</span>}</td>
                    <td style={{color:'var(--muted)',fontSize:'0.7rem'}}>{r.instrument}</td>
                    <td style={{fontFamily:'monospace'}}>{r.verse_from}–{r.verse_to}</td>
                    <td style={{fontFamily:'monospace',color:'var(--jade)'}}>{r.verses}</td>
                    <td style={{fontSize:'0.7rem',color:'var(--muted)'}}>{r.part_song_id ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            เสนอ {parts.length} เพลงย่อย <span style={{color:'var(--muted)',fontWeight:400}}>· ทำนองหลัก {rows.length} วรรค</span>
          </div>
          {gap && (
            <div data-gap style={{margin:'0.4rem 0',padding:'0.6rem 0.8rem',borderRadius:'8px',
              background:'rgba(212,122,143,0.10)',border:'1px solid var(--danger)',fontSize:'0.8rem',lineHeight:1.8}}>
              ⚠ <b>โน้ตในฐานไม่ครบ</b> — ข้อมูลเพลงบันทึกไว้ว่า {gap.said} วรรค
              แต่มีโน้ตจริงแค่ {gap.got} วรรค <b style={{color:'var(--danger)'}}>ขาดไป {gap.said - gap.got} วรรค</b>
              <div style={{fontSize:'0.74rem',color:'var(--muted)'}}>
                แยกได้เฉพาะส่วนที่มีโน้ตจริง · ส่วนที่ขาดต้องนำเข้าโน้ตเพิ่มก่อน
              </div>
            </div>
          )}
          <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:'0.6rem'}}>
            ตรวจชื่อและช่วงวรรคก่อนกดแยก · ติ๊กออกได้ถ้าไม่อยากแยกเพลงไหน<br />
            คอลัมน์ขวาสุดคือ<b style={{color:'var(--gold2)'}}>ชื่อท่อนตามต้นฉบับ</b> — ชื่อนี้จะถูกเก็บไว้ทั้งดุ้น
            ทั้งในเพลงเรื่องและในเพลงย่อย ไม่ถูกตัดคำ
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
                    <td style={{fontSize:'0.7rem',color:'var(--muted)'}}>
                      {p.sections.filter(Boolean).join(' · ') || <span style={{color:'var(--danger)'}}>(ต้นฉบับไม่ได้บันทึกชื่อท่อน)</span>}
                      {p.thons.length > 0 && <span style={{color:'var(--jade)'}}> · ท่อน {p.thons.join(',')}</span>}
                    </td>
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

          {verify && (
            <div style={{marginTop:'0.8rem',padding:'0.6rem 0.8rem',borderRadius:'8px',fontSize:'0.8rem',lineHeight:1.9,
              background: verify.every(v => v.n > 0) ? 'rgba(76,154,132,0.10)' : 'rgba(212,122,143,0.10)',
              border: '1px solid ' + (verify.every(v => v.n > 0) ? 'var(--jade)' : 'var(--danger)')}} data-verify>
              <b>ตรวจซ้ำ: เปิดเพลงย่อยแล้วอ่านโน้ตได้จริงไหม</b>
              {verify.map(v => (
                <div key={v.id} style={{color: v.n > 0 ? 'var(--jade)' : 'var(--danger)'}}>
                  {v.n > 0 ? '✓' : '✗'} {v.id} {v.name} — {v.error ?? `${v.n} วรรค`}
                </div>
              ))}
              {verify.every(v => v.n > 0) && (
                <div style={{fontSize:'0.74rem',color:'var(--muted)',marginTop:'4px'}}>
                  ข้อมูลผูกเรียบร้อยแล้ว · <b style={{color:'var(--gold2)'}}>ถ้าเปิดหน้าเพลงย่อยแล้วยังไม่เห็นโน้ต
                  และไม่เห็นป้าย 🧩 ที่หัวเพลง</b> แปลว่าไฟล์ <code>app/songs/[id]/SongDetailClient.js</code>
                  ยังไม่ได้ถูกวางทับ — หน้านั้นยังอ่านแบบเดิมอยู่ จึงหาโน้ตไม่เจอ
                </div>
              )}
            </div>
          )}

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
