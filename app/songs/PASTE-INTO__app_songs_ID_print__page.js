'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { fetchMelody, songRef } from '../../../../lib/songparts';

import { thaiToKeys } from '../../../../lib/thnotation';
import { usePermissions, PremiumLock } from '../../../../components/Gate';
const COLS = ['ด','ร','ม','ฟ','ซ','ล','ท'];

// แยกวรรค → ห้อง → ตำแหน่ง
function parseVerse(combined) {
  return (combined ?? '').split('|').map(h =>
    h.trim().split(/\s+/).filter(x => x.length).map(tok => ({
      keys: thaiToKeys(tok),
      sabat: [...tok].filter(c => COLS.includes(c)).length > 1,
    }))
  ).filter(h => h.length);
}

const THAI_NUM = ['๐','๑','๒','๓','๔','๕','๖','๗','๘','๙'];
const toThai = n => String(n).split('').map(d => THAI_NUM[+d] ?? d).join('');

export default function PrintPage() {
  const { id } = useParams();
  const { loading: meLoading, can } = usePermissions();
  const [song, setSong] = useState(null);
  const [verses, setVerses] = useState([]);
  const [sections, setSections] = useState({});
  const [instruments, setInstruments] = useState(['ทำนองหลัก']);
  const [instrument, setInstrument] = useState('ทำนองหลัก');
  const [credit, setCredit] = useState('');
  const [hongsPerLine, setHongsPerLine] = useState(8);
  const [noteSize, setNoteSize] = useState(20);
  const [showSections, setShowSections] = useState(true);
  const [showVerseNo, setShowVerseNo] = useState(true);

  useEffect(() => { loadBase(); }, [id]);
  useEffect(() => { loadMelody(); }, [id, instrument]);

  async function loadBase() {
    const { data: s } = await supabase.from('songs').select('*').eq('id', id).single();
    setSong(s);
    const { data: inst } = await supabase.from('song_melody')
      .select('instrument').eq(s?.parent_song_id ? 'part_song_id' : 'song_id', id).eq('approved', true);
    const uniq = [...new Set((inst ?? []).map(r => r.instrument ?? 'ทำนองหลัก'))];
    setInstruments(uniq.length ? uniq : ['ทำนองหลัก']);
    const { data: kc } = await supabase.from('krasuan_catalog')
      .select('verse_no, section').eq('song_id', id).limit(2000);   // 610 วรรคเกินเพดานเดิม 600
    const secMap = {};
    (kc ?? []).forEach(r => secMap[r.verse_no] = r.section);
    setSections(secMap);
  }

  async function loadMelody() {
    // fetchMelody รู้เองว่าเป็นเพลงเรื่องหรือเพลงย่อย และนับเลขวรรคใหม่ให้ (sql/30)
    const { rows: data } = await fetchMelody(id, {
      instrument: instrument === 'ทำนองหลัก' ? null : instrument,
      approvedOnly: true, columns: 'id, verse_no, instrument, part_section, section, combined, submitted_by' });
    setVerses(instrument === 'ทำนองหลัก'
      ? (data ?? []).filter(r => (r.instrument ?? 'ทำนองหลัก') === 'ทำนองหลัก')
      : (data ?? []));
    const uid = data?.find(r => r.submitted_by)?.submitted_by;
    if (uid) {
      const { data: p } = await supabase.from('profiles').select('display_name').eq('id', uid).single();
      setCredit(p?.display_name ?? '');
    } else setCredit('');
  }

  // จัดบรรทัด: รวมห้องของทุกวรรคต่อเนื่อง แบ่งทีละ hongsPerLine พร้อมจุดคั่นวรรค/ท่อน
  const lines = useMemo(() => {
    const out = [];
    let cur = [], curVerseStart = null, lastSection = null;
    for (const v of verses) {
      const sec = sections[v.verse_no] ?? null;
      if (showSections && sec !== lastSection && sec) {
        if (cur.length) { out.push({ type: 'line', hongs: cur, verseNo: curVerseStart }); cur = []; curVerseStart = null; }
        out.push({ type: 'section', name: sec });
        lastSection = sec;
      }
      const hongs = parseVerse(v.combined);
      if (curVerseStart === null) curVerseStart = v.verse_no;
      for (const h of hongs) {
        cur.push(h);
        if (cur.length === hongsPerLine) {
          out.push({ type: 'line', hongs: cur, verseNo: curVerseStart });
          cur = []; curVerseStart = null;
        }
      }
      if (curVerseStart === null && cur.length === 0) curVerseStart = null;
    }
    if (cur.length) out.push({ type: 'line', hongs: cur, verseNo: curVerseStart });
    return out;
  }, [verses, sections, hongsPerLine, showSections]);

  if (meLoading) return <div style={{padding:'2rem',color:'#333'}}>กำลังโหลด...</div>;
  if (!can('print')) return (
    <main className="container" style={{maxWidth:'520px',paddingTop:'3rem'}}>
      <PremiumLock feature="ฉบับพิมพ์และการบันทึก PDF" />
      <a href={`/songs/${id}`}><button className="btn btn-outline btn-sm">← กลับหน้าเพลง</button></a>
    </main>
  );
  if (!song) return <div style={{padding:'2rem',color:'#333'}}>กำลังโหลด...</div>;

  const today = new Date().toLocaleDateString('th-TH', { day:'numeric', month:'long', year:'numeric' });

  return (
    <div className="print-root">
      <style jsx global>{`
        .print-root { background:#666; min-height:100vh; padding:1.5rem 0; font-family:'Noto Serif Thai', serif; }
        .toolbar { max-width:210mm; margin:0 auto 1rem; display:flex; gap:8px; flex-wrap:wrap; align-items:center;
          background:#fff; padding:0.7rem 1rem; border-radius:8px; font-family:'Noto Sans Thai',sans-serif; }
        .toolbar select, .toolbar button { padding:5px 10px; border:1px solid #bbb; border-radius:6px;
          background:#fff; font-size:0.8rem; cursor:pointer; font-family:inherit; }
        .toolbar .print-btn { background:#0F1B2D; color:#fff; font-weight:600; padding:6px 16px; }
        .sheet { width:210mm; min-height:297mm; margin:0 auto; background:#fff; color:#000;
          padding:18mm 16mm 22mm; box-shadow:0 4px 24px rgba(0,0,0,0.4); position:relative; }
        .sheet-header { text-align:center; margin-bottom:8mm; }
        .sheet-title { font-size:22pt; font-weight:700; }
        .sheet-sub { font-size:11pt; color:#333; margin-top:2mm; }
        .sheet-rule { border-top:1.5pt solid #000; border-bottom:0.5pt solid #000; height:3px; margin:4mm 0 6mm; }
        .section-head { font-size:12pt; font-weight:700; margin:5mm 0 2mm; page-break-after:avoid; }
        .nline { display:flex; align-items:stretch; page-break-inside:avoid; margin-bottom:2.5mm; }
        .vno { width:9mm; flex-shrink:0; font-size:8pt; color:#888; display:flex; align-items:center; }
        .hongs { display:flex; flex:1; border:0.75pt solid #999; }
        .hong { flex:1; display:flex; justify-content:space-around; align-items:center;
          border-right:0.75pt solid #999; padding:1.2mm 0.5mm; min-height:9mm; }
        .hong:last-child { border-right:none; }
        .pos { font-family:'THNotation'; font-size:${noteSize}px; line-height:1.5; text-align:center;
          min-width:0.9em; position:relative; }
        .pos.sabat::before { content:''; position:absolute; top:-0.25em; left:-8%; right:-8%; height:0.55em;
          border-top:1.4px solid #000; border-radius:50% 50% 0 0 / 100% 100% 0 0; }
        .sheet-footer { position:absolute; bottom:10mm; left:16mm; right:16mm; display:flex;
          justify-content:space-between; font-size:8.5pt; color:#444; border-top:0.5pt solid #999; padding-top:2mm; }
        @media print {
          .print-root { background:#fff; padding:0; }
          .toolbar { display:none; }
          .sheet { box-shadow:none; margin:0; width:auto; min-height:auto; padding:0 0 15mm; }
          .sheet-footer { position:fixed; bottom:4mm; left:0; right:0; }
          @page { size: A4; margin: 16mm 14mm 20mm; }
        }
      `}</style>

      <div className="toolbar">
        <a href={`/songs/${id}`} style={{fontSize:'0.8rem',color:'#333'}}>← กลับหน้าเพลง</a>
        <select value={instrument} onChange={e => setInstrument(e.target.value)}>
          {instruments.map(i => <option key={i}>{i}</option>)}
        </select>
        <select value={hongsPerLine} onChange={e => setHongsPerLine(+e.target.value)}>
          <option value={8}>8 ห้อง/บรรทัด</option>
          <option value={4}>4 ห้อง/บรรทัด</option>
        </select>
        <select value={noteSize} onChange={e => setNoteSize(+e.target.value)}>
          <option value={17}>ตัวโน้ตเล็ก</option>
          <option value={20}>ตัวโน้ตกลาง</option>
          <option value={24}>ตัวโน้ตใหญ่</option>
        </select>
        <label style={{fontSize:'0.75rem'}}><input type="checkbox" checked={showSections}
          onChange={e => setShowSections(e.target.checked)} /> ชื่อท่อน</label>
        <label style={{fontSize:'0.75rem'}}><input type="checkbox" checked={showVerseNo}
          onChange={e => setShowVerseNo(e.target.checked)} /> เลขวรรค</label>
        <button className="print-btn" onClick={() => window.print()}>🖨 พิมพ์ / บันทึก PDF</button>
        <span style={{fontSize:'0.68rem',color:'#777'}}>ในหน้าต่างพิมพ์ เลือก "Save as PDF" เพื่อได้ไฟล์ PDF คมชัด</span>
      </div>

      <div className="sheet">
        <div className="sheet-header">
          <div className="sheet-title">{song.name_th}</div>
          <div className="sheet-sub">
            {[song.type, instrument !== 'ทำนองหลัก' ? `ทาง${instrument}` : 'ทำนองหลัก'].filter(Boolean).join(' · ')}
          </div>
          <div className="sheet-rule" />
        </div>

        {lines.map((l, i) => l.type === 'section' ? (
          <div key={i} className="section-head">{l.name}</div>
        ) : (
          <div key={i} className="nline">
            <div className="vno">{showVerseNo && l.verseNo ? toThai(l.verseNo) : ''}</div>
            <div className="hongs">
              {l.hongs.map((h, j) => (
                <div key={j} className="hong">
                  {h.map((p, k) => (
                    <span key={k} className={`pos${p.sabat ? ' sabat' : ''}`}>{p.keys || '-'}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="sheet-footer">
          <span>บันทึกโดย: {credit || 'ฐานข้อมูลหอจดหมายเหตุดนตรีไทย (ปกป้อง ขำประเสริฐ)'}</span>
          <span>thaimusicarchive.com · {today}</span>
        </div>
      </div>
    </div>
  );
}
