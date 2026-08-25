'use client';
// components/GoalBanner.js — ป้ายเป้าหมายหน้าแรก: "เข้ามาแล้วทำอะไรก่อน"
//   ยังไม่ล็อกอิน   → เชิญสมัคร + อธิบาย 3 ขั้น (โพสต์เหตุการณ์ → 300 แต้ม → ขุน ปลดล็อกกระดานโน้ตฟรี)
//   สมาชิก < 300     → แถบความคืบหน้า แต้ม/300 + อีกกี่บันทึก + ปุ่มบันทึกเหตุการณ์
//   ปลดล็อกแล้ว      → การ์ดสั้น ๆ ชวนเปิดกระดานโน้ต (ปิดได้ จำไว้ในเครื่อง)
// กติกาแต้มตามหน้าอันดับ: บันทึกเหตุการณ์อนุมัติ +10 · มีทั้งรูปและพิกัด +5 · วิดีโอ +10
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getRank, getNextRank, RANKS } from '../lib/ranks';

const GOAL = 300;                 // ขุน — ปลดล็อกระบบบันทึกโน้ต (ตรงกับ thma_notation_min_points)
const PER_RECORD = 15;            // บันทึกที่มีรูป+พิกัด
const HIDE_KEY = 'thma-goal-hide';

export default function GoalBanner() {
  const [me, setMe] = useState(undefined);   // undefined = ยังไม่รู้ · null = ไม่ได้ล็อกอิน · {points, role, display_name}
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(HIDE_KEY) === '1') setHidden(true); } catch (e) {}
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setMe(null); return; }
      const { data: p } = await supabase.from('profiles').select('points, role, display_name').eq('id', data.user.id).single();
      setMe({ points: p?.points ?? 0, role: p?.role ?? 'member', name: p?.display_name ?? '' });
    });
  }, []);

  if (me === undefined) return null;
  const khun = RANKS.find(r => r.min === GOAL) ?? RANKS[2];
  const steps = [
    { n: '1', icon: '📜', t: 'บันทึกเหตุการณ์ดนตรีไทย', d: 'ใคร ทำอะไร เมื่อไหร่ ที่ไหน · แนบรูป + ปักหมุด = 15 แต้ม/บันทึก' },
    { n: '2', icon: '🎖', t: `สะสมครบ ${GOAL} แต้ม → เลื่อนขั้นเป็น "${khun.name}"`, d: `ประมาณ ${Math.ceil(GOAL / PER_RECORD)} บันทึก · วิดีโอเพลงก็ได้แต้ม (+10)` },
    { n: '3', icon: '🎼', t: 'ปลดล็อกแอปบันทึกโน้ตเพลงไทย ฟรี', d: 'พิมพ์โน้ต ฟังเสียงฆ้องจริง หน้าทับกลอง ส่งออก Music Sheet' },
  ];
  const wrap = { margin: '0 0 1.4rem', padding: '1rem 1.2rem', borderRadius: 12,
    background: 'linear-gradient(135deg, rgba(201,168,76,0.14), rgba(76,154,132,0.12))',
    border: '1px solid rgba(201,168,76,0.45)', position: 'relative' };

  // ── ยังไม่ล็อกอิน ──
  if (me === null) {
    return (
      <section style={wrap}>
        <div style={{ fontSize: '0.72rem', letterSpacing: '.12em', color: 'var(--gold)', fontWeight: 700 }}>เข้ามาแล้วทำอะไรก่อน?</div>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, margin: '4px 0 10px', lineHeight: 1.4 }}>
          โพสต์เหตุการณ์ → สะสม {GOAL} แต้ม → เลื่อนขั้นเป็น {khun.icon} {khun.name} → ปลดล็อกแอปบันทึกโน้ต <span style={{ color: 'var(--jade)' }}>ฟรี</span>
        </div>
        <Steps steps={steps} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <Link href="/login"><button className="btn btn-primary" style={{ padding: '0.6rem 1.6rem' }}>✦ สมัครสมาชิก เริ่มสะสมแต้ม</button></Link>
          <Link href="/archive"><button className="btn btn-outline">ดูเหตุการณ์ที่สมาชิกบันทึกไว้ →</button></Link>
          <Link href="/leaderboard" style={{ fontSize: '0.76rem', color: 'var(--gold2)' }}>🏆 อันดับผู้ร่วมสร้าง</Link>
        </div>
      </section>
    );
  }

  // ── สมาชิก ──
  const unlocked = me.points >= GOAL || ['admin', 'moderator', 'superuser', 'student'].includes(me.role);
  if (unlocked) {
    if (hidden) return null;
    return (
      <section style={{ ...wrap, padding: '0.7rem 1.2rem', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.88rem' }}>🎼 <b>ปลดล็อกแอปบันทึกโน้ตแล้ว</b> — {me.name || 'คุณ'} {getRank(me.points).icon} {getRank(me.points).name}</span>
        <Link href="/songs/new"><button className="btn btn-primary btn-sm">✎ บันทึกโน้ตเพลง</button></Link>
        <Link href="/archive/new"><button className="btn btn-outline btn-sm">📜 บันทึกเหตุการณ์</button></Link>
        <button onClick={() => { setHidden(true); try { localStorage.setItem(HIDE_KEY, '1'); } catch (e) {} }}
          title="ซ่อนป้ายนี้" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </section>
    );
  }
  const pct = Math.min(100, Math.round(me.points / GOAL * 100));
  const need = GOAL - me.points, recs = Math.ceil(need / PER_RECORD);
  const rank = getRank(me.points), next = getNextRank(me.points);
  return (
    <section style={wrap}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>🎯 เป้าหมายของคุณ: {khun.icon} {khun.name} {GOAL} แต้ม → ปลดล็อกแอปบันทึกโน้ตฟรี</div>
        <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>ตอนนี้ {rank.icon} {rank.name} · {me.points.toLocaleString()} แต้ม</span>
      </div>
      <div style={{ margin: '10px 0 6px', height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg, var(--jade), var(--gold))', borderRadius: 6, transition: 'width .6s' }} />
        {RANKS.filter(r => r.min > 0 && r.min < GOAL).map(r => (
          <span key={r.name} title={`${r.name} ${r.min}`} style={{ position: 'absolute', left: (r.min / GOAL * 100) + '%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.35)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }}>
        <span>อีก <b style={{ color: 'var(--gold)' }}>{need}</b> แต้ม ≈ <b>{recs}</b> บันทึก (มีรูป+พิกัด = 15 แต้ม){next && next.min < GOAL ? ` · ขั้นถัดไป ${next.icon} ${next.name} อีก ${next.min - me.points} แต้ม` : ''}</span>
        <span style={{ flex: 1 }} />
        <Link href="/archive/new"><button className="btn btn-primary btn-sm">📜 บันทึกเหตุการณ์ (+15)</button></Link>
        <Link href="/dashboard"><button className="btn btn-outline btn-sm">แดชบอร์ดของฉัน</button></Link>
      </div>
    </section>
  );
}

function Steps({ steps }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {steps.map(s => (
        <div key={s.n} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(15,27,45,0.45)', border: '1px solid rgba(42,63,92,0.7)' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gold)', color: '#0F1B2D', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{s.icon} {s.t}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>{s.d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
