'use client';
import { EText, EImage } from '../../components/Editable';
import { FeaturePage } from '../../components/Gate';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import Avatar from '../../components/Avatar';
import { getRank, getNextRank, RANKS } from '../../lib/ranks';
import RankBadge from '../../components/RankBadge';

export default function LeaderboardPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, points, role, avatar_url')
      .order('points', { ascending: false, nullsFirst: false }).limit(100)
      .then(({ data }) => { setProfiles(data ?? []); setLoading(false); });
  }, []);

  return (
    <FeaturePage feature="page_leaderboard">
    <main className="container" style={{maxWidth:'760px'}}>
      <EText k="board.title" className="section-title">ทำเนียบนักจดหมายเหตุ</EText>
      <div className="section-subtitle">
        อันดับผู้ร่วมสร้างหอจดหมายเหตุดนตรีไทย · สะสมศักดินาจากผลงานที่ได้รับอนุมัติ
      </div>

      <div className="card" style={{marginBottom:'1.4rem'}}>
        <div style={{fontSize:'0.85rem',fontWeight:600,marginBottom:'0.8rem'}}>ลำดับบรรดาศักดิ์</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
          {RANKS.map(r => (
            <div key={r.name} style={{
              display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',
              padding:'8px 12px',background:'var(--navy3)',borderRadius:'6px',
              border:`1px solid ${r.color}44`,minWidth:'86px',
            }}>
              <span style={{fontSize:'1.1rem'}}>{r.icon}</span>
              <span style={{fontSize:'0.75rem',color:r.color,fontWeight:600}}>{r.name}</span>
              <span style={{fontSize:'0.62rem',color:'var(--muted)',fontFamily:'monospace'}}>{r.min.toLocaleString()}+</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? <div style={{color:'var(--muted)'}}>กำลังโหลด...</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th style={{width:'50px'}}>อันดับ</th><th>สมาชิก</th><th>บรรดาศักดิ์</th><th style={{textAlign:'right'}}>ศักดินา</th><th>ก้าวต่อไป</th>
            </tr></thead>
            <tbody>
              {profiles.map((p, i) => {
                const next = getNextRank(p.points);
                return (
                  <tr key={p.id}>
                    <td style={{fontFamily:'monospace',color: i<3 ? 'var(--gold)' : 'var(--muted)',fontWeight: i<3?700:400}}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style={{fontWeight:500}}>
                      <Link href={`/members/${p.id}`}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
                        <Avatar path={p.avatar_url} name={p.display_name} size={28} />
                        {p.display_name ?? 'ไม่ระบุชื่อ'}
                      </div>
                      </Link>
                    </td>
                    <td><RankBadge points={p.points} /></td>
                    <td style={{textAlign:'right',fontFamily:'monospace',color:'var(--jade)'}}>{(p.points ?? 0).toLocaleString()}</td>
                    <td style={{fontSize:'0.72rem',color:'var(--muted)'}}>
                      {next ? `อีก ${(next.min - (p.points ?? 0)).toLocaleString()} → ${next.name}` : '— สูงสุดแล้ว —'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{marginTop:'1.2rem',fontSize:'0.75rem',color:'var(--muted)',lineHeight:1.8}}>
        <b style={{color:'var(--cream)'}}>วิธีได้ศักดินา:</b> วิดีโอเพลงได้รับอนุมัติ +10 · บันทึกจดหมายเหตุได้รับอนุมัติ +10 · โบนัสบันทึกที่มีทั้งรูปและพิกัด +5
      </div>
    </main>
    </FeaturePage>
  );
}
