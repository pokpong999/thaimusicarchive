'use client';
// components/SheetExport.js — ส่งออก Music Sheet มาตรฐานสิ่งพิมพ์
// PDF · PNG · DOCX · Excel | โน้ตไทยรวม/สองมือ · โน้ตสากล 5 เส้น
// กระดาษ A4/A5/B5/Letter ตั้ง-นอน · หัวกระดาษปรับได้ · ลายน้ำ THMA (แอดมินปิดได้)
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMe } from './Gate';
import {
  PAPERS, pageGeometry, autoHongs, prepare, paginateThai, drawThaiPage,
  prepareStaff, paginateStaff, drawStaffPage, SHEET_VERSION,
} from '../lib/sheetkit';

function loadScript(src, check) {
  return new Promise(resolve => {
    if (check()) { resolve(); return; }
    const js = document.createElement('script');
    js.src = src; js.onload = () => resolve();
    document.head.appendChild(js);
  });
}
const CDN = {
  jspdf:   ['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => window.jspdf],
  docx:    ['https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js', () => window.docx],
  xlsx:    ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => window.XLSX],
  vexflow: ['https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js',
            () => (window.Vex && window.Vex.Flow) || window.VexFlow],
};
function dl(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
let fontReady = null;
function ensureFonts() {
  if (!fontReady) fontReady = (async () => {
    try {
      const f = new FontFace('THNotation', "url(/fonts/THNotation.woff2) format('woff2')");
      await f.load(); document.fonts.add(f);
    } catch (e) {}
    try { await document.fonts.load("20px 'Noto Sans Thai'"); } catch (e) {}
  })();
  return fontReady;
}

const SPACING = { compact: 0.78, normal: 1, airy: 1.28 };

/* คอมโพเนนต์ย่อยต้องอยู่นอกตัวหลัก — ประกาศข้างในจะกลายเป็น "ชนิดใหม่" ทุกครั้ง
   ที่วาดจอ ช่องกรอกถูกสร้างใหม่ โฟกัสหลุด พิมพ์ได้ทีละตัวอักษร */
function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
      <span style={{ fontSize: '0.74rem', color: 'var(--muted)', width: '86px', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}
function Sel({ value, onChange, opts }) {
  return (
    <select className="form-input" style={{ padding: '4px 8px', fontSize: '0.78rem', width: 'auto' }}
      value={value} onChange={e => onChange(e.target.value)}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
function Btn({ busy, id, label, fn }) {
  return (
    <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={fn} style={{ fontSize: '0.78rem' }}>
      {busy === id ? '⏳ กำลังสร้าง...' : label}
    </button>
  );
}

export default function SheetExport({ song, instrument, verses, onClose }) {
  const me = useMe();
  const hasHands = (verses ?? []).some(v => (v.right_hand ?? '').trim() || (v.left_hand ?? '').trim() || (v.third_hand ?? '').trim());
  const [o, setO] = useState({
    notation: 'thai',                 // thai | staff
    handMode: hasHands ? 'hands' : 'combined',
    font: 'notation',                 // notation | unicode (เฉพาะโน้ตไทย)
    beat: 'thai',                     // จังหวะตกของโน้ตสากล
    paper: 'A4', orientation: 'portrait', hongs: 0 /* 0=อัตโนมัติ */, spacing: 'normal',
    marginMm: 16, watermark: true,
  });
  const [h, setH] = useState({
    title: song?.name_th ?? '',
    subtitle: ['ทาง' + (instrument ?? 'ทำนองหลัก'), song?.type].filter(Boolean).join(' · '),
    left: '', right: 'หอจดหมายเหตุดนตรีไทย',
  });
  const [pageIdx, setPageIdx] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const wrapRef = useRef(null);
  const set = (k, v) => { setO(p => ({ ...p, [k]: v })); setPageIdx(0); };

  const opt = useMemo(() => {
    const base = { ...o, spacingF: SPACING[o.spacing] ?? 1, header: h,
      watermark: me.isAdmin ? o.watermark : true };
    base.hongsPerLine = o.hongs || autoHongs(base);
    return base;
  }, [o, h, me.isAdmin]);

  // เรนเดอร์เป็น canvas · onlyPage = เรนเดอร์เฉพาะหน้านั้น (พรีวิว — เร็วแม้เพลงร้อยหน้า)
  async function renderPages(scale, onlyPage = null) {
    await ensureFonts();
    const g = pageGeometry(opt);
    const canvases = [];
    let total = 0;
    const wants = pi => onlyPage == null || pi === onlyPage;
    if (opt.notation === 'staff') {
      await loadScript(...CDN.vexflow);
      const VF = (window.Vex && window.Vex.Flow) || window.VexFlow;
      // ★ r3: โน้ตสากล = "ห้องสากลต่อบรรทัด" ตามกระดาษ — แนวตั้ง 4 · แนวนอน 6 (Pk 2 ก.ย. 69 ค่ำ)
      //   ถ้าเลือกห้อง/บรรทัดเองในกล่อง ใช้ค่านั้นแทน
      const prepS = prepareStaff(verses, {
        source: opt.handMode === 'hands' ? 'hands' : 'combined',
        beat: opt.beat, barsPerLine: o.hongs || (opt.orientation === 'landscape' ? 6 : 4) });
      const layout = paginateStaff(prepS, g, opt);
      total = layout.pages.length;
      layout.pages.forEach((_, pi) => {
        if (!wants(pi)) return;
        const c = document.createElement('canvas');
        drawStaffPage(VF, c, g, opt, layout, pi, total, scale);
        canvases.push(c);
      });
    } else {
      const prep = prepare(verses, { hongsPerLine: opt.hongsPerLine });
      const layout = paginateThai(prep, g, opt);
      total = layout.pages.length;
      layout.pages.forEach((_, pi) => {
        if (!wants(pi)) return;
        const c = document.createElement('canvas');
        c.width = g.W * scale; c.height = g.H * scale;
        const ctx = c.getContext('2d'); ctx.scale(scale, scale);
        drawThaiPage(ctx, g, opt, layout, pi, total);
        canvases.push(c);
      });
    }
    return { canvases, g, total };
  }

  // พรีวิว
  useEffect(() => {
    let dead = false;
    const t = setTimeout(async () => {
      try {
        setErr('');
        let { canvases, total } = await renderPages(1.6, pageIdx);
        if (!canvases.length && total > 0) {          // pageIdx เกินหน้าจริง → ถอยไปหน้าสุดท้าย
          ({ canvases, total } = await renderPages(1.6, total - 1));
          setPageIdx(total - 1);
        }
        if (dead || !wrapRef.current) return;
        setPageCount(total);
        const c = canvases[0] ?? Object.assign(document.createElement('canvas'), { width: 10, height: 10 });
        c.style.width = '100%'; c.style.height = 'auto';
        c.style.boxShadow = '0 3px 18px rgba(0,0,0,0.45)'; c.style.borderRadius = '3px';
        wrapRef.current.replaceChildren(c);
      } catch (e) { if (!dead) setErr('พรีวิวไม่สำเร็จ: ' + e.message); }
    }, 220);
    return () => { dead = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opt, pageIdx, verses]);

  const base = `${song?.id ?? 'THMA'}_${(song?.name_th ?? '').replace(/\s+/g, '_')}_${instrument ?? ''}`;

  async function exportPNG() {
    setBusy('png');
    try {
      const { canvases } = await renderPages(3);
      for (let i = 0; i < canvases.length; i++) {
        await new Promise(r => canvases[i].toBlob(b => { dl(b, `${base}_หน้า${i + 1}.png`); r(); }, 'image/png'));
        await new Promise(r => setTimeout(r, 350));   // เว้นจังหวะ กันเบราว์เซอร์บล็อกดาวน์โหลดรัว
      }
    } catch (e) { setErr('PNG ไม่สำเร็จ: ' + e.message); }
    setBusy('');
  }
  async function exportPDF() {
    setBusy('pdf');
    try {
      const { canvases, g } = await renderPages(3);
      await loadScript(...CDN.jspdf);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: [g.wmm, g.hmm],
        orientation: g.wmm > g.hmm ? 'l' : 'p' });
      canvases.forEach((c, i) => {
        if (i > 0) pdf.addPage([g.wmm, g.hmm], g.wmm > g.hmm ? 'l' : 'p');
        pdf.addImage(c.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, g.wmm, g.hmm);
      });
      pdf.save(base + '.pdf');
    } catch (e) { setErr('PDF ไม่สำเร็จ: ' + e.message); }
    setBusy('');
  }
  async function exportDOCX() {
    setBusy('docx');
    try {
      const { canvases, g } = await renderPages(2.6);
      await loadScript(...CDN.docx);
      const D = window.docx;
      const T = mm => Math.round(mm * 56.6929);       // มม. → twip
      const blobs = await Promise.all(canvases.map(c =>
        new Promise(r => c.toBlob(b => b.arrayBuffer().then(r), 'image/png'))));
      const children = blobs.map(buf => new D.Paragraph({
        children: [new D.ImageRun({ data: buf,
          transformation: { width: Math.round(g.wmm * 3.7795), height: Math.round(g.hmm * 3.7795) } })],
        spacing: { after: 0, before: 0 },
      }));
      const doc = new D.Document({ sections: [{
        properties: { page: {
          size: { width: T(g.wmm), height: T(g.hmm),
                  orientation: g.wmm > g.hmm ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        } },
        children,
      }] });
      dl(await D.Packer.toBlob(doc), base + '.docx');
    } catch (e) { setErr('DOCX ไม่สำเร็จ: ' + e.message); }
    setBusy('');
  }
  async function exportXLSX() {
    setBusy('xlsx');
    try {
      await loadScript(...CDN.xlsx);
      const rows = [[h.title], [h.subtitle], [],
        ['ท่อน', 'วรรค', 'มือ', 'ห้อง 1', 'ห้อง 2', 'ห้อง 3', 'ห้อง 4', 'ลูกตก', 'กระสวน']];
      (verses ?? []).forEach(v => {
        const hongs = t => { const a = (t ?? '').split('|').map(x => x.trim()); while (a.length < 4) a.push(''); return a.slice(0, 4); };
        if (o.handMode === 'hands' && ((v.right_hand ?? '').trim() || (v.left_hand ?? '').trim() || (v.third_hand ?? '').trim())) {
          const three = (v.third_hand ?? '').trim();
          // ขิม 3 บรรทัด ใช้ชื่อบรรทัดตามระบบ (สูง / กลาง / ต่ำ) · สองมือใช้ ขวา / ซ้าย
          const nm = three ? ['สูง', 'กลาง', 'ต่ำ'] : ['ขวา', 'ซ้าย'];
          rows.push([v.section ?? '', v.verse_no, nm[0], ...hongs(v.right_hand), v.luktok ?? '', v.krasuan ?? '']);
          rows.push(['', '', nm[1], ...hongs(v.left_hand), '', '']);
          if (three) rows.push(['', '', nm[2], ...hongs(v.third_hand), '', '']);
        } else rows.push([v.section ?? '', v.verse_no, '', ...hongs(v.combined), v.luktok ?? '', v.krasuan ?? '']);
      });
      const ws = window.XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 10 }, { wch: 6 }, { wch: 5 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 7 }, { wch: 9 }];
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'โน้ต');
      window.XLSX.writeFile(wb, base + '.xlsx');
    } catch (e) { setErr('Excel ไม่สำเร็จ: ' + e.message); }
    setBusy('');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(6,12,22,0.82)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '2rem 1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '12px',
        width: 'min(1060px, 100%)', padding: '1.1rem 1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <b style={{ fontSize: '1rem' }}>🖨 ส่งออก Music Sheet
            <span data-sheetver style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>รุ่น {SHEET_VERSION}</span></b>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕ ปิด</button>
        </div>

        <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
          {/* ── ตัวเลือก ── */}
          <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
            <Row label="รูปแบบโน้ต">
              <Sel value={o.notation} onChange={v => set('notation', v)}
                opts={[['thai', 'โน้ตไทย'], ['staff', 'โน้ตสากล 5 เส้น']]} />
              <Sel value={o.handMode} onChange={v => set('handMode', v)}
                opts={[['combined', 'บรรทัดเดียว (รวม)'],
                ...(hasHands ? [['hands', o.notation === 'staff' ? 'สองมือ (คู่เสียง)' : 'สองมือ (ขวา/ซ้าย)']] : [])]} />
            </Row>
            {o.notation === 'thai' && (
              <Row label="แบบอักษร">
                <Sel value={o.font} onChange={v => set('font', v)}
                  opts={[['notation', 'TH Notation (จุดบน-ล่างสวย)'], ['unicode', 'ไทยยูนิโค้ด']]} />
              </Row>
            )}
            {o.notation === 'staff' && (
              <Row label="จังหวะตก">
                <Sel value={o.beat} onChange={v => set('beat', v)}
                  opts={[['thai', 'แบบไทย (ตกท้ายห้อง)'], ['western', 'แบบสากล (ตกต้นห้อง)']]} />
              </Row>
            )}
            <Row label="กระดาษ">
              <Sel value={o.paper} onChange={v => set('paper', v)} opts={Object.keys(PAPERS).map(k => [k, k])} />
              <Sel value={o.orientation} onChange={v => set('orientation', v)}
                opts={[['portrait', 'แนวตั้ง'], ['landscape', 'แนวนอน']]} />
            </Row>
            <Row label="ห้อง/บรรทัด">
              <Sel value={String(o.hongs)} onChange={v => set('hongs', +v)}
                opts={[['0', 'อัตโนมัติ'], ['4', '4'], ['6', '6'], ['8', '8'], ['16', '16']]} />
              <Sel value={o.spacing} onChange={v => set('spacing', v)}
                opts={[['compact', 'บรรทัดชิด'], ['normal', 'ปกติ'], ['airy', 'บรรทัดห่าง']]} />
            </Row>

            <div style={{ borderTop: '1px solid var(--border)', margin: '0.7rem 0', paddingTop: '0.7rem',
              fontSize: '0.74rem', color: 'var(--muted)' }}>หัวกระดาษ (แก้ได้อิสระ)</div>
            {[['title', 'ชื่อเรื่อง'], ['subtitle', 'บรรทัดรอง'], ['left', 'มุมซ้าย'], ['right', 'มุมขวา']].map(([k, l]) => (
              <Row key={k} label={l}>
                <input className="form-input" style={{ padding: '4px 8px', fontSize: '0.78rem', flex: 1 }}
                  value={h[k]} onChange={e => setH(p => ({ ...p, [k]: e.target.value }))} />
              </Row>
            ))}

            <label style={{ display: 'flex', gap: '7px', alignItems: 'center', fontSize: '0.78rem',
              marginTop: '0.5rem', cursor: me.isAdmin ? 'pointer' : 'default',
              color: me.isAdmin ? 'var(--cream)' : 'var(--muted)' }}>
              <input type="checkbox" checked={me.isAdmin ? o.watermark : true}
                disabled={!me.isAdmin} onChange={e => set('watermark', e.target.checked)}
                style={{ accentColor: 'var(--gold)' }} />
              ลายน้ำ THMA · thaimusicarchive.com
              {!me.isAdmin && <span style={{ fontSize: '0.68rem' }}>(ปิดได้เฉพาะผู้ดูแล)</span>}
            </label>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Btn busy={busy} id="pdf" label="📕 PDF" fn={exportPDF} />
              <Btn busy={busy} id="png" label="🖼 PNG" fn={exportPNG} />
              <Btn busy={busy} id="docx" label="📄 DOCX" fn={exportDOCX} />
              <Btn busy={busy} id="xlsx" label="📊 Excel" fn={exportXLSX} />
            </div>
            {err && <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--gold)' }}>{err}</div>}
            <div style={{ marginTop: '0.6rem', fontSize: '0.68rem', color: 'var(--muted)', lineHeight: 1.7 }}>
              PDF/PNG คมชัดระดับสิ่งพิมพ์ (~290 dpi) · DOCX ฝังภาพหน้าเต็ม · Excel เป็นตารางข้อมูล
            </div>
          </div>

          {/* ── พรีวิว ── */}
          <div style={{ flex: '1 1 380px', minWidth: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>ตัวอย่างก่อนพิมพ์</span>
              <span style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.74rem' }}>
                <button className="btn btn-outline btn-sm" disabled={pageIdx <= 0}
                  onClick={() => setPageIdx(p => p - 1)} >‹</button>
                หน้า {pageIdx + 1} / {pageCount}
                <button className="btn btn-outline btn-sm" disabled={pageIdx >= pageCount - 1}
                  onClick={() => setPageIdx(p => p + 1)} >›</button>
              </span>
            </div>
            <div ref={wrapRef} style={{ background: 'var(--navy3)', borderRadius: '8px', padding: '0.8rem' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
