'use client';
// app/portfolio/page.js — 📁 แฟ้มผลงานของฉัน (2026-08-25)
//   สร้างได้หลายเล่ม · เลือกบันทึกเหตุการณ์ (ของตัวเอง) + ไดอารี่ มาเรียงในเล่ม ใส่คำบรรยายรายรายการ
//   เลือกแม่แบบชุดอักษร 3 ชุด · ขนาดกระดาษ · แนวตั้ง/นอน · 1 รายการต่อหน้า · เปิดเผยแพร่ (ลิงก์สาธารณะ)
//   ตัวอย่างเล่มย่อส่วนแสดงสด ๆ ข้าง ๆ · เปิดเล่มเต็ม/พิมพ์ที่ /portfolio/view?b=<id>
//   ?b=<id> เปิดแก้เล่มนั้น · ?b=new สร้างเล่มใหม่
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { PAPERS, ORIENTATIONS, TEMPLATES, TEMPLATE_KEYS, fontsHref, paperSize, thaiDate, itemDate, parseDate } from '../../lib/portfolio';
import PortfolioBook, { BOOK_CSS } from '../../components/PortfolioBook';

const PX_PER_MM = 96 / 25.4;
const blank = () => ({ id: null, title: 'แฟ้มผลงานของฉัน', subtitle: '', intro: '', template: 'court', paper: 'A4', orientation: 'portrait', one_per_page: false, is_public: false, items: [] });

export default function Page() {
  return <Suspense fallback={<main className="container">กำลังโหลด...</main>}><Portfolio /></Suspense>;
}

function Portfolio() {
  const sp = useSearchParams();
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [books, setBooks] = useState([]);
  const [records, setRecords] = useState([]);       // archive ของฉัน (+ รูป)
  const [diary, setDiary] = useState([]);
  const [draft, setDraft] = useState(null);         // เล่มที่กำลังแก้
  const [tab, setTab] = useState('archive');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const prevRef = useRef(null);
  const [prevH, setPrevH] = useState(0);       // ความสูงจริงของเล่มย่อส่วน (transform ไม่ลด layout height เอง)
  useEffect(() => {
    const el = prevRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setPrevH(el.offsetHeight));
    ro.observe(el); setPrevH(el.offsetHeight);
    return () => ro.disconnect();
  }, [draft]);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null)); }, []);
  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: p }, { data: b }, { data: r }, { data: d }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url, organization, province, bio, points').eq('id', user.id).single(),
      supabase.from('portfolios').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('archive_records').select('id, who_text, what_text, when_text, when_date, where_text, era, description, approved, created_at, archive_media(id, media_type, storage_path, youtube_id)').eq('submitted_by', user.id).order('created_at', { ascending: false }),
      supabase.from('diary_entries').select('*').order('entry_date', { ascending: false }),
    ]);
    setProfile(p ?? null); setBooks(b ?? []); setRecords(r ?? []); setDiary(d ?? []);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  // ?b=
  useEffect(() => {
    const b = sp.get('b');
    if (!b || draft) return;
    if (b === 'new') { setDraft(blank()); return; }
    const bk = books.find(x => String(x.id) === b);
    if (bk) setDraft({ ...bk, items: Array.isArray(bk.items) ? bk.items : [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, books]);

  // แปลงรายการที่เลือกเป็นข้อมูลเต็มสำหรับตัวอย่างเล่ม (โครงเดียวกับ thma_portfolio_view)
  const resolved = useMemo(() => {
    if (!draft) return [];
    return draft.items.map(it => {
      if (it.t === 'archive') {
        const r = records.find(x => x.id === it.id); if (!r) return null;
        const media = r.archive_media ?? [];
        return { t: 'archive', id: r.id, note: it.note ?? '', who: r.who_text, what: r.what_text, when: r.when_text, when_date: r.when_date, where: r.where_text, era: r.era, description: r.description, created_at: r.created_at,
          images: media.filter(m => m.media_type === 'image').map(m => m.storage_path), youtube: media.find(m => m.media_type === 'youtube')?.youtube_id ?? null, approved: r.approved };
      }
      const d = diary.find(x => x.id === it.id); if (!d) return null;
      return { t: 'diary', id: d.id, note: it.note ?? '', title: d.title, body: d.body, entry_date: d.entry_date, images: d.images ?? [], created_at: d.created_at };
    }).filter(Boolean);
  }, [draft, records, diary]);
  const previewData = draft ? { portfolio: draft, owner: profile ?? {}, items: resolved } : null;

  const has = (t, id) => draft?.items.some(x => x.t === t && x.id === id);
  const toggle = (t, id) => setDraft(d => ({ ...d, items: has(t, id) ? d.items.filter(x => !(x.t === t && x.id === id)) : [...d.items, { t, id, note: '' }] }));
  const move = (i, dir) => setDraft(d => { const a = [...d.items]; const j = i + dir; if (j < 0 || j >= a.length) return d; [a[i], a[j]] = [a[j], a[i]]; return { ...d, items: a }; });
  const setNote = (i, note) => setDraft(d => ({ ...d, items: d.items.map((x, j) => j === i ? { ...x, note } : x) }));
  const sortByDate = () => setDraft(d => {
    const key = it => { const r = resolved.find(x => x.t === it.t && x.id === it.id); return parseDate(itemDate(r))?.getTime() ?? 0; };
    return { ...d, items: [...d.items].sort((a, b) => key(a) - key(b)) };
  });
  const set = patch => setDraft(d => ({ ...d, ...patch }));

  async function save() {
    if (!draft) return;
    setBusy(true); setMsg('');
    const row = { title: draft.title, subtitle: draft.subtitle || null, intro: draft.intro || null, template: draft.template, paper: draft.paper, orientation: draft.orientation, one_per_page: !!draft.one_per_page, is_public: !!draft.is_public, items: draft.items };
    const res = draft.id
      ? await supabase.from('portfolios').update(row).eq('id', draft.id).select().single()
      : await supabase.from('portfolios').insert(row).select().single();
    setBusy(false);
    if (res.error) { setMsg('⚠ บันทึกไม่สำเร็จ: ' + res.error.message); return; }
    setDraft({ ...res.data, items: Array.isArray(res.data.items) ? res.data.items : [] });
    setMsg('✓ บันทึกเล่มแล้ว'); setTimeout(() => setMsg(''), 3000);
    load();
  }
  async function del(bk) {
    if (!confirm(`ลบเล่ม "${bk.title}" ? (บันทึก/ไดอารี่ต้นทางไม่ถูกลบ)`)) return;
    const { error } = await supabase.from('portfolios').delete().eq('id', bk.id);
    if (error) { setMsg('⚠ ' + error.message); return; }
    if (draft?.id === bk.id) setDraft(null);
    load();
  }
  const shareUrl = draft?.id && typeof window !== 'undefined' ? `${window.location.origin}/portfolio/view?b=${draft.id}` : '';

  if (user === undefined) return <main className="container">กำลังโหลด...</main>;
  if (!user) return (
    <main className="container" style={{ maxWidth: 500 }}>
      <div className="lock-box">
        <div style={{ fontSize: '2rem' }}>📁</div>
        <div style={{ margin: '0.6rem 0 1rem' }}>แฟ้มผลงานสร้างจากบันทึกของคุณ — เข้าสู่ระบบก่อน</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ / สมัคร</button></Link>
      </div>
    </main>
  );

  // ── รายการเล่ม ──
  if (!draft) return (
    <main className="container" style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>📁 แฟ้มผลงานของฉัน</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 2 }}>
            เลือกบันทึกเหตุการณ์และไดอารี่ที่ภูมิใจ มาเรียงเป็นเล่มสวย ๆ · เลือกแม่แบบ ขนาดกระดาษ แนวตั้ง/นอน แล้วบันทึกเป็น PDF
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={() => setDraft(blank())}>＋ สร้างเล่มใหม่</button>
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 8 }}>
        วัตถุดิบ: บันทึกเหตุการณ์ {records.length} · <Link href="/diary" style={{ color: 'var(--gold2)' }}>ไดอารี่ {diary.length}</Link>
        {!records.length && !diary.length && <> — ยังไม่มีเลย ลอง <Link href="/archive/new" style={{ color: 'var(--gold2)' }}>โพสต์บันทึกเหตุการณ์</Link> หรือ <Link href="/diary" style={{ color: 'var(--gold2)' }}>เขียนไดอารี่</Link> ก่อน</>}
      </div>
      {msg && <div style={{ fontSize: '0.78rem', color: 'var(--gold)', marginBottom: 6 }}>{msg}</div>}
      {!books.length ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.84rem', lineHeight: 1.9 }}>
          ยังไม่มีเล่ม — กด "สร้างเล่มใหม่" เลือกรายการ เลือกแม่แบบ แล้วดูตัวอย่างได้ทันที
        </div>
      ) : books.map(bk => (
        <div key={bk.id} className="card" style={{ padding: '0.7rem 0.9rem', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '1.4rem' }}>{TEMPLATES[bk.template]?.icon ?? '📁'}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 600 }}>{bk.title} {bk.is_public ? <span className="badge" title="เผยแพร่">🌐</span> : <span className="badge" title="ส่วนตัว">🔒</span>}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              {TEMPLATES[bk.template]?.name} · {bk.paper} {ORIENTATIONS[bk.orientation]} · {(bk.items ?? []).length} รายการ · แก้ล่าสุด {thaiDate(bk.updated_at)}
            </div>
          </div>
          <Link href={`/portfolio/view?b=${bk.id}`}><button className="btn btn-outline btn-sm">👁 เปิดเล่ม / พิมพ์</button></Link>
          <button className="btn btn-outline btn-sm" onClick={() => setDraft({ ...bk, items: Array.isArray(bk.items) ? bk.items : [] })}>✎ แก้</button>
          <button className="btn btn-danger btn-sm" onClick={() => del(bk)}>🗑</button>
        </div>
      ))}
    </main>
  );

  // ── แก้เล่ม ──
  const { w } = paperSize(draft.paper, draft.orientation);
  const scale = 300 / (w * PX_PER_MM);
  return (
    <main className="container" style={{ maxWidth: 1200 }}>
      <link rel="stylesheet" href={fontsHref([draft.template])} />
      <style>{BOOK_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setDraft(null)}>← เล่มทั้งหมด</button>
        <div className="section-title" style={{ fontSize: '1.05rem', margin: 0 }}>{draft.id ? '✎ แก้เล่ม' : '＋ เล่มใหม่'}</div>
        <span style={{ flex: 1 }} />
        {msg && <span style={{ fontSize: '0.78rem', color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)' }}>{msg}</span>}
        {draft.id && <Link href={`/portfolio/view?b=${draft.id}`}><button className="btn btn-outline btn-sm">👁 เปิดเล่ม / 🖨 PDF</button></Link>}
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? '⏳' : '💾 บันทึกเล่ม'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }} className="pf-edit-grid">
        <div>
          {/* ข้อมูลเล่ม */}
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input className="form-input" placeholder="ชื่อเล่ม" value={draft.title} onChange={e => set({ title: e.target.value })} />
              <input className="form-input" placeholder="ชื่อรอง (ไม่บังคับ) เช่น ผลงานปีการศึกษา 2569" value={draft.subtitle ?? ''} onChange={e => set({ subtitle: e.target.value })} />
            </div>
            <textarea className="form-input" placeholder="คำนำ (ไม่บังคับ) — จะเป็นหน้าแรกถัดจากปก" value={draft.intro ?? ''} onChange={e => set({ intro: e.target.value })} style={{ width: '100%', minHeight: 70, marginTop: 8, lineHeight: 1.7 }} />
          </div>

          {/* แม่แบบ */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: '0.86rem', marginBottom: 8 }}>ชุดแบบอักษร / แม่แบบ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {TEMPLATE_KEYS.map(k => {
                const t = TEMPLATES[k]; const on = draft.template === k;
                return (
                  <button key={k} onClick={() => set({ template: k })} className="pf-tpl-btn" style={{ textAlign: 'left', cursor: 'pointer', background: on ? 'rgba(201,168,76,0.12)' : 'var(--navy3)', border: `1px solid ${on ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 10px', color: 'var(--cream)' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span>{t.icon}</span><b style={{ fontSize: '0.86rem' }}>{t.name}</b>
                      <span style={{ flex: 1 }} />
                      {t.swatch.map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, border: '1px solid rgba(255,255,255,0.3)' }} />)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, fontSize: '0.78rem' }}>
              <label>กระดาษ <select className="filter-select" value={draft.paper} onChange={e => set({ paper: e.target.value })}>
                {Object.entries(PAPERS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></label>
              <label>แนว <select className="filter-select" value={draft.orientation} onChange={e => set({ orientation: e.target.value })}>
                {Object.entries(ORIENTATIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label><input type="checkbox" checked={!!draft.one_per_page} onChange={e => set({ one_per_page: e.target.checked })} /> 1 รายการต่อหน้า</label>
              <label title="เปิดแล้วใครมีลิงก์ก็เปิดดูได้ · รายการที่ยังไม่อนุมัติจะไม่แสดงให้คนอื่น"><input type="checkbox" checked={!!draft.is_public} onChange={e => set({ is_public: e.target.checked })} /> 🌐 เผยแพร่เล่มนี้</label>
              {draft.is_public && draft.id && (
                <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? '✓ คัดลอกแล้ว' : '🔗 คัดลอกลิงก์'}</button>
              )}
            </div>
          </div>

          {/* เลือกรายการ */}
          <div className="card">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>เลือกรายการใส่เล่ม</span>
              <span style={{ flex: 1 }} />
              <button className={`btn btn-sm ${tab === 'archive' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('archive')}>📍 บันทึกเหตุการณ์ ({records.length})</button>
              <button className={`btn btn-sm ${tab === 'diary' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('diary')}>📔 ไดอารี่ ({diary.length})</button>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}>
              {tab === 'archive' ? (
                !records.length ? <div style={{ padding: 10, fontSize: '0.78rem', color: 'var(--muted)' }}>ยังไม่มีบันทึกเหตุการณ์ของคุณ — <Link href="/archive/new" style={{ color: 'var(--gold2)' }}>โพสต์เลย</Link></div>
                : records.map(r => (
                  <label key={r.id} className="pf-pick" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 6px', fontSize: '0.8rem', cursor: 'pointer', borderBottom: '1px solid rgba(42,63,92,0.35)' }}>
                    <input type="checkbox" checked={has('archive', r.id)} onChange={() => toggle('archive', r.id)} />
                    <span style={{ flex: 1 }}>{r.what_text} <span style={{ color: 'var(--muted)' }}>· {r.when_text} · {r.where_text}</span></span>
                    {!r.approved && <span className="badge" title="ยังไม่อนุมัติ — แสดงเฉพาะคุณ ไม่แสดงในเล่มที่เผยแพร่">รออนุมัติ</span>}
                    {(r.archive_media ?? []).some(m => m.media_type === 'image') && <span title="มีรูป">🖼</span>}
                  </label>
                ))
              ) : (
                !diary.length ? <div style={{ padding: 10, fontSize: '0.78rem', color: 'var(--muted)' }}>ยังไม่มีไดอารี่ — <Link href="/diary" style={{ color: 'var(--gold2)' }}>เขียนเลย</Link></div>
                : diary.map(d => (
                  <label key={d.id} className="pf-pick" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 6px', fontSize: '0.8rem', cursor: 'pointer', borderBottom: '1px solid rgba(42,63,92,0.35)' }}>
                    <input type="checkbox" checked={has('diary', d.id)} onChange={() => toggle('diary', d.id)} />
                    <span style={{ color: 'var(--gold)', width: 92, flexShrink: 0 }}>{thaiDate(d.entry_date)}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title || (d.body ?? '').slice(0, 60)}</span>
                    {(d.images ?? []).length > 0 && <span title="มีรูป">🖼</span>}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* ลำดับในเล่ม */}
          <div className="card">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>ลำดับในเล่ม ({draft.items.length})</span>
              <span style={{ flex: 1 }} />
              <button className="btn btn-outline btn-sm" disabled={draft.items.length < 2} onClick={sortByDate}>📅 เรียงตามวันที่</button>
            </div>
            {!draft.items.length ? <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>ติ๊กเลือกรายการด้านบน</div>
              : draft.items.map((it, i) => {
                const r = resolved.find(x => x.t === it.t && x.id === it.id);
                return (
                  <div key={it.t + it.id} className="pf-order" style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(42,63,92,0.35)', flexWrap: 'wrap' }}>
                    <span style={{ width: 24, textAlign: 'right', color: 'var(--gold)', fontSize: '0.78rem' }}>{i + 1}.</span>
                    <span style={{ fontSize: '0.8rem', flex: 1, minWidth: 160 }}>
                      {it.t === 'diary' ? '📔 ' : '📍 '}{r ? (it.t === 'diary' ? (r.title || thaiDate(r.entry_date)) : r.what) : <i style={{ color: 'var(--muted)' }}>(ไม่พบ — อาจถูกลบ)</i>}
                    </span>
                    <input className="form-input" placeholder="คำบรรยายเพิ่มในเล่ม (ไม่บังคับ)" value={it.note ?? ''} onChange={e => setNote(i, e.target.value)} style={{ flex: 2, minWidth: 180, fontSize: '0.76rem' }} />
                    <button className="btn btn-outline btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                    <button className="btn btn-outline btn-sm" onClick={() => move(i, 1)} disabled={i === draft.items.length - 1}>↓</button>
                    <button className="btn btn-outline btn-sm" onClick={() => toggle(it.t, it.id)}>✕</button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* ตัวอย่างเล่ม (ย่อส่วน) */}
        <div className="pf-preview-col" style={{ position: 'sticky', top: 70 }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 6 }}>ตัวอย่างเล่ม (ย่อส่วน) · {draft.paper} {ORIENTATIONS[draft.orientation]}</div>
          <div style={{ width: 300, maxHeight: '75vh', overflowY: 'auto', overflowX: 'hidden', background: '#3a3f4a', borderRadius: 8, padding: 8 }}>
            <div style={{ height: prevH * scale, overflow: 'hidden' }}>
              <div ref={prevRef} style={{ width: w * PX_PER_MM, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {previewData && <PortfolioBook data={previewData} />}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .pf-edit-grid{grid-template-columns:1fr !important} .pf-preview-col{position:static !important} }`}</style>
    </main>
  );
}
