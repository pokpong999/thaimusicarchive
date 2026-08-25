'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { shrinkImage } from '../../lib/imgresize';
import RankBadge from '../../components/RankBadge';
import Avatar from '../../components/Avatar';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        setP(prof ?? {});
      }
    });
  }, []);

  function set(k, v) { setP(prev => ({ ...prev, [k]: v })); }

  async function uploadAvatar(raw) {
    if (!raw) return;
    setUploading(true);
    setMsg('⏳ กำลังย่อรูป...');
    const file = await shrinkImage(raw, 512, 0.85);   // รูปโปรไฟล์ไม่ต้องใหญ่
    if (file.size > 3 * 1024 * 1024) { setMsg('⚠ รูปใหญ่เกินไป ลองรูปอื่น'); setUploading(false); return; }
    const ext = file.type === 'image/jpeg' ? 'jpg'
      : (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const filePath = `${user.id}/avatar_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file);
    if (upErr) { setMsg('⚠ อัปโหลดไม่สำเร็จ: ' + upErr.message); setUploading(false); return; }
    // ลบรูปเก่า
    if (p.avatar_url) await supabase.storage.from('avatars').remove([p.avatar_url]);
    await supabase.from('profiles').update({ avatar_url: filePath }).eq('id', user.id);
    set('avatar_url', filePath);
    setMsg('✓ เปลี่ยนรูปโปรไฟล์แล้ว');
    setUploading(false);
  }

  async function save() {
    setMsg('⏳ กำลังบันทึก...');
    const { error, count } = await supabase.from('profiles').update({
      display_name: p.display_name || null, phone: p.phone || null,
      line_id: p.line_id || null, organization: p.organization || null,
      province: p.province || null, bio: p.bio || null,
    }, { count: 'exact' }).eq('id', user.id);
    if (error) {
      // ข้อความจริงของ Postgres อ่านไม่รู้เรื่องสำหรับผู้ใช้ทั่วไป
      setMsg(/permission denied|not allowed/i.test(error.message)
        ? '⚠ บัญชีนี้ยังไม่มีสิทธิ์แก้โปรไฟล์ — แจ้งผู้ดูแลให้รัน sql/10_contributions.sql'
        : '⚠ ' + error.message);
      return;
    }
    if (count === 0) { setMsg('⚠ บันทึกไม่สำเร็จ — ไม่พบโปรไฟล์ของคุณ'); return; }
    setMsg('✓ บันทึกแล้ว');
    setTimeout(() => setMsg(''), 3000);
  }

  if (!user) return (
    <main className="container" style={{maxWidth:'500px'}}>
      <div className="lock-box">
        <div style={{marginBottom:'1rem'}}>เข้าสู่ระบบเพื่อจัดการโปรไฟล์</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ</button></Link>
      </div>
    </main>
  );
  if (!p) return <main className="container">กำลังโหลด...</main>;

  // เรียกเป็นฟังก์ชันธรรมดา ไม่ประกาศเป็นคอมโพเนนต์ใหม่ทุก render
  // (ถ้าประกาศเป็นคอมโพเนนต์ในนี้ React จะสร้างช่องกรอกใหม่ทุกครั้งที่พิมพ์ → เคอร์เซอร์หลุด)
  const F = (k, label, ph) => (
    <div className="form-group" key={k}>
      <label className="form-label">{label}</label>
      <input className="form-input" value={p[k] ?? ''} onChange={e => set(k, e.target.value)} placeholder={ph} />
    </div>
  );

  return (
    <main className="container" style={{maxWidth:'560px'}}>
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.2rem'}}>
          <div className="section-title" style={{fontSize:'1.1rem'}}>โปรไฟล์ของฉัน</div>
          <RankBadge points={p.points} showPoints />
        </div>
        <div style={{display:'flex',gap:'1rem',alignItems:'center',marginBottom:'1.2rem'}}>
          <Avatar path={p.avatar_url} name={p.display_name} size={72} />
          <div>
            <label className="btn btn-outline btn-sm" style={{cursor:'pointer'}}>
              {uploading ? '⏳ กำลังอัปโหลด...' : '📷 เปลี่ยนรูปโปรไฟล์'}
              <input type="file" accept="image/*" style={{display:'none'}}
                onChange={e => uploadAvatar(e.target.files[0])} disabled={uploading} />
            </label>
            <div style={{fontSize:'0.68rem',color:'var(--muted)',marginTop:'4px'}}>JPG/PNG ไม่เกิน 3MB</div>
          </div>
        </div>
        {F('display_name', 'ชื่อที่แสดง *', 'ชื่อ-นามสกุล หรือนามแฝง')}
        {F('phone', 'เบอร์โทร', '08x-xxx-xxxx')}
        {F('line_id', 'LINE ID', '')}
        {F('organization', 'สำนัก / วง / สถาบัน', 'เช่น วิทยาลัยนาฏศิลป')}
        {F('province', 'จังหวัด', '')}
        <div className="form-group">
          <label className="form-label">แนะนำตัว</label>
          <textarea className="form-input" rows="3" value={p.bio ?? ''}
            onChange={e => set('bio', e.target.value)} style={{resize:'vertical'}} />
        </div>
        <button className="btn btn-jade" onClick={save}>✓ บันทึกโปรไฟล์</button>
        {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}
        <div style={{marginTop:'1rem',fontSize:'0.7rem',color:'var(--muted)'}}>
          ข้อมูลส่วนตัว (เบอร์โทร/LINE) เห็นเฉพาะ Admin เพื่อการติดต่อ — ไม่แสดงสาธารณะ
        </div>
      </div>
    </main>
  );
}
