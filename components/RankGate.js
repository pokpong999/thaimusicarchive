'use client';
// components/RankGate.js — เปิดใช้งานเฉพาะสมาชิกที่ถึงบรรดาศักดิ์ที่กำหนด
//
// ใช้กับระบบบันทึกโน้ต: ช่วงเปิดตัวให้เฉพาะ "ขุน" (300 ศักดินา) ขึ้นไป
// ใครยังไม่ถึง ต้องร่วมบันทึกเหตุการณ์จดหมายเหตุก่อน
//
// <RankGate>{children}</RankGate>
// <RankGate minPoints={800} bypass={isOwner}>{children}</RankGate>
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useMe } from './Gate';
import { RANKS, getRank } from '../lib/ranks';
import RankBadge from './RankBadge';

const HOW = [
  ['📜', 'บันทึกเหตุการณ์จดหมายเหตุ ได้รับอนุมัติ', '+10'],
  ['🖼', 'บันทึกที่มีทั้งรูปและปักหมุดแผนที่ (โบนัส)', '+5'],
  ['🎬', 'วิดีโอเพลง ได้รับอนุมัติ', '+10'],
];

export default function RankGate({ minPoints = 300, bypass = false, children }) {
  const me = useMe();
  const [points, setPoints] = useState(null);   // null = ยังไม่รู้

  useEffect(() => {
    if (me.loading) return;
    if (!me.user) { setPoints(0); return; }
    supabase.from('profiles').select('points').eq('id', me.user.id).single()
      .then(({ data }) => setPoints(data?.points ?? 0));
  }, [me.loading, me.user]);

  if (bypass) return children;
  if (me.loading || points === null) return (
    <main className="container" style={{textAlign:'center',paddingTop:'4rem',color:'var(--muted)'}}>
      กำลังตรวจสอบสิทธิ์...
    </main>
  );

  // ผ่านด่าน: แอดมิน/ผู้ช่วยแอดมิน · superuser (เข้าชมได้ทุกอย่าง)
  //           · student (ไว้สอนใช้โปรแกรมบันทึกโน้ต) · ครู · หรือศักดินาถึงเกณฑ์
  if (me.isAdmin || me.role === 'superuser' || me.role === 'student' || me.isTeacher || points >= minPoints) return children;

  const need = minPoints - points;
  const target = RANKS.find(r => r.min === minPoints) ?? getRank(minPoints);
  const pct = Math.max(2, Math.min(100, Math.round((points / minPoints) * 100)));

  if (!me.user) return (
    <main className="container" style={{maxWidth:'560px',textAlign:'center',paddingTop:'3rem'}}>
      <div style={{fontSize:'2.2rem'}}>🔒</div>
      <div className="section-title" style={{fontSize:'1.15rem',margin:'0.8rem 0'}}>
        ระบบบันทึกโน้ตสำหรับสมาชิกระดับ {target.icon} {target.name} ขึ้นไป
      </div>
      <div style={{color:'var(--muted)',fontSize:'0.88rem',lineHeight:1.9}}>
        เข้าสู่ระบบก่อน แล้วสะสมศักดินาจากการร่วมบันทึกจดหมายเหตุ
      </div>
      <Link href="/login"><button className="btn btn-primary" style={{marginTop:'1.2rem'}}>เข้าสู่ระบบ / สมัครฟรี</button></Link>
    </main>
  );

  return (
    <main className="container" style={{maxWidth:'620px',paddingTop:'2rem'}}>
      <div className="card" style={{padding:'1.6rem 1.4rem'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'2.2rem'}}>🔒</div>
          <div className="section-title" style={{fontSize:'1.15rem',margin:'0.7rem 0 0.3rem'}}>
            ระบบบันทึกโน้ตเปิดให้ระดับ {target.icon} {target.name} ขึ้นไป
          </div>
          <div style={{color:'var(--muted)',fontSize:'0.85rem',lineHeight:1.9}}>
            ช่วงเปิดตัว ระบบบันทึกโน้ตเป็นสิทธิ์ของสมาชิกที่ร่วมสร้างคลังจดหมายเหตุมาก่อน<br/>
            ใช้ได้ฟรีเมื่อถึง {target.name} — ไม่มีค่าใช้จ่าย
          </div>
        </div>

        <div style={{margin:'1.4rem 0 0.5rem',display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
          <RankBadge points={points} />
          <span style={{fontSize:'0.85rem',color:'var(--muted)'}}>
            ศักดินาของคุณ <b style={{color:'var(--jade)',fontFamily:'monospace'}}>{points.toLocaleString()}</b>
            {' '}/ {minPoints.toLocaleString()}
          </span>
        </div>
        <div style={{height:'10px',borderRadius:'6px',background:'var(--navy3)',overflow:'hidden'}}>
          <div style={{width:pct+'%',height:'100%',background:'linear-gradient(90deg,#4C9A84,#C9A84C)'}} />
        </div>
        <div style={{fontSize:'0.9rem',marginTop:'0.7rem',textAlign:'center'}}>
          อีก <b style={{color:'var(--gold)',fontFamily:'monospace',fontSize:'1.1rem'}}>{need.toLocaleString()}</b> ศักดินา
          {' '}ถึง {target.icon} {target.name}
        </div>

        <div style={{marginTop:'1.4rem',borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
          <div style={{fontWeight:600,fontSize:'0.9rem',marginBottom:'0.6rem'}}>วิธีได้ศักดินา</div>
          {HOW.map(([icon, text, pts]) => (
            <div key={text} style={{display:'flex',gap:'10px',alignItems:'center',padding:'6px 0',fontSize:'0.84rem'}}>
              <span style={{fontSize:'1.05rem'}}>{icon}</span>
              <span style={{flex:1}}>{text}</span>
              <b style={{color:'var(--jade)',fontFamily:'monospace'}}>{pts}</b>
            </div>
          ))}
          <div style={{fontSize:'0.76rem',color:'var(--muted)',marginTop:'0.5rem',lineHeight:1.8}}>
            บันทึกที่มีครบทั้งรูปและพิกัดได้ 15 ศักดินา — ราว {Math.ceil(need / 15)} บันทึกก็ถึงแล้ว
          </div>
        </div>

        <div style={{display:'flex',gap:'10px',justifyContent:'center',marginTop:'1.4rem',flexWrap:'wrap'}}>
          <Link href="/archive/new"><button className="btn btn-primary">📜 บันทึกเหตุการณ์จดหมายเหตุ</button></Link>
          <Link href="/dashboard"><button className="btn btn-outline">ผลงานของฉัน</button></Link>
          <Link href="/leaderboard"><button className="btn btn-outline">ทำเนียบสมาชิก</button></Link>
        </div>
      </div>
    </main>
  );
}
