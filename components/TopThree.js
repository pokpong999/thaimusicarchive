'use client';
// components/TopThree.js — นักจดหมายเหตุดนตรีไทยดีเด่น 3 อันดับ แบบรายชื่อนิ่ง  (Pk 5 ก.ย. 69)
//   แทนตัววิ่ง TopArchivists บนหน้าแรก (ตัววิ่งทำให้หน้ารก — ไฟล์เดิมยังอยู่ เผื่อใช้ที่อื่น)
//   กติกาเดียวกับหน้าทำเนียบ: ผู้ดูแล (admin/moderator) ไม่ลงแข่ง
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Avatar from './Avatar';
import { getRank } from '../lib/ranks';
import { useLang } from '../lib/i18n';

const STAFF = ['admin', 'moderator'];
const MEDAL = ['🥇', '🥈', '🥉'];

export default function TopThree() {
  const { t } = useLang();
  const [top, setTop] = useState([]);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, points, role, avatar_url')
      .order('points', { ascending: false, nullsFirst: false }).limit(30)
      .then(({ data }) => setTop((data ?? [])
        .filter(p => !STAFF.includes(p?.role) && (p.points ?? 0) > 0)
        .slice(0, 3)));
  }, []);

  if (top.length === 0) return null;

  return (
    <section className="home-sec">
      <h2>{t('home_sec_top')} <small>{t('home_sec_top_sub')}</small></h2>
      <div className="top3">
        {top.map((p, i) => {
          const r = getRank(p.points);
          return (
            <Link key={p.id} href={`/members/${p.id}`}>
              <span className="medal" aria-hidden="true">{MEDAL[i]}</span>
              <Avatar path={p.avatar_url} name={p.display_name} size={30} />
              <span className="nm">{p.display_name || '—'}</span>
              <span className="pt" style={{color:r.color}}>{r.icon} {r.name} · {(p.points ?? 0).toLocaleString()}</span>
            </Link>
          );
        })}
        <Link href="/leaderboard" className="more">{t('home_more_board')} →</Link>
      </div>
    </section>
  );
}
