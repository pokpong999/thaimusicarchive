'use client';
// components/ProofBox.js — กล่องติ๊กตรวจทานในรายชื่อเพลง  (Pk 27 ส.ค. 69)
//
//   สี่สถานะ · กดวนทีละขั้น หรือกดค้าง/คลิกขวาเพื่อเลือกจากรายการ
//   ใต้ปุ่มบอกชื่อคนตรวจกับวันที่เสมอ — ส่วนที่ทำให้ "ไม่ต้องตรวจซ้ำ" จริง ๆ
import { useState } from 'react';
import { PROOF, PROOF_ORDER, proofOf, setProof, proofWho, proofError, proofLabel } from '../lib/proof';
import { useLang } from '../lib/i18n';

export default function ProofBox({ song, names = {}, onChange, compact = false }) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(song.proof_note ?? '');
  const cur = proofOf(song.proof_status);

  const apply = async (v, n) => {
    setBusy(true); setErr('');
    const { error, row } = await setProof(song.id, v, n);
    setBusy(false); setOpen(false);
    if (error) { setErr(proofError(error.message)); return; }
    // ★ ฐานคืนค่าจริงมาแล้ว ต้องเชื่อทั้งก้อน ห้ามใช้ ?? ถอยกลับไปค่าเดิม
    //   ตอนกลับเป็น 'ยังไม่ตรวจ' ฐานคืน null ถ้าใช้ ?? จะเด้งกลับไปชื่อคนเก่า
    //   หน้าจอจะโชว์ว่ามีคนตรวจแล้วทั้งที่ล้างไปแล้ว — คนอ่านเข้าใจผิดทันที
    onChange?.(row
      ? { ...song, proof_status: row.proof_status, proof_by: row.proof_by,
          proof_at: row.proof_at, proof_note: row.proof_note }
      : { ...song, proof_status: v, proof_note: n ?? song.proof_note });
    setNote(v === 'none' ? '' : (row?.proof_note ?? n ?? ''));
    setNoteOpen(v === 'bad');
  };
  const next = () => apply(PROOF_ORDER[(PROOF_ORDER.indexOf(cur.v) + 1) % PROOF_ORDER.length]);
  const who = proofWho(song, names, lang);

  return (
    <div data-proof={song.id} style={{position:'relative',minWidth: compact ? '0' : '132px'}}>
      <div style={{display:'flex',gap:'4px',alignItems:'center'}}>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy}
          onClick={next} onContextMenu={e => { e.preventDefault(); setOpen(o => !o); }}
          title={`${proofLabel(cur, lang)}${who ? ' — ' + who : ''}\n${t('proof_hint')}`}
          style={{color:cur.color,borderColor:cur.color,padding:'4px 8px',minHeight:'30px',fontSize:'0.76rem',whiteSpace:'nowrap'}}>
          {cur.icon} {compact ? '' : proofLabel(cur, lang)}
        </button>
        <button type="button" className="btn btn-outline btn-sm" title={t('proof_pick')}
          onClick={() => setOpen(o => !o)}
          style={{padding:'4px 6px',minHeight:'30px',fontSize:'0.7rem'}}>▾</button>
      </div>

      {who && <div style={{fontSize:'0.64rem',color:'var(--muted)',marginTop:'2px',whiteSpace:'nowrap'}}>{who}</div>}
      {song.proof_note && song.proof_status === 'bad' && (
        <div style={{fontSize:'0.64rem',color:'var(--danger)',maxWidth:'190px'}}>✎ {song.proof_note}</div>
      )}
      {err && <div style={{fontSize:'0.64rem',color:'var(--danger)',maxWidth:'190px'}}>⚠ {err}</div>}

      {open && (
        <div data-proofmenu style={{position:'absolute',zIndex:60,top:'34px',left:0,minWidth:'180px',
          background:'var(--navy2)',border:'1px solid var(--border)',borderRadius:'8px',padding:'6px'}}>
          {PROOF.map(p => (
            <button key={p.v} type="button" className="btn btn-outline btn-sm" disabled={busy}
              onClick={() => apply(p.v, note)}
              style={{display:'block',width:'100%',textAlign:'left',marginBottom:'3px',
                color:p.color,borderColor:p.v === cur.v ? p.color : 'var(--border)',fontSize:'0.76rem'}}>
              {p.icon} {proofLabel(p, lang)}{p.v === cur.v ? ' ✓' : ''}
            </button>
          ))}
          <input className="form-input" style={{fontSize:'0.74rem',marginTop:'4px'}}
            placeholder={t('proof_note_ph')} value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') apply(cur.v === 'none' ? 'bad' : cur.v, note); }} />
          <div style={{fontSize:'0.64rem',color:'var(--muted)',marginTop:'3px'}}>{t('proof_enter')}</div>
        </div>
      )}
      {noteOpen && !open && (
        <div style={{fontSize:'0.64rem',color:'var(--gold2)'}}>{t('proof_where')}</div>
      )}
    </div>
  );
}
