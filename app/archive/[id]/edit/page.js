'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useMe } from '../../../../components/Gate';
import PinColorHint from '../../../../components/PinColorHint';

const F = [
  ['who_text', 'ใคร', 'ชื่อบุคคล / คณะ / หน่วยงาน'],
  ['what_text', 'ทำอะไร (หัวเรื่อง) *', 'สรุปเหตุการณ์สั้นๆ'],
  ['when_text', 'เมื่อไหร่', 'เช่น พ.ศ. ๒๔๖๖ หรือ ราวรัชกาลที่ ๕'],
  ['where_text', 'ที่ไหน', 'สถานที่'],
];
export const ERA_OPTIONS = [
  ['past', 'อดีต — เหตุการณ์ที่ผ่านมาแล้ว'],
  ['present', 'ปัจจุบัน — กำลังเกิดขึ้น'],
  ['future', 'อนาคต — กำหนดการที่จะมาถึง'],
];

export default function EditArchive() {
  const { id } = useParams();
  const router = useRouter();
  const { isAdmin, user, loading } = useMe();
  const [rec, setRec] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('archive_records').select('*').eq('id', id).single()
      .then(({ data }) => setRec(data));
  }, [id]);

  if (loading || !rec) return <main className="container" style={{paddingTop:'3rem',color:'var(--muted)'}}>กำลังโหลด...</main>;
  const canEdit = isAdmin || (user && rec.submitted_by === user.id);
  if (!canEdit) return (
    <main className="container" style={{maxWidth:'520px',textAlign:'center',paddingTop:'4rem'}}>
      <div style={{fontSize:'2rem'}}>🔒</div>
      <div style={{margin:'0.8rem 0'}}>แก้ไขได้เฉพาะผู้บันทึกข้อมูลนี้หรือผู้ดูแล</div>
      <a href={`/archive/${id}`}><button className="btn btn-outline btn-sm">← กลับ</button></a>
    </main>
  );

  const set = (k, v) => setRec({ ...rec, [k]: v });

  async function save() {
    if (!rec.what_text?.trim()) { setMsg('⚠ กรอกหัวเรื่องก่อน'); return; }
    setBusy(true);
    const patch = {};
    F.forEach(([k]) => { patch[k] = rec[k] ?? null; });
    patch.description = rec.description ?? null;
    patch.when_date = rec.when_date || null;
    patch.lat = rec.lat === '' ? null : rec.lat;
    patch.lng = rec.lng === '' ? null : rec.lng;
    const { error } = await supabase.from('archive_records').update(patch).eq('id', id);
    setBusy(false);
    if (error) { setMsg('⚠ ' + error.message); return; }
    router.push(`/archive/${id}`);
  }

  return (
    <main className="container" style={{maxWidth:'700px'}}>
      <a href={`/archive/${id}`} style={{fontSize:'0.8rem',color:'var(--gold2)'}}>← กลับหน้าเหตุการณ์</a>
      <div className="section-title" style={{fontSize:'1.2rem',marginTop:'0.8rem'}}>✏️ แก้ไขเหตุการณ์</div>
      <div className="card" style={{marginTop:'1rem'}}>
        {/* ยุคต้องเป็นตัวเลือกชุดเดียวกับหน้า "เพิ่มเหตุการณ์" — เดิมเป็นช่องพิมพ์อิสระ
            พอแก้ครั้งเดียว ค่าจะกลายเป็นข้อความที่ตัวกรองยุคหาไม่เจอ เหตุการณ์นั้นหายไปเลย (Pk 27 ส.ค. 69) */}
        <div className="form-group">
          <label className="form-label">ยุค *</label>
          <select className="form-input" value={ERA_OPTIONS.some(([v]) => v === rec.era) ? rec.era : ''}
            onChange={e => set('era', e.target.value)}>
            {!ERA_OPTIONS.some(([v]) => v === rec.era) &&
              <option value="">— ยังไม่ได้จัดยุค{rec.era ? ` (ของเดิม: ${rec.era})` : ''} —</option>}
            {ERA_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        {F.map(([k, label, ph]) => (
          <div className="form-group" key={k}>
            <label className="form-label">{label}</label>
            <input className="form-input" value={rec[k] ?? ''} placeholder={ph}
              onChange={e => set(k, e.target.value)} />
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">วันที่ (ถ้าทราบแน่นอน — ใช้เรียงลำดับและกำหนดสีหมุด)</label>
          <input className="form-input" type="date" value={rec.when_date ?? ''} onChange={e => set('when_date', e.target.value || null)} />
        </div>
        <PinColorHint whenText={rec.when_text} whenDate={rec.when_date} />
        <div className="form-group">
          <label className="form-label">รายละเอียด / คำอธิบาย</label>
          <textarea className="form-input" rows="7" value={rec.description ?? ''}
            onChange={e => set('description', e.target.value)} style={{resize:'vertical'}} />
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <div className="form-group" style={{flex:1}}>
            <label className="form-label">ละติจูด</label>
            <input className="form-input" value={rec.lat ?? ''} onChange={e => set('lat', e.target.value)} />
          </div>
          <div className="form-group" style={{flex:1}}>
            <label className="form-label">ลองจิจูด</label>
            <input className="form-input" value={rec.lng ?? ''} onChange={e => set('lng', e.target.value)} />
          </div>
        </div>
        {msg && <div style={{fontSize:'0.8rem',color:'var(--gold)',marginBottom:'0.6rem'}}>{msg}</div>}
        <div style={{display:'flex',gap:'8px'}}>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>💾 บันทึกการแก้ไข</button>
          <a href={`/archive/${id}`}><button className="btn btn-outline btn-sm">ยกเลิก</button></a>
        </div>
        <div style={{fontSize:'0.68rem',color:'var(--muted)',marginTop:'0.8rem'}}>
          * เพิ่ม/ลบรูปประกอบได้ที่หน้าเหตุการณ์
        </div>
      </div>
    </main>
  );
}
