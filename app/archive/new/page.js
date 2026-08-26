'use client';
// app/archive/new/page.js — บันทึกเหตุการณ์เข้าหอจดหมายเหตุ
//   ระบบร่าง (Pk 2026-08-26): เก็บร่างอัตโนมัติลงตาราง drafts ทุก ~2 วิ + ปุ่ม 💾 บันทึกร่าง
//   รูปที่แนบถูกอัปโหลดเก็บไว้ตั้งแต่ตอนบันทึกร่าง (เก็บ path ไว้ในร่าง) — กลับมาแก้ต่อแล้วรูปยังอยู่
import { FeaturePage } from '../../../components/Gate';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase, extractYouTubeId } from '../../../lib/supabase';
import LeafletMap from '../../../components/LeafletMap';
import { shrinkImage } from '../../../lib/imgresize';
import PinColorHint from '../../../components/PinColorHint';
import DraftBar from '../../../components/DraftBar';
import { listDrafts, getDraft, saveDraft, deleteDraft, makeAutoSaver } from '../../../lib/drafts';

export default function NewArchiveRecord() {
  const [user, setUser] = useState(null);
  const [who, setWho] = useState('');
  const [what, setWhat] = useState('');
  const [whenText, setWhenText] = useState('');
  const [whenDate, setWhenDate] = useState('');
  const [where, setWhere] = useState('');
  const [era, setEra] = useState('past');
  const [desc, setDesc] = useState('');
  const [pos, setPos] = useState(null);           // [lat, lng]
  const [fly, setFly] = useState(null);
  const [placeQ, setPlaceQ] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [files, setFiles] = useState([]);
  const [ytUrl, setYtUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // รูปที่อัปโหลดเก็บไว้แล้วตอนบันทึกร่าง [{path, name}] — ส่งจริงค่อยผูกเข้า archive_media
  const [uploaded, setUploaded] = useState([]);

  // ── ร่าง ──
  const draftIdRef = useRef(null);
  const [draftId, setDraftId] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draftErr, setDraftErr] = useState('');
  const [others, setOthers] = useState([]);
  const [ready, setReady] = useState(false);
  const fRef = useRef({});
  fRef.current = { who, what, whenText, whenDate, where, era, desc, pos, ytUrl, uploaded };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const applyDraft = useCallback(d => {
    const p = d?.payload ?? {};
    draftIdRef.current = d?.id ?? null; setDraftId(d?.id ?? null);
    setWho(p.who ?? ''); setWhat(p.what ?? ''); setWhenText(p.whenText ?? ''); setWhenDate(p.whenDate ?? '');
    setWhere(p.where ?? ''); setEra(p.era ?? 'past'); setDesc(p.desc ?? ''); setYtUrl(p.ytUrl ?? '');
    setPos(Array.isArray(p.pos) ? p.pos : null);
    if (Array.isArray(p.pos)) setFly([p.pos[0], p.pos[1], 15]);
    setUploaded(Array.isArray(p.uploaded) ? p.uploaded : []);
    setSavedAt(d?.updated_at ?? null);
    try { const u = new URL(window.location.href); if (d?.id) u.searchParams.set('draft', d.id); else u.searchParams.delete('draft'); window.history.replaceState(null, '', u.toString()); } catch (e) {}
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const wanted = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('draft') : null;
      const { drafts } = await listDrafts('archive');
      if (wanted) { const { draft } = await getDraft(wanted); if (draft) applyDraft(draft); }
      setOthers(drafts.filter(d => String(d.id) !== String(wanted)));
      setReady(true);
    })();
  }, [user, applyDraft]);

  const saverRef = useRef(null);
  if (!saverRef.current) saverRef.current = makeAutoSaver({
    kind: 'archive',
    getId: () => draftIdRef.current,
    setId: id => { draftIdRef.current = id; setDraftId(id); try { const u = new URL(window.location.href); u.searchParams.set('draft', id); window.history.replaceState(null, '', u.toString()); } catch (e) {} },
    onSaved: (id, at) => { setSaving(false); setSavedAt(at); setDraftErr(''); },
    onError: e => { setSaving(false); setDraftErr(e?.message ?? String(e)); },
  });

  useEffect(() => {
    if (!ready || !user) return;
    const p = fRef.current;
    if (!p.who && !p.what && !p.whenText && !p.where && !p.desc && !p.uploaded.length) return;
    setSaving(true);
    saverRef.current.push({ ...p }, p.what || p.who || '(ยังไม่ตั้งชื่อเหตุการณ์)');
  }, [ready, user, who, what, whenText, whenDate, where, era, desc, pos, ytUrl, uploaded]);
  useEffect(() => { const h = () => saverRef.current?.flush(); window.addEventListener('pagehide', h); return () => window.removeEventListener('pagehide', h); }, []);

  async function saveNow() {
    if (!user) return;
    setSaving(true); setDraftErr('');
    // รูปที่เพิ่งเลือก อัปโหลดเก็บไว้กับร่างเลย จะได้ไม่หายตอนปิดหน้า
    const up = await uploadPicked();
    const p = { ...fRef.current, uploaded: up };
    const { id, error } = await saveDraft({ id: draftIdRef.current, kind: 'archive', title: p.what || p.who || '(ยังไม่ตั้งชื่อเหตุการณ์)', payload: p });
    setSaving(false);
    if (error) { setDraftErr(error.message); return; }
    if (id && id !== draftIdRef.current) { draftIdRef.current = id; setDraftId(id); }
    setSavedAt(new Date());
    setMsg('📝 บันทึกร่างแล้ว — กลับมาแก้ต่อได้จากหน้า "จดหมายเหตุของฉัน"');
  }
  async function discardDraft() {
    if (!draftIdRef.current) return;
    if (!confirm('ทิ้งร่างนี้?')) return;
    saverRef.current.cancel();
    await deleteDraft(draftIdRef.current);
    draftIdRef.current = null; setDraftId(null); setSavedAt(null);
    try { const u = new URL(window.location.href); u.searchParams.delete('draft'); window.history.replaceState(null, '', u.toString()); } catch (e) {}
    setMsg('ทิ้งร่างแล้ว');
  }
  // อัปโหลดรูปที่เลือกไว้ (ถ้ายังไม่ได้อัป) → คืนรายการรูปทั้งหมดของร่างนี้
  async function uploadPicked() {
    const picked = Array.from(files ?? []).slice(0, 5 - uploaded.length);
    if (!picked.length) return uploaded;
    const out = [...uploaded];
    for (let i = 0; i < picked.length; i++) {
      setMsg(`กำลังอัปโหลดรูป ${i + 1}/${picked.length}...`);
      const file = await shrinkImage(picked[i], 2000, 0.85);
      if (file.size > 5 * 1024 * 1024) continue;
      const path = `drafts/${user.id}/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from('archive-images').upload(path, file);
      if (error) continue;
      out.push({ path, name: picked[i].name });
    }
    setFiles([]); setUploaded(out); setMsg('');
    return out;
  }

  async function searchPlace() {
    if (!placeQ.trim()) return;
    setSearching(true); setPlaceResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=th&q=${encodeURIComponent(placeQ)}`
      );
      const data = await res.json();
      setPlaceResults(data ?? []);
      if (!data?.length) setMsg('⚠ ไม่พบสถานที่ ลองคำอื่น เช่น เพิ่มชื่อจังหวัด');
    } catch { setMsg('⚠ ค้นหาไม่สำเร็จ ลองใหม่'); }
    setSearching(false);
  }

  function pickPlace(r) {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    setPos([lat, lng]);
    setFly([lat, lng, 16]);
    setPlaceResults([]);
    if (!where.trim()) setWhere(r.display_name.split(',').slice(0, 2).join(','));
  }

  async function submit() {
    if (!who || !what || !whenText || !where) { setMsg('⚠ กรอก ใคร / ทำอะไร / เมื่อไหร่ / ที่ไหน ให้ครบ'); return; }
    setBusy(true); setMsg('กำลังบันทึก...');

    const { data: rec, error } = await supabase.from('archive_records').insert({
      who_text: who, what_text: what, when_text: whenText,
      when_date: whenDate || null, where_text: where, era,
      description: desc || null, submitted_by: user.id,
      lat: pos ? pos[0] : null, lng: pos ? pos[1] : null,
    }).select().single();
    if (error) { setMsg('⚠ ' + error.message); setBusy(false); return; }

    const skipped = [];
    // รูปที่อัปโหลดไว้ตั้งแต่ตอนเป็นร่างแล้ว — ผูกเข้าเหตุการณ์ได้เลย ไม่ต้องอัปซ้ำ
    for (const u of uploaded) {
      await supabase.from('archive_media').insert({ record_id: rec.id, media_type: 'image', storage_path: u.path });
    }
    const picked = Array.from(files ?? []).slice(0, Math.max(0, 5 - uploaded.length));
    for (let i = 0; i < picked.length; i++) {
      setMsg(`กำลังอัปโหลดรูป ${i + 1}/${picked.length}...`);
      // ย่อรูปก่อนอัปโหลด — รูปจากกล้องใหญ่เกินไปทั้งสำหรับเว็บและภาพแชร์
      const file = await shrinkImage(picked[i], 2000, 0.85);
      if (file.size > 5 * 1024 * 1024) { skipped.push(picked[i].name); continue; }
      const path = `${rec.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('archive-images').upload(path, file);
      if (upErr) { skipped.push(picked[i].name); continue; }
      await supabase.from('archive_media').insert({ record_id: rec.id, media_type: 'image', storage_path: path });
    }

    const ytId = extractYouTubeId(ytUrl);
    if (ytId) {
      await supabase.from('archive_media').insert({ record_id: rec.id, media_type: 'youtube', youtube_id: ytId });
    }

    // ส่งสำเร็จ → ร่างหมดหน้าที่
    saverRef.current.cancel();
    await deleteDraft(draftIdRef.current);
    draftIdRef.current = null; setDraftId(null); setSavedAt(null);
    try { const u = new URL(window.location.href); u.searchParams.delete('draft'); window.history.replaceState(null, '', u.toString()); } catch (e) {}

    setMsg('✓ บันทึกแล้ว — รอ Admin อนุมัติก่อนแสดงสาธารณะ' + (skipped.length ? ` (อัปโหลดรูปไม่สำเร็จ ${skipped.length} ไฟล์: ${skipped.join(', ')})` : ''));
    setBusy(false);
    setWho(''); setWhat(''); setWhenText(''); setWhenDate(''); setWhere(''); setDesc(''); setYtUrl(''); setFiles([]); setPos(null); setUploaded([]);
  }

  if (!user) return (
    <main className="container" style={{maxWidth:'500px'}}>
      <div className="lock-box">
        <div style={{marginBottom:'1rem'}}>เข้าสู่ระบบเพื่อบันทึกเหตุการณ์</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ / สมัคร</button></Link>
      </div>
    </main>
  );

  return (
    <FeaturePage feature="archive_submit">
    <main className="container" style={{maxWidth:'640px'}}>
      <Link href="/archive"><span style={{color:'var(--muted)',fontSize:'0.8rem'}}>← กลับหอจดหมายเหตุ</span></Link>
      <div className="card" style={{marginTop:'1rem'}}>
        <div className="section-title" style={{fontSize:'1.1rem'}}>บันทึกเหตุการณ์ใหม่</div>
        <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:'1.3rem'}}>
          ใคร ทำอะไร เมื่อไหร่ ที่ไหน · ปักหมุดแผนที่ + แนบรูปและวิดีโอ
        </div>

        <DraftBar kind="archive" draftId={draftId} savedAt={savedAt} saving={saving} error={draftErr} others={others}
          onSave={saveNow} onDiscard={discardDraft}
          onOpen={d => { applyDraft(d); setOthers(o => o.filter(x => x.id !== d.id)); setMsg('เปิดร่าง "' + (d.title ?? '') + '" มาแก้ต่อแล้ว'); }} />

        <div className="form-group">
          <label className="form-label">ยุค *</label>
          <select className="form-input" value={era} onChange={e => setEra(e.target.value)}>
            <option value="past">อดีต — เหตุการณ์ที่ผ่านมาแล้ว</option>
            <option value="present">ปัจจุบัน — กำลังเกิดขึ้น</option>
            <option value="future">อนาคต — กำหนดการที่จะมาถึง</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">ใคร * (บุคคล / วง / สำนัก)</label>
          <input className="form-input" value={who} onChange={e => setWho(e.target.value)}
            placeholder="เช่น หลวงประดิษฐไพเราะ (ศร ศิลปบรรเลง)" />
        </div>
        <div className="form-group">
          <label className="form-label">ทำอะไร * (เหตุการณ์)</label>
          <input className="form-input" value={what} onChange={e => setWhat(e.target.value)}
            placeholder="เช่น ประชันปี่พาทย์กับวงพาทยโกศล" />
        </div>
        <div className="form-group">
          <label className="form-label">เมื่อไหร่ * (ระบุแบบยืดหยุ่น)</label>
          <input className="form-input" value={whenText} onChange={e => setWhenText(e.target.value)}
            placeholder="เช่น พ.ศ. 2466 หรือ 14 มิถุนายน 2568" />
        </div>
        <div className="form-group">
          <label className="form-label">วันที่ (ถ้าทราบแน่นอน — ใช้เรียงลำดับ)</label>
          <input className="form-input" type="date" value={whenDate} onChange={e => setWhenDate(e.target.value)} />
        </div>
        <PinColorHint whenText={whenText} whenDate={whenDate} />
        <div className="form-group">
          <label className="form-label">ที่ไหน * (ชื่อสถานที่)</label>
          <input className="form-input" value={where} onChange={e => setWhere(e.target.value)}
            placeholder="เช่น วังบางขุนพรหม กรุงเทพฯ" />
        </div>
        <div className="form-group">
          <label className="form-label">📍 ตำแหน่งเหตุการณ์ — ค้นหาหรือคลิกบนแผนที่</label>
          <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
            <input className="form-input" value={placeQ} onChange={e => setPlaceQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchPlace(); } }}
              placeholder="🔍 พิมพ์ชื่อสถานที่ เช่น วัดพระแก้ว, วิทยาลัยนาฏศิลป, อ.เมือง เพชรบุรี" />
            <button type="button" className="btn btn-outline" onClick={searchPlace} disabled={searching}>
              {searching ? '⏳' : 'ค้นหา'}
            </button>
          </div>
          {placeResults.length > 0 && (
            <div style={{border:'1px solid var(--gold)',borderRadius:'6px',marginBottom:'6px',overflow:'hidden'}}>
              {placeResults.map((r, i) => (
                <div key={i} onClick={() => pickPlace(r)}
                  style={{padding:'8px 12px',fontSize:'0.8rem',cursor:'pointer',
                    borderBottom: i < placeResults.length-1 ? '1px solid var(--border)' : 'none',
                    background:'var(--navy3)'}}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--navy3)'}>
                  📍 {r.display_name}
                </div>
              ))}
            </div>
          )}
          <LeafletMap height="300px" onPick={(lat, lng) => setPos([lat, lng])} pickedPos={pos} flyTo={fly} />
          <div style={{fontSize:'0.72rem',color:pos ? 'var(--jade)' : 'var(--muted)',marginTop:'5px'}}>
            {pos ? `✓ ปักหมุดแล้ว: ${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}` : 'ยังไม่ได้ปักหมุด (ไม่บังคับ แต่แนะนำ — จะแสดงบนแผนที่หลัก)'}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">รายละเอียดเพิ่มเติม</label>
          <textarea className="form-input" rows="4" value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="เล่าเรื่องราว บริบท ความสำคัญ..." style={{resize:'vertical'}} />
        </div>
        <div className="form-group">
          <label className="form-label">รูปภาพ (สูงสุด 5 รูป, รูปละไม่เกิน 5MB)</label>
          <input className="form-input" type="file" accept="image/*" multiple
            onChange={e => setFiles(e.target.files)} />
          {uploaded.length > 0 && (
            <div className="draft-images" style={{fontSize:'0.72rem',color:'var(--jade)',marginTop:'5px'}}>
              📎 รูปที่เก็บไว้กับร่างแล้ว {uploaded.length} รูป: {uploaded.map(u => u.name).join(', ')}
              <button type="button" className="btn btn-outline btn-sm" style={{marginLeft:8,fontSize:'0.68rem'}}
                onClick={() => setUploaded([])}>เอารูปออกทั้งหมด</button>
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">วิดีโอ YouTube (ถ้ามี)</label>
          <input className="form-input" value={ytUrl} onChange={e => setYtUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <button className="btn btn-jade" style={{flex:1,minWidth:'220px',justifyContent:'center'}}
            disabled={busy} onClick={submit}>
            {busy ? 'กำลังบันทึก...' : '✓ ส่งบันทึก — รอ Admin อนุมัติ'}
          </button>
          <button className="btn btn-outline" type="button" onClick={saveNow} disabled={saving || busy}>💾 เก็บเป็นร่างไว้ก่อน</button>
        </div>
        {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}
      </div>
    </main>
    </FeaturePage>
  );
}
