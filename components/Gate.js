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
  // ระดับสิทธิ์ (2026-08-25):
  //   admin      ทำได้ทุกอย่าง รวมถึงตั้ง/ถอดแอดมิน
  //   moderator  ทำได้ทุกอย่าง ยกเว้นตั้งแอดมินและแตะบัญชีแอดมิน
  //   superuser  เข้าชมได้ทุกอย่าง (รวมส่วนที่ล็อกด้วยแต้ม/อุปถัมภ์) แต่อนุมัติ/แก้แบบแอดมินไม่ได้
  //   student    ใช้ระบบบันทึกโน้ตได้โดยไม่ต้องมีแต้ม แต่ไม่เห็นเนื้อหาพิเศษ
  //   member     สมาชิกธรรมดา
  const isAdmin = me.role === 'admin' || me.role === 'moderator';   // อำนาจจัดการเนื้อหา
  return { ...me,
    isAdmin,
    isRealAdmin: me.role === 'admin',                               // อำนาจจัดการแอดมินด้วยกัน
    isViewer: me.role === 'superuser',
    isStudent: me.role === 'student',
    isPremium: isAdmin || me.role === 'superuser' || me.tier === 'premium',
  };
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

// ── ระบบสิทธิ์รายฟีเจอร์ (อ่านจากตาราง feature_permissions, realtime) ──
let _permCache = null;
export function usePermissions() {
  const me = useMe();
  const [perms, setPerms] = useState(_permCache);
  useEffect(() => {
    let ch = null;
    async function load() {
      const { data } = await supabase.from('feature_permissions').select('*');
      _permCache = {};
      (data ?? []).forEach(r => { _permCache[r.feature_key] = r; });
      setPerms({ ..._permCache });
    }
    if (!_permCache) load(); else setPerms(_permCache);
    try {
      ch = supabase.channel('perm-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_permissions' }, load)
        .subscribe();
    } catch (e) {}
    return () => { if (ch) supabase.removeChannel(ch); };
  }, []);
  // superuser ใช้เลนส์ 'admin' เฉพาะการมองเห็น — ปุ่มจัดการทั้งหมดเช็ค isAdmin แยกอยู่แล้ว
  const tier = me.loading ? null
    : (me.isAdmin || me.isViewer) ? 'admin'
    : !me.user ? 'guest' : (me.tier === 'premium' ? 'premium' : 'free');
  function can(key) {
    if (tier === 'admin') return true;
    const r = perms?.[key];
    if (!r) return true;                 // ไม่มีในตาราง = เปิด
    return !!r[tier ?? 'guest'];
  }
  return { can, tier, isAdmin: me.isAdmin, isRealAdmin: me.isRealAdmin, role: me.role,
    user: me.user, loading: me.loading || perms == null };
}

// ห่อทั้งหน้า: เปิดตามตารางสิทธิ์
export function FeaturePage({ feature, children }) {
  const { can, loading, user } = usePermissions();
  if (loading) return <main className="container" style={{textAlign:'center',paddingTop:'4rem',color:'var(--muted)'}}>กำลังโหลด...</main>;
  if (can(feature)) return children;
  return (
    <main className="container" style={{maxWidth:'560px',textAlign:'center',paddingTop:'4rem'}}>
      <div style={{fontSize:'2.5rem'}}>🚧</div>
      <div className="section-title" style={{fontSize:'1.15rem',margin:'0.8rem 0'}}>ส่วนนี้ยังไม่เปิดสำหรับบัญชีของคุณ</div>
      <div style={{color:'var(--muted)',fontSize:'0.88rem',lineHeight:1.9}}>
        {!user ? 'ลองเข้าสู่ระบบ หรือส่วนนี้อาจอยู่ระหว่างปรับปรุง' : 'ส่วนนี้อาจอยู่ระหว่างปรับปรุง หรือเปิดเฉพาะสมาชิกอุปถัมภ์'}</div>
      <div style={{display:'flex',gap:'10px',justifyContent:'center',marginTop:'1.2rem'}}>
        <a href="/premium"><button className="btn btn-primary btn-sm">💎 สมาชิกอุปถัมภ์</button></a>
        <a href="/"><button className="btn btn-outline btn-sm">← หน้าแรก</button></a>
      </div>
    </main>
  );
}
