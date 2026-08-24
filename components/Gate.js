'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useMe() {
  const [me, setMe] = useState({ loading: true, user: null, role: null, tier: 'free' });
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setMe({ loading: false, user: null, role: null, tier: 'free' }); return; }
      const { data: p } = await supabase.from('profiles').select('role, tier').eq('id', data.user.id).single();
      setMe({ loading: false, user: data.user, role: p?.role ?? 'member', tier: p?.tier ?? 'free' });
    });
  }, []);
  return { ...me, isAdmin: me.role === 'admin', isPremium: me.role === 'admin' || me.tier === 'premium' };
}

// หน้าปิดปรับปรุง (เฉพาะ Admin เข้าได้)
export function AdminOnlyPage({ children }) {
  const { loading, isAdmin } = useMe();
  if (loading) return <main className="container" style={{textAlign:'center',paddingTop:'4rem',color:'var(--muted)'}}>กำลังโหลด...</main>;
  if (isAdmin) return children;
  return (
    <main className="container" style={{maxWidth:'560px',textAlign:'center',paddingTop:'4rem'}}>
      <div style={{fontSize:'2.5rem'}}>🚧</div>
      <div className="section-title" style={{fontSize:'1.15rem',margin:'0.8rem 0'}}>ส่วนนี้อยู่ระหว่างปรับปรุง</div>
      <div style={{color:'var(--muted)',fontSize:'0.88rem',lineHeight:1.9}}>
        เรากำลังเตรียมเนื้อหาส่วนนี้ให้สมบูรณ์ที่สุด<br/>จะเปิดให้บริการเร็วๆ นี้</div>
      <a href="/"><button className="btn btn-outline btn-sm" style={{marginTop:'1.2rem'}}>← กลับหน้าแรก</button></a>
    </main>
  );
}

// กล่องล็อกฟีเจอร์สมาชิกอุปถัมภ์
export function PremiumLock({ feature = 'ฟีเจอร์นี้' }) {
  return (
    <div className="card" style={{textAlign:'center',borderColor:'rgba(201,168,76,0.5)',padding:'1.5rem'}}>
      <div style={{fontSize:'1.8rem'}}>💎</div>
      <div style={{fontWeight:700,margin:'0.5rem 0'}}>{feature} สำหรับสมาชิกอุปถัมภ์</div>
      <div style={{fontSize:'0.82rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'0.8rem'}}>
        ร่วมอุปถัมภ์หอจดหมายเหตุดนตรีไทย เพื่อปลดล็อกการพิมพ์และดาวน์โหลดโน้ต<br/>
        และช่วยให้โครงการอนุรักษ์นี้เดินหน้าต่อได้
      </div>
      <a href="/premium"><button className="btn btn-primary btn-sm">ดูรายละเอียดสมาชิกอุปถัมภ์</button></a>
    </div>
  );
}
