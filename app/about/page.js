'use client';
import Link from 'next/link';
import { EText, EImage } from '../../components/Editable';

export default function AboutPage() {
  return (
    <main className="container" style={{maxWidth:'700px'}}>
      <EText k="about.title" className="section-title" style={{fontSize:'1.3rem'}}>เกี่ยวกับโครงการ</EText>
      <EImage k="about.cover" height={260} style={{margin:'0.8rem 0'}} />
      <div className="card" style={{marginTop:'1rem',lineHeight:2,fontSize:'0.92rem'}}>
        <EText k="about.p1" as="p"><b>หอจดหมายเหตุดนตรีไทย (Thai Music Archive — THMA)</b> เป็นฐานข้อมูลเปิดเพื่อการอนุรักษ์
        ศึกษา และต่อยอดดนตรีไทย ประกอบด้วย 2 ส่วนหลัก</EText>
        <EText k="about.p2" as="p"><b>๑. จดหมายเหตุเพลงไทย</b> — ฐานข้อมูลเพลงไทยกว่า 300 เพลง 20,000+ วรรค พร้อมระบบวิเคราะห์กระสวน
        (รหัส Krasuan Code 16 อักษร) คลังลูกตก และเครื่องเล่นโน้ตระบบ 7 เสียงไทยที่เล่นเสียงฆ้องวงใหญ่จริง
        พร้อมหน้าทับกลองและฉิ่ง</EText>
        <EText k="about.p3" as="p"><b>๒. จดหมายเหตุดนตรีไทย</b> — บันทึกเหตุการณ์ดนตรีไทย อดีต ปัจจุบัน อนาคต บนแผนที่
        โดยเปิดให้สมาชิกร่วมบันทึกประวัติศาสตร์ไปด้วยกัน</EText>
        <p style={{borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
        <b>การอ้างอิง (Citation)</b><br/>
        ปกป้อง ขำประเสริฐ. (2569). <i>หอจดหมายเหตุดนตรีไทย [ฐานข้อมูล]</i>. สืบค้นจาก https://thaimusicarchive.com</p>
        <EText k="about.p4" as="p"><b>ลิขสิทธิ์</b> — ข้อมูล การวิเคราะห์ และระบบรหัสกระสวน © ปกป้อง ขำประเสริฐ (Pokpong Khamprasert)
        ผลงานที่สมาชิกเพิ่มแสดงเครดิตผู้เพิ่มกำกับ · การนำไปใช้เพื่อการศึกษาโปรดอ้างอิงแหล่งที่มา</EText>
        <EText k="about.p5" as="p"><b>ติดต่อ</b> — ✉️ tasanastudio@gmail.com · LINE: p.khamprasert · ☎️ 097-220-5864</EText>
      </div>
      <Link href="/"><button className="btn btn-outline btn-sm" style={{marginTop:'0.5rem'}}>← กลับหน้าแรก</button></Link>
    </main>
  );
}
