'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, extractYouTubeId } from '../../../lib/supabase';
import LeafletMap from '../../../components/LeafletMap';

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

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

    for (const file of Array.from(files).slice(0, 5)) {
      if (file.size > 5 * 1024 * 1024) continue;
      const path = `${rec.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('archive-images').upload(path, file);
      if (!upErr) {
        await supabase.from('archive_media').insert({ record_id: rec.id, media_type: 'image', storage_path: path });
      }
    }

    const ytId = extractYouTubeId(ytUrl);
    if (ytId) {
      await supabase.from('archive_media').insert({ record_id: rec.id, media_type: 'youtube', youtube_id: ytId });
    }

    setMsg('✓ บันทึกแล้ว — รอ Admin อนุมัติก่อนแสดงสาธารณะ');
    setBusy(false);
    setWho(''); setWhat(''); setWhenText(''); setWhenDate(''); setWhere(''); setDesc(''); setYtUrl(''); setFiles([]); setPos(null);
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
    <main className="container" style={{maxWidth:'640px'}}>
      <Link href="/archive"><span style={{color:'var(--muted)',fontSize:'0.8rem'}}>← กลับหอจดหมายเหตุ</span></Link>
      <div className="card" style={{marginTop:'1rem'}}>
        <div className="section-title" style={{fontSize:'1.1rem'}}>บันทึกเหตุการณ์ใหม่</div>
        <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:'1.3rem'}}>
          ใคร ทำอะไร เมื่อไหร่ ที่ไหน · ปักหมุดแผนที่ + แนบรูปและวิดีโอ
        </div>

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
        </div>
        <div className="form-group">
          <label className="form-label">วิดีโอ YouTube (ถ้ามี)</label>
          <input className="form-input" value={ytUrl} onChange={e => setYtUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <button className="btn btn-jade" style={{width:'100%',justifyContent:'center'}}
          disabled={busy} onClick={submit}>
          {busy ? 'กำลังบันทึก...' : '✓ ส่งบันทึก — รอ Admin อนุมัติ'}
        </button>
        {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}
      </div>
    </main>
  );
}
