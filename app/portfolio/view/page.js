'use client';
// app/portfolio/view/page.js — เปิดเล่มแฟ้มผลงาน (?b=<id>) · ดูเป็นหน้ากระดาษจริง · 🖨 บันทึกเป็น PDF (2026-08-25)
//   เจ้าของดูได้เสมอ · คนอื่นดูได้เมื่อเจ้าของเปิดเผยแพร่ · แถบเครื่องมือด้านบนหายไปตอนพิมพ์
//   ปรับกระดาษ/แนว/แม่แบบชั่วคราวได้จากแถบเครื่องมือ (ไม่บันทึก — บันทึกที่หน้า /portfolio)
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { PAPERS, ORIENTATIONS, TEMPLATES, TEMPLATE_KEYS, fontsHref, loadPortfolioView } from '../../../lib/portfolio';
import PortfolioBook, { BOOK_CSS } from '../../../components/PortfolioBook';

const VIEW_CSS = `
.pf-view{background:#3a3f4a;margin:0;padding:22px 10px 60px;min-height:100vh}
.pf-toolbar{position:sticky;top:60px;z-index:50;background:var(--navy2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 auto 18px;max-width:900px;font-size:0.8rem}
.pf-toolbar label{display:flex;gap:4px;align-items:center;color:var(--muted);font-size:0.74rem}
@media print{
  .topbar,.footer,.pf-toolbar,.pf-nav{display:none !important}
  html,body{background:#fff !important;margin:0 !important;padding:0 !important}
  .pf-view{background:#fff !important;padding:0 !important;margin:0 !important;min-height:0}
  .pf-screen .pf-page{box-shadow:none !important;margin:0 !important}
  main{padding:0 !important;margin:0 !important;max-width:none !important}
}
`;

export default function Page() {
  return <Suspense fallback={<main className="container">กำลังโหลด...</main>}><View /></Suspense>;
}

function View() {
  const sp = useSearchParams();
  const id = sp.get('b');
  const [data, setData] = useState(undefined);
  const [me, setMe] = useState(null);
  const [tpl, setTpl] = useState(null);
  const [paper, setPaper] = useState(null);
  const [ori, setOri] = useState(null);
  const [opp, setOpp] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user ?? null)); }, []);
  useEffect(() => {
    if (!id) { setData(null); return; }
    loadPortfolioView(id).then(setData).catch(() => setData(null));
  }, [id]);
  useEffect(() => { document.title = data?.portfolio?.title ? `${data.portfolio.title} — แฟ้มผลงาน` : 'แฟ้มผลงาน'; }, [data]);

  if (data === undefined) return <main className="container">กำลังโหลดเล่ม...</main>;
  if (!data) return (
    <main className="container" style={{ maxWidth: 520, textAlign: 'center', paddingTop: '3rem' }}>
      <div style={{ fontSize: '2rem' }}>📁</div>
      <div style={{ margin: '0.6rem 0', fontWeight: 600 }}>ไม่พบเล่มนี้ หรือเจ้าของยังไม่เปิดเผยแพร่</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>ถ้าเป็นเล่มของคุณ ลองเข้าสู่ระบบก่อน</div>
      <Link href="/portfolio"><button className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>← แฟ้มผลงานของฉัน</button></Link>
    </main>
  );

  const pf = data.portfolio;
  const isOwner = me && me.id === pf.user_id;
  const template = tpl ?? pf.template;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/portfolio/view?b=${pf.id}` : '';
  function copyLink() { navigator.clipboard?.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }

  return (
    <main className="pf-view">
      <link rel="stylesheet" href={fontsHref([template])} />
      <style>{BOOK_CSS}{VIEW_CSS}</style>
      <div className="pf-toolbar">
        <Link href="/portfolio" className="pf-nav" style={{ color: 'var(--gold2)' }}>← แฟ้มผลงาน</Link>
        <b style={{ fontSize: '0.86rem' }}>{pf.title}</b>
        <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>{data.items.length} รายการ · {pf.is_public ? '🌐 เผยแพร่' : '🔒 ส่วนตัว'}</span>
        <span style={{ flex: 1 }} />
        <label>แม่แบบ
          <select className="filter-select" value={template} onChange={e => setTpl(e.target.value)}>
            {TEMPLATE_KEYS.map(k => <option key={k} value={k}>{TEMPLATES[k].icon} {TEMPLATES[k].name}</option>)}
          </select></label>
        <label>กระดาษ
          <select className="filter-select" value={paper ?? pf.paper} onChange={e => setPaper(e.target.value)}>
            {Object.keys(PAPERS).map(k => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label>แนว
          <select className="filter-select" value={ori ?? pf.orientation} onChange={e => setOri(e.target.value)}>
            {Object.entries(ORIENTATIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
        <label><input type="checkbox" checked={opp ?? !!pf.one_per_page} onChange={e => setOpp(e.target.checked)} /> 1 รายการ/หน้า</label>
        {pf.is_public && <button className="btn btn-outline btn-sm" onClick={copyLink}>{copied ? '✓ คัดลอกแล้ว' : '🔗 คัดลอกลิงก์'}</button>}
        {isOwner && <Link href={`/portfolio?b=${pf.id}`}><button className="btn btn-outline btn-sm">✎ แก้เล่ม</button></Link>}
        <button className="btn btn-primary btn-sm" onClick={() => window.print()} title="ในหน้าต่างพิมพ์ เลือกปลายทาง 'บันทึกเป็น PDF' และปิด 'ส่วนหัวและท้ายกระดาษ'">🖨 บันทึกเป็น PDF</button>
      </div>
      <PortfolioBook data={data} template={template} paper={paper ?? undefined} orientation={ori ?? undefined} onePerPage={opp ?? undefined} />
      <div className="pf-nav" style={{ textAlign: 'center', color: '#c9ced8', fontSize: '0.72rem', marginTop: 10 }}>
        เคล็ดลับ: กด 🖨 แล้วเลือกปลายทาง "บันทึกเป็น PDF" · ติ๊ก "กราฟิกพื้นหลัง" · ปิด "ส่วนหัวและท้ายกระดาษ" — ขนาดกระดาษในหน้าต่างพิมพ์จะตรงกับที่เลือกไว้
      </div>
    </main>
  );
}
