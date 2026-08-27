'use client';
// app/homework/page.js — ห้องส่งงาน (นักเรียน) และห้องตรวจงาน (ครู)   Pk 27 ส.ค. 69
//   นักเรียน: เห็นงานที่ส่งไป สถานะ คอมเมนต์ครู เกรด และแก้แล้วส่งใหม่ได้
//   ครู:      เห็นงานที่ส่งมาถึงตัว เปิดดูโน้ต เล่นเสียงฟัง เขียนตรวจกลับ ให้เกรด
//             ส่งกลับให้แก้ และส่งงานที่ดีมากเข้าคิวอนุมัติของคลังจริง
//   งานทั้งหมดเป็นเรื่องส่วนตัวระหว่างนักเรียนกับครู ไม่ขึ้นคลังสาธารณะ (กติกาอยู่ใน sql/25)
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMe } from '../../components/Gate';
import Avatar from '../../components/Avatar';
import { fmtDT } from '../../lib/fmtdate';
import {
  hwStatus, listMyHomework, listInbox, listComments, addComment,
  reviewHomework, promoteHomework, deleteHomework, versesOf,
} from '../../lib/homework';

const NotationPlayer = dynamic(() => import('../../components/NotationPlayer'), { ssr: false });

export default function HomeworkPage() {
  const me = useMe();
  const [tab, setTab] = useState('out');          // in = กล่องตรวจงาน (ครู) · out = งานที่ฉันส่ง
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  const isTeacher = me.isTeacher || me.isAdmin;
  useEffect(() => { if (!me.loading) setTab(isTeacher ? 'in' : 'out'); }, [me.loading, isTeacher]);

  const load = useCallback(async () => {
    if (me.loading || !me.user) return;
    setLoading(true); setErr('');
    const r = tab === 'in' ? await listInbox(me.user.id) : await listMyHomework(me.user.id);
    if (r.error) {
      const m = r.error.message || '';
      setErr(/does not exist|relation|schema cache/i.test(m)
        ? 'ยังไม่ได้เปิดระบบการบ้านในฐานข้อมูล — ผู้ดูแลต้องรัน sql/25_homework.sql ก่อน'
        : m);
    }
    setRows(r.rows ?? []);
    setLoading(false);
  }, [me.loading, me.user, tab]);
  useEffect(() => { load(); }, [load]);

  if (me.loading) return (
    <main className="container" style={{paddingTop:'3rem',textAlign:'center',color:'var(--muted)'}}>กำลังโหลด…</main>
  );
  if (!me.user) return (
    <main className="container" style={{maxWidth:'480px'}}>
      <div className="lock-box">
        <div style={{marginBottom:'1rem'}}>เข้าสู่ระบบเพื่อดูการบ้าน</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ / สมัคร</button></Link>
      </div>
    </main>
  );

  const waiting = rows.filter(r => r.status === 'sent').length;

  return (
    <main className="container" style={{maxWidth:'900px'}}>
      <div className="section-title">การบ้าน</div>
      <div className="section-subtitle">
        {isTeacher
          ? 'งานที่นักเรียนส่งมาให้ตรวจ — เปิดดูโน้ต เล่นเสียงฟัง เขียนตรวจกลับ ให้เกรด หรือส่งกลับให้แก้'
          : 'งานที่คุณส่งให้ครู — เป็นเรื่องส่วนตัวระหว่างคุณกับครู ไม่ขึ้นในคลังเพลงสาธารณะ'}
      </div>

      {isTeacher && (
        <div className="tab-row" style={{display:'flex',gap:'8px',margin:'0 0 1rem',flexWrap:'wrap'}}>
          <button className={'btn btn-sm ' + (tab === 'in' ? 'btn-jade' : 'btn-outline')}
            onClick={() => { setTab('in'); setOpenId(null); }}>
            📥 งานที่ส่งมาให้ตรวจ{tab === 'in' && waiting ? ` (${waiting} รอตรวจ)` : ''}
          </button>
          <button className={'btn btn-sm ' + (tab === 'out' ? 'btn-jade' : 'btn-outline')}
            onClick={() => { setTab('out'); setOpenId(null); }}>
            📤 งานที่ฉันส่งไป
          </button>
        </div>
      )}

      {err && <div className="card" style={{borderColor:'var(--danger)',color:'var(--danger)',fontSize:'0.85rem'}}>{err}</div>}
      {loading && <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>กำลังโหลด…</div>}

      {!loading && !err && rows.length === 0 && (
        <div className="card" style={{textAlign:'center',padding:'2rem 1.2rem',color:'var(--muted)'}}>
          <div style={{fontSize:'2rem'}}>{tab === 'in' ? '📭' : '📝'}</div>
          <div style={{marginTop:'0.6rem',fontSize:'0.88rem'}}>
            {tab === 'in' ? 'ยังไม่มีนักเรียนส่งงานมา' : 'ยังไม่ได้ส่งงานให้ครู'}
          </div>
          {tab === 'out' && (
            <Link href="/songs/new">
              <button className="btn btn-primary btn-sm" style={{marginTop:'1rem'}}>เปิดกระดานเขียนโน้ต</button>
            </Link>
          )}
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {rows.map(hw => (
          <HomeworkCard key={hw.id} hw={hw} me={me} side={tab === 'in' ? 'teacher' : 'student'}
            open={openId === hw.id} onToggle={() => setOpenId(openId === hw.id ? null : hw.id)}
            onChanged={load} />
        ))}
      </div>
    </main>
  );
}

function HomeworkCard({ hw, me, side, open, onToggle, onChanged }) {
  const st = hwStatus(hw.status);
  const other = side === 'teacher' ? hw.student : hw.teacher;
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [grade, setGrade] = useState(hw.grade ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!open) return;
    listComments(hw.id).then(({ rows }) => setComments(rows ?? []));
  }, [open, hw.id]);

  async function say() {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await addComment(hw.id, me.user.id, body);
    setBusy(false);
    if (error) { setNote('⚠ ' + error.message); return; }
    setBody('');
    listComments(hw.id).then(({ rows }) => setComments(rows ?? []));
    setNote('ส่งข้อความแล้ว');
  }
  async function review(status) {
    setBusy(true);
    const { error } = await reviewHomework(hw.id, status, status === 'graded' ? (grade || null) : null);
    setBusy(false);
    if (error) { setNote('⚠ ' + error.message); return; }
    setNote(status === 'graded' ? 'บันทึกผลตรวจแล้ว' : 'ส่งกลับให้นักเรียนแก้แล้ว');
    onChanged();
  }
  async function promote() {
    if (!confirm(`ส่ง "${hw.title}" เข้าคิวอนุมัติของคลังจริง?\n\nเครดิตจะยังเป็นของนักเรียน และผู้ดูแลตรวจอีกชั้นก่อนเผยแพร่`)) return;
    setBusy(true);
    const { error } = await promoteHomework(hw.id);
    setBusy(false);
    if (error) { setNote('⚠ ' + error.message); return; }
    setNote('✓ ส่งเข้าคิวอนุมัติแล้ว');
    onChanged();
  }
  async function remove() {
    if (!confirm(`ลบงาน "${hw.title}" ทิ้ง?`)) return;
    const { error } = await deleteHomework(hw.id);
    if (error) { setNote('⚠ ' + error.message); return; }
    onChanged();
  }

  const verses = open ? versesOf(hw) : [];

  return (
    <div className="card" style={{borderColor: hw.status === 'sent' && side === 'teacher' ? 'rgba(201,168,76,0.5)' : 'var(--border)'}}>
      <div style={{display:'flex',gap:'11px',alignItems:'flex-start',flexWrap:'wrap'}}>
        <Avatar path={other?.avatar_url} name={other?.display_name} size={34} />
        <div style={{flex:'1 1 200px',minWidth:0}}>
          <div style={{fontWeight:600}}>{hw.title}</div>
          <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>
            {side === 'teacher' ? 'จาก ' : 'ส่งให้ '}{other?.display_name ?? '—'}
            {hw.instrument ? ` · ${hw.instrument}` : ''}
            {hw.version > 1 ? ` · ส่งครั้งที่ ${hw.version}` : ''}
            {' · '}{fmtDT(hw.created_at)}
          </div>
        </div>
        <div style={{textAlign:'right',flex:'0 0 auto'}}>
          <div style={{fontSize:'0.8rem',fontWeight:600,color:st.color,whiteSpace:'nowrap'}}>{st.icon} {st.label}</div>
          {hw.grade && <div style={{fontSize:'0.8rem',color:'var(--jade)',fontFamily:'monospace'}}>{hw.grade}</div>}
          {hw.promoted_id && <div style={{fontSize:'0.7rem',color:'var(--gold)'}}>ส่งเข้าคลังแล้ว</div>}
        </div>
      </div>

      {hw.student_note && (
        <div style={{fontSize:'0.8rem',color:'var(--muted)',marginTop:'0.6rem'}}>
          หมายเหตุจากนักเรียน: {hw.student_note}
        </div>
      )}

      <div style={{display:'flex',gap:'8px',marginTop:'0.8rem',flexWrap:'wrap'}}>
        <button className="btn btn-outline btn-sm" onClick={onToggle}>
          {open ? 'ปิด' : '🎼 เปิดดูโน้ต / เล่นเสียง'}
        </button>
        {side === 'student' && hw.status === 'returned' && (
          <Link href="/songs/new"><button className="btn btn-primary btn-sm">✎ แก้แล้วส่งใหม่</button></Link>
        )}
        {side === 'student' && <button className="btn btn-danger btn-sm" onClick={remove}>ลบ</button>}
      </div>

      {open && (
        <div style={{marginTop:'1rem',borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
          <button className="btn btn-outline btn-sm" style={{marginBottom:'0.7rem'}}
            onClick={() => setShowText(v => !v)}>
            {showText ? 'ซ่อนโน้ตตัวอักษร' : 'ดูโน้ตเป็นตัวอักษร'}
          </button>
          {showText && (
            <pre style={{background:'var(--navy3)',padding:'10px',borderRadius:'8px',overflowX:'auto',
                         fontSize:'0.78rem',lineHeight:1.9,fontFamily:'monospace'}}>{hw.notation_text ?? '—'}</pre>
          )}

          {verses.length > 0
            ? <NotationPlayer verses={verses} />
            : <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>อ่านโน้ตชิ้นนี้ไม่ออก — ดูเป็นตัวอักษรแทน</div>}

          <div style={{marginTop:'1.1rem'}}>
            <div style={{fontWeight:600,fontSize:'0.86rem',marginBottom:'0.5rem'}}>💬 พูดคุยเรื่องงานชิ้นนี้</div>
            {comments.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>ยังไม่มีข้อความ</div>}
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {comments.map(c => (
                <div key={c.id} style={{display:'flex',gap:'9px',alignItems:'flex-start'}}>
                  <Avatar path={c.author?.avatar_url} name={c.author?.display_name} size={26} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.76rem',color:'var(--muted)'}}>
                      {c.author?.display_name ?? 'สมาชิก'} · {fmtDT(c.created_at)}
                    </div>
                    <div style={{fontSize:'0.86rem',whiteSpace:'pre-wrap'}}>{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:'8px',marginTop:'0.7rem',flexWrap:'wrap'}}>
              <input className="form-input" style={{flex:'1 1 200px'}} value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') say(); }}
                placeholder={side === 'teacher' ? 'เขียนตรวจกลับไปหานักเรียน…' : 'ถามครู…'} />
              <button className="btn btn-jade btn-sm" onClick={say} disabled={busy || !body.trim()}>ส่ง</button>
            </div>
          </div>

          {side === 'teacher' && (
            <div style={{marginTop:'1.1rem',borderTop:'1px solid var(--border)',paddingTop:'0.9rem'}}>
              <div style={{fontWeight:600,fontSize:'0.86rem',marginBottom:'0.5rem'}}>ผลตรวจ</div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                <input className="form-input" style={{flex:'0 1 190px'}} value={grade}
                  onChange={e => setGrade(e.target.value)} placeholder="คะแนน / เกรด เช่น 8/10 หรือ ดีมาก A" />
                <button className="btn btn-jade btn-sm" onClick={() => review('graded')} disabled={busy}>✓ บันทึกผลตรวจ</button>
                <button className="btn btn-outline btn-sm" onClick={() => review('returned')} disabled={busy}>✎ ส่งกลับให้แก้</button>
                {!hw.promoted_id && (
                  <button className="btn btn-primary btn-sm" onClick={promote} disabled={busy}>🎼 ส่งเข้าคิวอนุมัติของคลัง</button>
                )}
              </div>
              <div style={{fontSize:'0.74rem',color:'var(--muted)',marginTop:'0.5rem'}}>
                งานที่ดีมากส่งเข้าคลังจริงได้ — เครดิตยังเป็นของนักเรียน และผู้ดูแลตรวจอีกชั้นก่อนเผยแพร่
              </div>
            </div>
          )}

          {note && <div style={{marginTop:'0.7rem',fontSize:'0.8rem',color:'var(--jade)'}}>{note}</div>}
        </div>
      )}
    </div>
  );
}
