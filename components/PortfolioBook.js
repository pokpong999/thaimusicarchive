'use client';
// components/PortfolioBook.js — ตัวเรียงเล่มแฟ้มผลงาน (2026-08-25)
//   รับ data จาก thma_portfolio_view → จัดหน้าเป็นกระดาษจริง (มม.) ตามแม่แบบ/ขนาด/แนวที่เลือก
//   จัดหน้าเองใน JS: วัดความสูงแต่ละรายการ แล้วบรรจุลงหน้าโดยไม่ตัดกลางรายการ (หน้าจอ = สิ่งที่พิมพ์)
//   พิมพ์: @page ขนาดตรงกับกระดาษ ขอบ 0 (กรอบ/สีพื้นถึงขอบกระดาษ) — ขอบขาวอยู่ใน --pad ของแต่ละแม่แบบ
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATES, paperSize, thaiDate, dateRange, archiveImageUrl, diaryImageUrl } from '../lib/portfolio';

const PX_PER_MM = 96 / 25.4;
const PAD = { court: 16, academic: 20, modern: 14 };     // ขอบใน (มม.)
const GAP = { court: 7, academic: 8, modern: 7 };        // ระยะระหว่างรายการ (มม.)
const FOOT = 9;                                          // พื้นที่ท้ายหน้า (เลขหน้า) มม.

export const BOOK_CSS = `
.pf-book{--pw:210mm;--ph:297mm;--pad:16mm;--gap:7mm;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pf-book *{box-sizing:border-box}
.pf-page{position:relative;width:var(--pw);height:var(--ph);padding:var(--pad);overflow:hidden;break-after:page;page-break-after:always;margin:0 auto}
.pf-page.pf-tall{height:auto;min-height:var(--ph);overflow:visible}
.pf-page:last-child{break-after:auto;page-break-after:auto}
.pf-screen .pf-page{box-shadow:0 6px 24px rgba(0,0,0,.35);margin-bottom:18px}
.pf-foot{position:absolute;left:var(--pad);right:var(--pad);bottom:calc(var(--pad) * .45);font-size:8.5pt;display:flex;justify-content:space-between;align-items:baseline;gap:4mm}
.pf-foot span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf-item{break-inside:avoid;page-break-inside:avoid;position:relative}
.pf-item+.pf-item{margin-top:var(--gap)}
.pf-body p{margin:0 0 1.6mm}
.pf-body{white-space:pre-wrap;word-break:break-word}
.pf-imgs{display:grid;gap:2mm;margin-top:3mm}
.pf-imgs.n1{grid-template-columns:1fr}.pf-imgs.n2{grid-template-columns:1fr 1fr}.pf-imgs.n3{grid-template-columns:repeat(3,1fr)}
.pf-imgs figure{margin:0}
.pf-imgs img{display:block;width:100%;height:42mm;object-fit:cover}
.pf-imgs.n1 img{width:auto;max-width:100%;height:auto;max-height:95mm;margin:0 auto}
.pf-landscape .pf-imgs img{height:34mm}.pf-landscape .pf-imgs.n1 img{max-height:70mm}
.pf-small .pf-imgs img{height:30mm}.pf-small .pf-imgs.n1 img{max-height:60mm}
.pf-meta{display:flex;flex-wrap:wrap}
.pf-yt{font-size:9pt;margin-top:2mm;word-break:break-all}
.pf-intro-body{white-space:pre-wrap;font-size:11pt;line-height:1.85}
.pf-measure{position:absolute;left:-200vw;top:0;visibility:hidden;pointer-events:none}
.pf-empty{opacity:.6;text-align:center;padding:20mm 0}

/* ── ราชสำนัก ── */
.tpl-court{--bg:#f7efdc;--ink:#2b2115;--gold:#b08d3c;--muted:#7d6a4a;font-family:'Pridi','Noto Serif Thai',serif;font-weight:300;color:var(--ink)}
.tpl-court .pf-page{background:var(--bg)}
.tpl-court .pf-page::before{content:'';position:absolute;inset:7mm;border:1pt solid var(--gold);pointer-events:none}
.tpl-court .pf-page::after{content:'';position:absolute;inset:8.4mm;border:.35pt solid var(--gold);pointer-events:none}
.tpl-court .pf-cover{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.tpl-court .pf-orn{color:var(--gold);font-size:16pt;letter-spacing:5pt}
.tpl-court .pf-cover h1{font-family:'Charm',cursive;font-weight:700;font-size:34pt;line-height:1.2;margin:6mm 0 2mm;color:var(--ink)}
.tpl-court .pf-cover .pf-sub{font-size:13pt;color:var(--muted);font-weight:300}
.tpl-court .pf-owner{margin-top:14mm;font-size:14pt;font-weight:400}
.tpl-court .pf-owner small{display:block;font-size:10pt;color:var(--muted);font-weight:300;margin-top:1mm}
.tpl-court .pf-range{margin-top:7mm;font-size:9.5pt;color:var(--muted);letter-spacing:1pt}
.tpl-court .pf-brand{position:absolute;bottom:12mm;left:0;right:0;text-align:center;font-size:8.5pt;color:var(--muted);letter-spacing:.5pt}
.tpl-court .pf-sect{font-family:'Charm',cursive;font-weight:700;font-size:24pt;text-align:center;color:var(--gold);margin:4mm 0 6mm}
.tpl-court .pf-h{font-family:'Charm',cursive;font-weight:700;font-size:18pt;margin:0 0 .5mm;line-height:1.25}
.tpl-court .pf-num{font-family:'Charm',cursive;color:var(--gold);font-size:11pt;letter-spacing:2pt}
.tpl-court .pf-meta{font-size:9.5pt;color:var(--muted);margin-bottom:2.5mm;padding-bottom:1.5mm;border-bottom:.5pt solid var(--gold)}
.tpl-court .pf-meta span+span::before{content:' · ';color:var(--gold)}
.tpl-court .pf-body{font-size:11pt;line-height:1.8;text-align:justify}
.tpl-court .pf-imgs img{border:.6pt solid var(--gold);padding:1mm;background:#fff}
.tpl-court .pf-note{font-style:italic;color:var(--muted);font-size:10pt;margin-top:2.5mm;border-left:1.5pt solid var(--gold);padding-left:3mm}
.tpl-court .pf-date{font-family:'Charm',cursive;font-weight:700;font-size:15pt;color:var(--gold);line-height:1.2}
.tpl-court .pf-foot{color:var(--muted)}
.tpl-court .pf-yt{color:var(--muted)}

/* ── วิชาการ ── */
.tpl-academic{--bg:#fff;--ink:#111;--muted:#666;font-family:'Sarabun','Noto Sans Thai',sans-serif;color:var(--ink)}
.tpl-academic .pf-page{background:#fff}
.tpl-academic .pf-cover{display:flex;flex-direction:column;justify-content:space-between}
.tpl-academic .pf-tag{font-family:'Taviraj',serif;font-size:10pt;letter-spacing:3pt;color:var(--muted)}
.tpl-academic .pf-cover h1{font-family:'Taviraj',serif;font-weight:700;font-size:30pt;line-height:1.25;margin:0;padding:6mm 0;border-top:2.5pt solid var(--ink);border-bottom:.5pt solid var(--ink)}
.tpl-academic .pf-cover .pf-sub{font-size:13pt;color:var(--muted);margin-top:4mm}
.tpl-academic .pf-owner{font-family:'Taviraj',serif;font-size:15pt;font-weight:600}
.tpl-academic .pf-owner small{display:block;font-family:'Sarabun';font-size:10pt;color:var(--muted);font-weight:400;margin-top:1mm}
.tpl-academic .pf-range{font-size:9.5pt;color:var(--muted);margin-top:3mm}
.tpl-academic .pf-brand{font-size:8.5pt;color:var(--muted);margin-top:2mm}
.tpl-academic .pf-head{position:absolute;top:calc(var(--pad) * .45);left:var(--pad);right:var(--pad);font-size:8pt;color:var(--muted);border-bottom:.5pt solid #bbb;padding-bottom:1mm;display:flex;justify-content:space-between}
.tpl-academic .pf-sect{font-family:'Taviraj',serif;font-weight:700;font-size:20pt;margin:0 0 5mm;padding-bottom:2mm;border-bottom:1.5pt solid var(--ink)}
.tpl-academic .pf-item{display:grid;grid-template-columns:12mm 1fr;column-gap:3mm}
.tpl-academic .pf-item+.pf-item{border-top:.5pt solid #bbb;padding-top:calc(var(--gap) * .55);margin-top:calc(var(--gap) * .45)}
.tpl-academic .pf-num{font-family:'Taviraj',serif;font-size:13pt;font-weight:600;padding-top:.5mm}
.tpl-academic .pf-h{font-family:'Taviraj',serif;font-weight:600;font-size:15pt;margin:0;line-height:1.3}
.tpl-academic .pf-meta{font-size:9pt;color:var(--muted);margin:1mm 0 2mm}
.tpl-academic .pf-meta span+span::before{content:'  |  ';white-space:pre}
.tpl-academic .pf-body{font-size:10.5pt;line-height:1.7}
.tpl-academic .pf-imgs img{border:.4pt solid #999}
.tpl-academic .pf-imgs figcaption{font-size:8pt;color:var(--muted);text-align:center;margin-top:1mm}
.tpl-academic .pf-note{font-size:9.5pt;color:var(--muted);margin-top:2mm}
.tpl-academic .pf-date{font-family:'Taviraj',serif;font-weight:600;font-size:12pt}
.tpl-academic .pf-foot{font-size:8.5pt;color:var(--muted);border-top:.5pt solid #bbb;padding-top:1.2mm}
.tpl-academic .pf-yt{color:var(--muted)}

/* ── ทันสมัย ── */
.tpl-modern{--navy:#0f1a2b;--gold:#c9a84c;--ink:#1a2233;--muted:#6b7686;font-family:'Bai Jamjuree','Noto Sans Thai',sans-serif;color:var(--ink)}
.tpl-modern .pf-page{background:#fff}
.tpl-modern .pf-page:not(.pf-cover)::before{content:'';position:absolute;left:0;top:0;width:100%;height:4.5mm;background:var(--navy)}
.tpl-modern .pf-page:not(.pf-cover)::after{content:'';position:absolute;left:0;top:4.5mm;width:28%;height:1.2mm;background:var(--gold)}
.tpl-modern .pf-cover{background:var(--navy);color:#fff;display:flex;flex-direction:column;justify-content:flex-end}
.tpl-modern .pf-cover::before{content:'';position:absolute;top:0;right:0;width:45%;height:100%;background:linear-gradient(160deg,rgba(201,168,76,.28),transparent 62%)}
.tpl-modern .pf-cover::after{content:'';position:absolute;left:var(--pad);top:var(--pad);width:18mm;height:18mm;border:2pt solid var(--gold);border-right:none;border-bottom:none}
.tpl-modern .pf-tag{font-family:'Kanit',sans-serif;font-weight:600;font-size:10pt;letter-spacing:3pt;color:var(--gold);text-transform:uppercase}
.tpl-modern .pf-cover h1{font-family:'Kanit',sans-serif;font-weight:700;font-size:40pt;line-height:1.1;margin:3mm 0;color:#fff}
.tpl-modern .pf-cover .pf-sub{font-size:13pt;color:rgba(255,255,255,.75)}
.tpl-modern .pf-owner{margin-top:10mm;padding-top:4mm;border-top:1.5pt solid var(--gold);font-family:'Kanit',sans-serif;font-size:15pt;font-weight:600}
.tpl-modern .pf-owner small{display:block;font-family:'Bai Jamjuree';font-size:10pt;color:rgba(255,255,255,.7);font-weight:400}
.tpl-modern .pf-range{font-size:9.5pt;color:rgba(255,255,255,.6);margin-top:2mm}
.tpl-modern .pf-brand{font-size:8.5pt;color:rgba(255,255,255,.5);margin-top:6mm}
.tpl-modern .pf-sect{font-family:'Kanit',sans-serif;font-weight:700;font-size:22pt;color:var(--navy);margin:2mm 0 5mm}
.tpl-modern .pf-item{border-left:2.5pt solid var(--gold);padding-left:5mm}
.tpl-modern .pf-num{position:absolute;right:0;top:-3mm;font-family:'Kanit',sans-serif;font-weight:700;font-size:28pt;color:rgba(15,26,43,.08);line-height:1}
.tpl-modern .pf-h{font-family:'Kanit',sans-serif;font-weight:600;font-size:16pt;margin:0;line-height:1.3;color:var(--navy)}
.tpl-modern .pf-meta{gap:1.5mm;margin:1.5mm 0 2.5mm}
.tpl-modern .pf-meta span{background:#eef1f6;color:var(--navy);border-radius:3mm;padding:.4mm 3mm;font-size:8.5pt;font-weight:500}
.tpl-modern .pf-body{font-size:10.5pt;line-height:1.7}
.tpl-modern .pf-imgs img{border-radius:2.5mm}
.tpl-modern .pf-note{background:#fbf6e8;border-radius:2mm;padding:2mm 3mm;font-size:9.5pt;color:#5a4a1e;margin-top:2.5mm}
.tpl-modern .pf-date{font-family:'Kanit',sans-serif;font-weight:700;font-size:22pt;color:var(--gold);line-height:1}
.tpl-modern .pf-foot{font-family:'Kanit',sans-serif;font-size:8.5pt;color:var(--muted)}
.tpl-modern .pf-foot b{color:var(--navy)}
.tpl-modern .pf-yt{color:var(--navy)}
`;

const pad2 = n => String(n).padStart(2, '0');
function splitParas(text) { return String(text ?? '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean); }

function Images({ paths, bucket, template }) {
  const list = (paths ?? []).filter(Boolean).slice(0, 6);
  if (!list.length) return null;
  const url = bucket === 'diary' ? diaryImageUrl : archiveImageUrl;
  const n = list.length === 1 ? 'n1' : list.length === 2 || list.length === 4 ? 'n2' : 'n3';
  return (
    <div className={`pf-imgs ${n}`}>
      {list.map((p, i) => (
        <figure key={p + i}>
          <img src={url(p)} alt="" loading="eager" />
          {template === 'academic' && <figcaption>ภาพที่ {i + 1}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

function Item({ it, idx, template }) {
  const num = pad2(idx + 1);
  if (it.t === 'diary') {
    return (
      <article className="pf-item pf-diary">
        <div className="pf-num">{template === 'academic' ? `${idx + 1}.` : num}</div>
        <div>
          <div className="pf-date">{thaiDate(it.entry_date, { long: true, weekday: template !== 'modern' })}</div>
          {it.title && <h2 className="pf-h">{it.title}</h2>}
          <div className="pf-meta"><span>บันทึกส่วนตัว</span></div>
          <div className="pf-body">{splitParas(it.body).map((p, i) => <p key={i}>{p}</p>)}</div>
          <Images paths={it.images} bucket="diary" template={template} />
          {it.note && <div className="pf-note">{it.note}</div>}
        </div>
      </article>
    );
  }
  return (
    <article className="pf-item pf-archive">
      <div className="pf-num">{template === 'academic' ? `${idx + 1}.` : num}</div>
      <div>
        <h2 className="pf-h">{it.what}</h2>
        <div className="pf-meta">
          {it.when && <span>เมื่อ {it.when}</span>}
          {it.where && <span>ที่ {it.where}</span>}
          {it.who && <span>{it.who}</span>}
        </div>
        {it.description && <div className="pf-body">{splitParas(it.description).map((p, i) => <p key={i}>{p}</p>)}</div>}
        <Images paths={it.images} bucket="archive" template={template} />
        {it.youtube && <div className="pf-yt">🎬 วิดีโอ: youtube.com/watch?v={it.youtube}</div>}
        {it.note && <div className="pf-note">{it.note}</div>}
      </div>
    </article>
  );
}

function Cover({ pf, owner, items, template }) {
  const range = dateRange(items);
  const ownerBlock = (
    <div className="pf-owner">{owner?.display_name ?? 'สมาชิก'}
      <small>{[owner?.organization, owner?.province].filter(Boolean).join(' · ')}</small>
    </div>
  );
  if (template === 'court') return (
    <section className="pf-page pf-cover">
      <div className="pf-orn">✦ ❖ ✦</div>
      <h1>{pf.title}</h1>
      {pf.subtitle && <div className="pf-sub">{pf.subtitle}</div>}
      {ownerBlock}
      <div className="pf-range">{range}{range ? ' · ' : ''}{items.length} รายการ</div>
      <div className="pf-orn" style={{ marginTop: '10mm' }}>✦</div>
      <div className="pf-brand">หอจดหมายเหตุดนตรีไทย · thaimusicarchive.com</div>
    </section>
  );
  if (template === 'academic') return (
    <section className="pf-page pf-cover">
      <div className="pf-tag">แฟ้มผลงาน · PORTFOLIO</div>
      <div>
        <h1>{pf.title}</h1>
        {pf.subtitle && <div className="pf-sub">{pf.subtitle}</div>}
      </div>
      <div>
        {ownerBlock}
        <div className="pf-range">{range}{range ? ' · ' : ''}{items.length} รายการ</div>
        <div className="pf-brand">รวบรวมจาก หอจดหมายเหตุดนตรีไทย · thaimusicarchive.com</div>
      </div>
    </section>
  );
  return (
    <section className="pf-page pf-cover">
      <div style={{ position: 'relative' }}>
        <div className="pf-tag">Portfolio · แฟ้มผลงาน</div>
        <h1>{pf.title}</h1>
        {pf.subtitle && <div className="pf-sub">{pf.subtitle}</div>}
        {ownerBlock}
        <div className="pf-range">{range}{range ? ' · ' : ''}{items.length} รายการ</div>
        <div className="pf-brand">หอจดหมายเหตุดนตรีไทย · thaimusicarchive.com</div>
      </div>
    </section>
  );
}

function Foot({ pf, owner, page, total, template }) {
  return (
    <div className="pf-foot">
      <span>{template === 'modern' ? <><b>{pf.title}</b> · {owner?.display_name}</> : `${pf.title} · ${owner?.display_name ?? ''}`}</span>
      <span>{template === 'court' ? `— ${page} —` : template === 'academic' ? `หน้า ${page} / ${total}` : `${page} / ${total}`}</span>
    </div>
  );
}

// จัดหน้า: วัดความสูงรายการ (px → mm) แล้วบรรจุลงหน้า
function packPages(heights, gap, avail) {
  const pages = []; let cur = [], used = 0;
  heights.forEach((h, i) => {
    const need = cur.length ? gap + h : h;
    if (cur.length && used + need > avail) { pages.push(cur); cur = []; used = 0; }
    cur.push(i); used += cur.length === 1 ? h : need;
  });
  if (cur.length) pages.push(cur);
  return pages;
}

export default function PortfolioBook({ data, template: tplProp, paper: paperProp, orientation: oriProp, onePerPage: oppProp, screen = true }) {
  const pf = data?.portfolio ?? {};
  const owner = data?.owner ?? {};
  const items = data?.items ?? [];
  const template = TEMPLATES[tplProp ?? pf.template] ? (tplProp ?? pf.template) : 'court';
  const paper = paperProp ?? pf.paper ?? 'A4';
  const orientation = oriProp ?? pf.orientation ?? 'portrait';
  const onePerPage = oppProp ?? !!pf.one_per_page;
  const { w, h } = paperSize(paper, orientation);
  const pad = PAD[template], gap = GAP[template];
  const availH = h - 2 * pad - FOOT - (template === 'academic' ? 6 : template === 'modern' ? 3 : 0);
  const contentW = w - 2 * pad;

  const measRef = useRef(null);
  const [heights, setHeights] = useState(null);
  const key = `${template}|${paper}|${orientation}|${items.length}|${items.map(i => i.t + i.id + ':' + (i.note?.length ?? 0)).join(',')}`;
  useLayoutEffect(() => {
    const el = measRef.current;
    if (!el) return;
    const measure = () => setHeights(Array.from(el.children).map(c => c.offsetHeight / PX_PER_MM));   // offsetHeight ไม่ถูก transform/zoom ของตัวอย่างย่อส่วน
    measure();
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) measure(); });
    const t = setTimeout(measure, 600);       // เผื่อรูป/ฟอนต์โหลดช้า
    return () => { alive = false; clearTimeout(t); };
  }, [key]);

  const pages = useMemo(() => {
    if (!items.length) return [];
    if (onePerPage) return items.map((_, i) => [i]);
    if (!heights || heights.length !== items.length) return [items.map((_, i) => i)];
    return packPages(heights, gap, availH);
  }, [items, heights, onePerPage, gap, availH]);

  const introPages = pf.intro ? 1 : 0;
  const total = 1 + introPages + pages.length;
  const sizeCls = w < 170 ? 'pf-small' : '';
  const style = { '--pw': `${w}mm`, '--ph': `${h}mm`, '--pad': `${pad}mm`, '--gap': `${gap}mm` };

  return (
    <div className={`pf-book tpl-${template} pf-${orientation} ${sizeCls} ${screen ? 'pf-screen' : ''}`} style={style} data-pages={total}>
      <style>{`@page{size:${w}mm ${h}mm;margin:0}`}</style>
      {/* กล่องวัดความสูง (ซ่อน) — กว้างเท่าพื้นที่เนื้อหา */}
      <div ref={measRef} className="pf-measure" style={{ width: `${contentW}mm` }} aria-hidden="true">
        {items.map((it, i) => <Item key={it.t + it.id} it={it} idx={i} template={template} />)}
      </div>

      <Cover pf={pf} owner={owner} items={items} template={template} />

      {pf.intro && (
        <section className="pf-page pf-tall">
          {template === 'academic' && <div className="pf-head"><span>{pf.title}</span><span>{owner?.display_name}</span></div>}
          <h2 className="pf-sect">คำนำ</h2>
          <div className="pf-intro-body">{pf.intro}</div>
          <Foot pf={pf} owner={owner} page={2} total={total} template={template} />
        </section>
      )}

      {!items.length && (
        <section className="pf-page">
          <div className="pf-empty">ยังไม่ได้เลือกรายการใส่เล่ม</div>
          <Foot pf={pf} owner={owner} page={2} total={total} template={template} />
        </section>
      )}

      {pages.map((idxs, pi) => {
        const tall = idxs.length === 1 && heights && heights[idxs[0]] > availH;
        return (
          <section key={pi} className={`pf-page${tall ? ' pf-tall' : ''}`}>
            {template === 'academic' && <div className="pf-head"><span>{pf.title}</span><span>{owner?.display_name}</span></div>}
            {idxs.map(i => <Item key={items[i].t + items[i].id} it={items[i]} idx={i} template={template} />)}
            <Foot pf={pf} owner={owner} page={2 + introPages + pi} total={total} template={template} />
          </section>
        );
      })}
    </div>
  );
}
