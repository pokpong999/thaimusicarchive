'use client';
// ตัววิ่งหน้าแรก: "นักจดหมายเหตุดนตรีไทยดีเด่น" อันดับ 1-2-3  (Pk 27 ส.ค. 69)
//   กติกาเดียวกับหน้าทำเนียบ — ผู้ดูแล (admin/moderator) ไม่ลงแข่ง จึงไม่ขึ้นในตัววิ่ง
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Avatar from './Avatar';
import { getRank } from '../lib/ranks';

const STAFF = ['admin', 'moderator'];
const MEDAL = ['🥇', '🥈', '🥉'];

export default function TopArchivists() {
  const [top, setTop] = useState([]);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, points, role, avatar_url')
      .order('points', { ascending: false, nullsFirst: false }).limit(30)
      .then(({ data }) => setTop((data ?? [])
        .filter(p => !STAFF.includes(p?.role) && (p.points ?? 0) > 0)
        .slice(0, 3)));
  }, []);

  if (top.length === 0) return null;

  // วิ่งวนไม่มีสะดุด = วางเนื้อหาชุดเดิมซ้ำสองรอบ แล้วเลื่อนไป -50%
  const run = [...top, ...top];

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(201,168,76,0.18), rgba(201,168,76,0.06), rgba(201,168,76,0.18))',
      border: '1px solid rgba(201,168,76,0.35)', borderRadius: '8px',
      margin: '0 0 1.2rem', overflow: 'hidden',
    }} className="thma-top">
      <style>{`
        @keyframes thma-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .thma-top { display:flex; align-items:center; }
        .thma-marquee-track { display:flex; width:max-content; animation: thma-marquee 26s linear infinite; }
        .thma-marquee-wrap:hover .thma-marquee-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .thma-marquee-track { animation: none; } }
        /* จอมือถือ: ป้ายหัวเรื่องกินความกว้างไปครึ่งจอ เหลือที่ให้ชื่อคนวิ่งแค่นิดเดียว
           → ย้ายป้ายขึ้นไปอยู่บรรทัดบน แล้วให้ตัววิ่งได้เต็มความกว้าง (Pk 27 ส.ค. 69) */
        @media (max-width: 560px) {
          .thma-top { flex-direction: column; align-items: stretch; }
          .thma-top-label { border-right: none !important; border-bottom: 1px solid rgba(201,168,76,0.35);
            justify-content: center; padding: 7px 10px !important; font-size: 0.8rem !important; }
          .thma-marquee-track { animation-duration: 18s; }
        }
      `}</style>

      <div className="thma-top-label" style={{
        fontFamily: "'Noto Serif Thai', serif", fontWeight: 700, color: 'var(--gold)',
        fontSize: '0.86rem', whiteSpace: 'nowrap', padding: '10px 14px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '8px',
        borderRight: '1px solid rgba(201,168,76,0.35)',
      }}>
        <span style={{fontSize:'1.05rem'}}>🏆</span> นักจดหมายเหตุดนตรีไทยดีเด่น
      </div>

      <div className="thma-marquee-wrap" style={{overflow:'hidden',flex:1}}>
        <div className="thma-marquee-track">
          {run.map((p, i) => {
            const rank = getRank(p.points);
            return (
              <Link key={`${p.id}-${i}`} href={`/members/${p.id}`} style={{textDecoration:'none'}}>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:'9px',
                  padding:'8px 26px 8px 0', whiteSpace:'nowrap', color:'var(--cream)',
                }}>
                  <span style={{fontSize:'1.05rem'}}>{MEDAL[i % top.length] ?? '🎖'}</span>
                  <Avatar path={p.avatar_url} name={p.display_name} size={24} />
                  <span style={{fontWeight:600,fontSize:'0.85rem'}}>{p.display_name ?? 'สมาชิก'}</span>
                  <span style={{fontSize:'0.76rem',color:rank.color}}>{rank.icon} {rank.name}</span>
                  <span style={{fontSize:'0.76rem',color:'var(--jade)',fontFamily:'monospace'}}>
                    {(p.points ?? 0).toLocaleString()} ศักดินา
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
