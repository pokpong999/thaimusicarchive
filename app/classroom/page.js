'use client';
// app/classroom/page.js — ห้องเรียน   Pk 27 ส.ค. 69
//   ครู:      สร้างห้อง แจกรหัส อนุมัติคนเข้า สั่งงาน และดูตารางว่าใครส่งแล้ว ใครยังไม่ส่ง
//   นักเรียน: กรอกรหัสเข้าห้อง (รอครูอนุมัติ) แล้วดูงานที่ครูสั่งพร้อมสถานะของตัวเอง
//   นักเรียนไม่เห็นรายชื่อหรือผลงานของเพื่อนร่วมห้อง — กติกาบังคับที่ชั้นฐานข้อมูล (sql/26)
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMe } from '../../components/Gate';
import Avatar from '../../components/Avatar';
import { fmtDT, fmtDate } from '../../lib/fmtdate';
import {
  MEMBER_STATUS, cellOf, friendly, myClasses, createClass, regenCode, setClassOpen, archiveClass, pendingCounts,
  classMembers, decideMember, removeMember, setSeatNo, listAssignments, createAssignment,
  closeAssignment, deleteAssignment, classProgress, assignmentCounts, toGrid,
  joinClass, myMemberships, leaveClass, myAssignments, dueText,
} from '../../lib/classroom';

export default function ClassroomPage() {
  const me = useMe();
  const isTeacher = me.isTeacher || me.isAdmin;

  if (me.loading) return <main className="container" style={{paddingTop:'3rem',textAlign:'center',color:'var(--muted)'}}>กำลังโหลด…</main>;
  if (!me.user) return (
    <main className="container" style={{maxWidth:'480px'}}>
      <div className="lock-box">
        <div style={{marginBottom:'1rem'}}>เข้าสู่ระบบเพื่อใช้ห้องเรียน</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ / สมัคร</button></Link>
      </div>
    </main>
  );

  return (
    <main className="container" style={{maxWidth:'1000px'}}>
      <div className="section-title">ห้องเรียน</div>
      <div className="section-subtitle">
        {isTeacher
          ? 'สร้างห้อง แจกรหัสให้นักเรียนกรอก สั่งงานเป็นชิ้น ๆ แล้วดูได้ทันทีว่าใครส่งแล้ว ใครยังไม่ส่ง'
          : 'กรอกรหัสห้องที่ครูให้มา รอครูรับเข้าห้อง แล้วส่งงานตามที่ครูสั่งได้เลย'}
      </div>
      {isTeacher ? <TeacherView me={me} /> : <StudentView me={me} />}
    </main>
  );
}

/* ─────────────────────────── ฝั่งครู ─────────────────────────── */
function TeacherView({ me }) {
  const [classes, setClasses] = useState([]);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [waiting, setWaiting] = useState(new Map());
  const load = useCallback(async () => {
    const { rows, error } = await myClasses(me.user.id);
    if (error) setErr(friendly(error)); else setErr('');
    setClasses(rows);
    // จำนวนคนรออนุมัติต้องเห็นตั้งแต่ยังไม่เปิดห้อง ไม่งั้นครูไม่รู้ว่ามีคนรออยู่
    const { counts } = await pendingCounts(rows.map(r => r.id));
    setWaiting(counts);
  }, [me.user.id]);
  useEffect(() => { load(); }, [load]);

  async function make() {
    if (!name.trim()) { setMsg('⚠ ตั้งชื่อห้องก่อน'); return; }
    setBusy(true);
    const { code, error } = await createClass(name, detail);
    setBusy(false);
    if (error) { setMsg('⚠ ' + friendly(error)); return; }
    setMsg(`✓ สร้างห้อง "${name}" แล้ว — รหัสห้องคือ ${code} เอาไปให้นักเรียนกรอก`);
    setName(''); setDetail('');
    load();
  }

  return (
    <>
      {err && <div className="card" style={{borderColor:'var(--danger)',color:'var(--danger)',fontSize:'0.85rem'}}>{err}</div>}

      <div className="card" style={{marginBottom:'1.2rem'}}>
        <div style={{fontWeight:600,fontSize:'0.92rem',marginBottom:'0.7rem'}}>➕ เปิดห้องเรียนใหม่</div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <input className="form-input" style={{flex:'1 1 220px'}} value={name} onChange={e => setName(e.target.value)}
            placeholder="ชื่อห้อง เช่น ปี่พาทย์ ม.4/1" />
          <input className="form-input" style={{flex:'1 1 220px'}} value={detail} onChange={e => setDetail(e.target.value)}
            placeholder="รายละเอียด เช่น เรียนทุกวันพุธ บ่ายสองโมง" />
          <button className="btn btn-jade" onClick={make} disabled={busy}>สร้างห้อง</button>
        </div>
        {msg && <div style={{marginTop:'0.7rem',fontSize:'0.83rem',color:'var(--jade)'}}>{msg}</div>}
      </div>

      {classes.length === 0 && !err && (
        <div className="card" style={{textAlign:'center',padding:'2rem',color:'var(--muted)'}}>
          <div style={{fontSize:'2rem'}}>🏫</div>
          <div style={{marginTop:'0.6rem',fontSize:'0.88rem'}}>ยังไม่มีห้องเรียน — เปิดห้องแรกได้ที่ช่องด้านบน</div>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {classes.map(c => (
          <ClassCard key={c.id} cls={c} waiting={waiting.get(c.id) ?? 0} open={openId === c.id}
            onToggle={() => setOpenId(openId === c.id ? null : c.id)} onChanged={load} />
        ))}
      </div>
    </>
  );
}

function ClassCard({ cls, waiting = 0, open, onToggle, onChanged }) {
  // มีคนรออนุมัติอยู่ → เปิดห้องมาที่แท็บรายชื่อเลย จะได้กดรับเข้าห้องได้ทันที
  const [tab, setTab] = useState(waiting > 0 ? 'members' : 'progress');
  const [members, setMembers] = useState([]);
  const [asg, setAsg] = useState([]);
  const [grid, setGrid] = useState({ students: [], assignments: [] });
  const [counts, setCounts] = useState(new Map());
  const [code, setCode] = useState(cls.code);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [aTitle, setATitle] = useState('');
  const [aBrief, setABrief] = useState('');
  const [aDue, setADue] = useState('');

  const refresh = useCallback(async () => {
    const [m, a, p, k] = await Promise.all([
      classMembers(cls.id), listAssignments(cls.id), classProgress(cls.id), assignmentCounts(cls.id),
    ]);
    setMembers(m.rows ?? []);
    setAsg(a.rows ?? []);
    setGrid(toGrid(p.rows ?? []));
    setCounts(k.counts ?? new Map());
  }, [cls.id]);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const pending = members.filter(m => m.status === 'pending');
  const approved = members.filter(m => m.status === 'approved');

  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setNote('คัดลอกรหัสแล้ว'); }
    catch (e) { setNote('คัดลอกไม่ได้ — จดรหัส ' + code + ' ไปเอง'); }
  }
  async function newCode() {
    if (!confirm('เปลี่ยนรหัสห้อง?\n\nคนที่อยู่ในห้องแล้วไม่กระทบ แต่รหัสเดิมจะใช้เข้าห้องไม่ได้อีก')) return;
    setBusy(true);
    const { code: c, error } = await regenCode(cls.id);
    setBusy(false);
    if (error) { setNote('⚠ ' + friendly(error)); return; }
    setCode(c); setNote('เปลี่ยนรหัสใหม่แล้ว');
  }
  async function decide(id, ok) {
    setBusy(true); await decideMember(id, ok); setBusy(false);
    refresh(); onChanged();     // ให้ตัวเลข "รออนุมัติ" ที่หน้ารายการลดลงด้วย
  }
  async function addAssignment() {
    if (!aTitle.trim()) { setNote('⚠ ตั้งชื่องานก่อน'); return; }
    setBusy(true);
    const { error } = await createAssignment(cls.id, { title: aTitle, brief: aBrief, dueAt: aDue || null });
    setBusy(false);
    if (error) { setNote('⚠ ' + friendly(error)); return; }
    setATitle(''); setABrief(''); setADue(''); setNote('สั่งงานแล้ว'); refresh();
  }

  return (
    <div className="card">
      <div style={{display:'flex',gap:'12px',alignItems:'flex-start',flexWrap:'wrap'}}>
        <div style={{flex:'1 1 220px',minWidth:0}}>
          <div style={{fontWeight:600,fontSize:'1rem'}}>{cls.name}</div>
          {cls.detail && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>{cls.detail}</div>}
          <div style={{fontSize:'0.74rem',color:'var(--muted)',marginTop:'2px'}}>
            เปิดเมื่อ {fmtDate(cls.created_at)}
            {!cls.is_open && <span style={{color:'var(--danger)'}}> · ปิดรับสมาชิกใหม่</span>}
          </div>
        </div>
        <div style={{flex:'0 0 auto',textAlign:'right'}}>
          <div style={{fontSize:'0.68rem',color:'var(--muted)',letterSpacing:'0.1em'}}>รหัสห้อง</div>
          <div style={{fontFamily:'monospace',fontSize:'1.5rem',fontWeight:700,color:'var(--gold)',letterSpacing:'0.12em'}}>{code}</div>
          <div style={{display:'flex',gap:'6px',marginTop:'4px',flexWrap:'wrap',justifyContent:'flex-end'}}>
            <button className="btn btn-outline btn-sm" onClick={copyCode}>⧉ คัดลอก</button>
            <button className="btn btn-outline btn-sm" onClick={newCode} disabled={busy}>↻ รหัสใหม่</button>
          </div>
        </div>
      </div>

      <div style={{display:'flex',gap:'8px',marginTop:'0.9rem',flexWrap:'wrap',alignItems:'center'}}>
        <button className="btn btn-jade btn-sm" onClick={onToggle}>
          {open ? 'ปิด' : '📋 เปิดห้อง'}
        </button>
        {(open ? pending.length : waiting) > 0 && (
          <button className="btn btn-primary btn-sm"
            onClick={() => { setTab('members'); if (!open) onToggle(); }}>
            ⏳ มี {open ? pending.length : waiting} คนขอเข้าห้อง — ดูรายชื่อ
          </button>
        )}
        {open && (
          <>
            <button className="btn btn-outline btn-sm" onClick={async () => { await setClassOpen(cls.id, !cls.is_open); onChanged(); }}>
              {cls.is_open ? '🔒 ปิดรับสมาชิกใหม่' : '🔓 เปิดรับสมาชิกใหม่'}
            </button>
            <button className="btn btn-danger btn-sm"
              onClick={async () => { if (confirm(`เก็บห้อง "${cls.name}" เข้ากรุ?\n\nงานทั้งหมดยังอยู่ แต่ห้องจะไม่ขึ้นในรายการอีก`)) { await archiveClass(cls.id); onChanged(); } }}>
              เก็บเข้ากรุ
            </button>
          </>
        )}
      </div>

      {open && (
        <div style={{marginTop:'1rem',borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
          <div className="tab-row" style={{display:'flex',gap:'8px',marginBottom:'1rem',flexWrap:'wrap'}}>
            {[['progress', '📊 ตารางส่งงาน'], ['assign', '📝 งานที่สั่ง (' + asg.length + ')'],
              ['members', '👥 รายชื่อ (' + approved.length + (pending.length ? ' · ' + pending.length + ' รอ' : '') + ')']].map(([k, label]) => (
              <button key={k} className={'btn btn-sm ' + (tab === k ? 'btn-jade' : 'btn-outline')} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>

          {tab === 'progress' && <ProgressGrid grid={grid} />}

          {tab === 'assign' && (
            <>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'1rem'}}>
                <input className="form-input" style={{flex:'1 1 200px'}} value={aTitle} onChange={e => setATitle(e.target.value)}
                  placeholder="ชื่องาน เช่น แขกบรเทศ ท่อน 1" />
                <input className="form-input" style={{flex:'1 1 200px'}} value={aBrief} onChange={e => setABrief(e.target.value)}
                  placeholder="โจทย์ เช่น ถอดเป็นทางระนาดเอก" />
                <input className="form-input" type="date" style={{flex:'0 1 170px'}} value={aDue} onChange={e => setADue(e.target.value)} />
                <button className="btn btn-jade btn-sm" onClick={addAssignment} disabled={busy}>สั่งงาน</button>
              </div>
              {asg.length === 0 && <div style={{fontSize:'0.82rem',color:'var(--muted)'}}>ยังไม่ได้สั่งงาน</div>}
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {asg.map(a => {
                  const k = counts.get(a.id);
                  return (
                    <div key={a.id} style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',
                                            padding:'10px 12px',background:'var(--navy3)',borderRadius:'8px'}}>
                      <div style={{flex:'1 1 180px',minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:'0.88rem'}}>{a.title}</div>
                        {a.brief && <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{a.brief}</div>}
                        {a.due_at && <div style={{fontSize:'0.73rem',color:'var(--gold2)'}}>กำหนดส่ง {fmtDate(a.due_at)} · {dueText(a.due_at)}</div>}
                      </div>
                      <div style={{fontFamily:'monospace',fontSize:'0.82rem',whiteSpace:'nowrap'}}>
                        <span style={{color:'var(--jade)'}}>{k?.submitted ?? 0}</span>
                        <span style={{color:'var(--muted)'}}> / {k?.total ?? approved.length} ส่งแล้ว</span>
                        {k?.graded ? <span style={{color:'var(--muted)'}}> · ตรวจ {k.graded}</span> : null}
                      </div>
                      <button className="btn btn-danger btn-sm"
                        onClick={async () => { if (confirm(`ลบงาน "${a.title}"?\n\nงานที่นักเรียนส่งมาแล้วยังอยู่ แต่จะหลุดจากชิ้นนี้`)) { await deleteAssignment(a.id); refresh(); } }}>
                        ลบ
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'members' && (
            <>
              {pending.length > 0 && (
                <div style={{marginBottom:'1rem'}}>
                  <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',marginBottom:'0.5rem'}}>
                    <div style={{fontWeight:600,fontSize:'0.86rem',color:'var(--gold)'}}>⏳ ขอเข้าห้อง ({pending.length})</div>
                    {pending.length > 1 && (
                      <button className="btn btn-jade btn-sm" disabled={busy}
                        onClick={async () => {
                          if (!confirm(`รับทั้ง ${pending.length} คนเข้าห้อง "${cls.name}"?`)) return;
                          setBusy(true);
                          for (const m of pending) await decideMember(m.id, true);
                          setBusy(false); refresh(); onChanged();
                        }}>✓ รับทั้งหมด {pending.length} คน</button>
                    )}
                  </div>
                  {pending.map(m => (
                    <div key={m.id} style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',padding:'7px 0'}}>
                      <Avatar path={m.student?.avatar_url} name={m.student?.display_name} size={28} />
                      <span style={{flex:'1 1 130px',fontSize:'0.87rem'}}>{m.student?.display_name ?? '—'}</span>
                      <span style={{fontSize:'0.72rem',color:'var(--muted)'}}>{fmtDT(m.joined_at)}</span>
                      <button className="btn btn-jade btn-sm" onClick={() => decide(m.id, true)} disabled={busy}>✓ รับเข้าห้อง</button>
                      <button className="btn btn-outline btn-sm" onClick={() => decide(m.id, false)} disabled={busy}>ไม่รับ</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{fontWeight:600,fontSize:'0.86rem',marginBottom:'0.5rem'}}>👥 อยู่ในห้อง ({approved.length})</div>
              {approved.length === 0 && <div style={{fontSize:'0.82rem',color:'var(--muted)'}}>ยังไม่มีใครในห้อง — เอารหัส {code} ไปให้นักเรียนกรอก</div>}
              {approved.map(m => (
                <div key={m.id} style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',padding:'7px 0'}}>
                  <Avatar path={m.student?.avatar_url} name={m.student?.display_name} size={28} />
                  <span style={{flex:'1 1 130px',fontSize:'0.87rem'}}>{m.student?.display_name ?? '—'}</span>
                  <input className="form-input" style={{flex:'0 0 90px',fontSize:'0.78rem'}} defaultValue={m.seat_no ?? ''}
                    placeholder="เลขที่" onBlur={e => setSeatNo(m.id, e.target.value).then(refresh)} />
                  <button className="btn btn-danger btn-sm"
                    onClick={async () => { if (confirm(`เอา ${m.student?.display_name ?? 'คนนี้'} ออกจากห้อง?`)) { await removeMember(m.id); refresh(); } }}>
                    เอาออก
                  </button>
                </div>
              ))}
            </>
          )}

          {note && <div style={{marginTop:'0.8rem',fontSize:'0.8rem',color:'var(--jade)'}}>{note}</div>}
        </div>
      )}
    </div>
  );
}

// ตารางนักเรียน × งาน — ช่องว่าง = ยังไม่ส่ง
function ProgressGrid({ grid }) {
  if (!grid.students.length) return <div style={{fontSize:'0.82rem',color:'var(--muted)'}}>ยังไม่มีนักเรียนในห้อง</div>;
  if (!grid.assignments.length) return <div style={{fontSize:'0.82rem',color:'var(--muted)'}}>ยังไม่ได้สั่งงาน — สั่งงานที่แท็บ "งานที่สั่ง"</div>;

  const missingOf = s => grid.assignments.filter(a => (s.cells.get(a.id)?.status ?? 'missing') === 'missing').length;

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{whiteSpace:'nowrap'}}>นักเรียน</th>
              {grid.assignments.map(a => (
                <th key={a.id} style={{fontSize:'0.72rem',minWidth:'92px'}}>{a.title}</th>
              ))}
              <th style={{whiteSpace:'nowrap'}}>ยังไม่ส่ง</th>
            </tr>
          </thead>
          <tbody>
            {grid.students.map(s => {
              const miss = missingOf(s);
              return (
                <tr key={s.id}>
                  <td style={{whiteSpace:'nowrap',fontSize:'0.85rem'}}>
                    {s.seat ? <span style={{color:'var(--muted)',fontFamily:'monospace',marginRight:'6px'}}>{s.seat}</span> : null}
                    <Link href={`/members/${s.id}`} style={{color:'var(--cream)'}}>{s.name}</Link>
                  </td>
                  {grid.assignments.map(a => {
                    const c = s.cells.get(a.id) ?? { status: 'missing' };
                    const look = cellOf(c.status);
                    return (
                      <td key={a.id} style={{textAlign:'center',color:look.color,fontSize:'0.8rem',whiteSpace:'nowrap'}}
                        title={`${s.name} · ${a.title} · ${look.label}${c.grade ? ' · ' + c.grade : ''}`}>
                        {look.icon} {look.label}
                        {c.grade && <div style={{fontSize:'0.7rem',fontFamily:'monospace'}}>{c.grade}</div>}
                      </td>
                    );
                  })}
                  <td style={{textAlign:'center',fontFamily:'monospace',
                              color: miss ? 'var(--danger)' : 'var(--jade)'}}>{miss}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'0.6rem'}}>
        เปิดตรวจงานทีละชิ้นได้ที่หน้า <Link href="/homework" style={{color:'var(--gold)'}}>การบ้าน</Link>
      </div>
    </>
  );
}

/* ───────────────────────── ฝั่งนักเรียน ───────────────────────── */
function StudentView({ me }) {
  const [code, setCode] = useState('');
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const { rows: r } = await myMemberships(me.user.id);
    setRows(r ?? []);
  }, [me.user.id]);
  useEffect(() => { load(); }, [load]);

  async function join() {
    if (!code.trim()) { setMsg('⚠ กรอกรหัสห้องก่อน'); return; }
    setBusy(true);
    const { info, error } = await joinClass(code);
    setBusy(false);
    if (error) { setMsg('⚠ ' + friendly(error)); return; }
    setMsg(info?.status === 'approved'
      ? `✓ เข้าห้อง "${info.class_name}" แล้ว`
      : `✓ ส่งคำขอเข้าห้อง "${info?.class_name ?? ''}" ของ ${info?.teacher_name ?? 'ครู'} แล้ว — รอครูกดรับเข้าห้อง`);
    setCode(''); load();
  }

  return (
    <>
      <div className="card" style={{marginBottom:'1.2rem'}}>
        <div style={{fontWeight:600,fontSize:'0.92rem',marginBottom:'0.6rem'}}>🎓 เข้าห้องเรียน</div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <input className="form-input" style={{flex:'1 1 180px',fontFamily:'monospace',fontSize:'1.1rem',letterSpacing:'0.12em',textTransform:'uppercase'}}
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') join(); }}
            maxLength={6} placeholder="รหัส 6 ตัว" />
          <button className="btn btn-jade" onClick={join} disabled={busy}>เข้าห้อง</button>
        </div>
        <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'0.5rem'}}>
          กรอกรหัสที่ครูให้มา แล้วรอครูกดรับเข้าห้อง — เข้าได้หลายห้อง เรียนกับครูหลายคนได้
        </div>
        {msg && <div style={{marginTop:'0.7rem',fontSize:'0.83rem',color:'var(--jade)'}}>{msg}</div>}
      </div>

      {rows.length === 0 && (
        <div className="card" style={{textAlign:'center',padding:'2rem',color:'var(--muted)'}}>
          <div style={{fontSize:'2rem'}}>🎓</div>
          <div style={{marginTop:'0.6rem',fontSize:'0.88rem'}}>ยังไม่ได้อยู่ห้องเรียนไหน</div>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {rows.map(m => (
          <StudentClassCard key={m.id} m={m} me={me} open={openId === m.id}
            onToggle={() => setOpenId(openId === m.id ? null : m.id)} onChanged={load} />
        ))}
      </div>
    </>
  );
}

function StudentClassCard({ m, me, open, onToggle, onChanged }) {
  const st = MEMBER_STATUS[m.status] ?? MEMBER_STATUS.pending;
  const [asg, setAsg] = useState([]);

  useEffect(() => {
    if (!open || m.status !== 'approved') return;
    myAssignments(m.class_id, me.user.id).then(({ rows }) => setAsg(rows ?? []));
  }, [open, m.class_id, m.status, me.user.id]);

  return (
    <div className="card">
      <div style={{display:'flex',gap:'11px',alignItems:'flex-start',flexWrap:'wrap'}}>
        <Avatar path={m.teacher?.avatar_url} name={m.teacher?.display_name} size={34} />
        <div style={{flex:'1 1 200px',minWidth:0}}>
          <div style={{fontWeight:600}}>{m.classroom?.name ?? 'ห้องเรียน'}</div>
          <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>
            ครู {m.teacher?.display_name ?? '—'}
            {m.classroom?.detail ? ` · ${m.classroom.detail}` : ''}
            {m.seat_no ? ` · เลขที่ ${m.seat_no}` : ''}
          </div>
        </div>
        <div style={{fontSize:'0.8rem',fontWeight:600,color:st.color,whiteSpace:'nowrap'}}>{st.icon} {st.label}</div>
      </div>

      <div style={{display:'flex',gap:'8px',marginTop:'0.8rem',flexWrap:'wrap'}}>
        {m.status === 'approved' && (
          <button className="btn btn-outline btn-sm" onClick={onToggle}>
            {open ? 'ปิด' : '📝 งานที่ครูสั่ง'}
          </button>
        )}
        <button className="btn btn-danger btn-sm"
          onClick={async () => { if (confirm(`ออกจากห้อง "${m.classroom?.name ?? ''}"?`)) { await leaveClass(m.id); onChanged(); } }}>
          ออกจากห้อง
        </button>
      </div>

      {m.status === 'pending' && (
        <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:'0.6rem'}}>
          ส่งคำขอแล้ว รอครูกดรับเข้าห้อง — พอครูรับแล้วจะเห็นงานที่ครูสั่งตรงนี้
        </div>
      )}

      {open && m.status === 'approved' && (
        <div style={{marginTop:'1rem',borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
          {asg.length === 0 && <div style={{fontSize:'0.82rem',color:'var(--muted)'}}>ครูยังไม่ได้สั่งงาน</div>}
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {asg.map(a => {
              const look = cellOf(a.mine?.status ?? 'missing');
              return (
                <div key={a.id} style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',
                                        padding:'10px 12px',background:'var(--navy3)',borderRadius:'8px'}}>
                  <div style={{flex:'1 1 180px',minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:'0.88rem'}}>{a.title}</div>
                    {a.brief && <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{a.brief}</div>}
                    {a.due_at && <div style={{fontSize:'0.73rem',color:'var(--gold2)'}}>กำหนดส่ง {fmtDate(a.due_at)} · {dueText(a.due_at)}</div>}
                  </div>
                  <div style={{fontSize:'0.82rem',color:look.color,whiteSpace:'nowrap'}}>
                    {look.icon} {look.label}{a.mine?.grade ? ` · ${a.mine.grade}` : ''}
                  </div>
                  {!a.mine
                    ? <Link href={`/songs/new?assignment=${a.id}`}><button className="btn btn-jade btn-sm">📮 ทำงานชิ้นนี้</button></Link>
                    : <Link href="/homework"><button className="btn btn-outline btn-sm">ดูงานที่ส่ง</button></Link>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
