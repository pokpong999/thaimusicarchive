'use client';
import { EText, EImage } from '../../components/Editable';
export default function PremiumPage() {
  return (
    <main className="container" style={{maxWidth:'640px'}}>
      <div style={{textAlign:'center',marginTop:'1.5rem'}}>
        <div style={{fontSize:'2.2rem'}}>💎</div>
        <EText k="premium.title" className="section-title" style={{fontSize:'1.35rem',margin:'0.5rem 0'}}>สมาชิกอุปถัมภ์</EText>
        <EText k="premium.sub" className="section-subtitle">ร่วมเป็นผู้อุปถัมภ์การอนุรักษ์ดนตรีไทย</EText>
      <EImage k="premium.cover" height={200} style={{margin:'1rem 0'}} />
      </div>
      <div className="card" style={{marginTop:'1.5rem',lineHeight:2,fontSize:'0.9rem'}}>
        <div style={{fontWeight:700,marginBottom:'0.5rem'}}>สิทธิพิเศษ</div>
        <div>🖨 พิมพ์โน้ตฉบับพิมพ์คุณภาพสิ่งพิมพ์ (ฟอนต์ TH Notation) + บันทึกเป็น PDF</div>
        <div>📄 ดาวน์โหลดโน้ตทุกเพลงเป็น DOCX / JPG / Excel</div>
        <div>📦 ดาวน์โหลดชุดข้อมูลวิจัย (กระสวน 19,963 วรรค · ลูกตก · คลังกระสวน)</div>
        <div>💛 มีส่วนโดยตรงในการดูแลระบบและขยายฐานข้อมูลเพลงไทย</div>
      </div>
      <div className="card" style={{fontSize:'0.88rem',lineHeight:2}}>
        <div style={{fontWeight:700,marginBottom:'0.5rem'}}>สมัคร / สอบถาม</div>
        ติดต่อผู้ดูแลโครงการโดยตรง แล้วเราจะเปิดสิทธิ์ให้บัญชีของคุณ<br/>
        ✉️ tasanastudio@gmail.com · LINE: p.khamprasert · ☎️ 097-220-5864
        <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:'0.6rem'}}>
          * สมัครสมาชิกฟรีก่อน แล้วแจ้งชื่อบัญชีที่ใช้สมัคร</div>
      </div>
      <a href="/"><button className="btn btn-outline btn-sm">← กลับหน้าแรก</button></a>
    </main>
  );
}
