'use client';
// app/auth/callback/page.js — หน้ารับลิงก์จากอีเมล (Pk 2026-08-26)
//
//   ก่อนหน้านี้ไม่มีหน้านี้เลย → ลิงก์ยืนยันอีเมลเด้งไปหน้าแรกเฉย ๆ ไม่มีข้อความบอกว่าสำเร็จ
//   และ "ลืมรหัสผ่าน" ก็ไม่มีที่ให้พิมพ์รหัสใหม่
//
//   หน้านี้รับได้ทุกแบบที่ Supabase ส่งกลับมา (ดู parseAuthParams ใน lib/auth.js)
//     #access_token…  → supabase-js เก็บ session ให้แล้ว (detectSessionInUrl) แค่ยืนยันว่ามี
//     ?code=…         → exchangeCodeForSession (PKCE)
//     ?token_hash=…   → verifyOtp (ลิงก์รุ่นใหม่)
//     ?error=…        → ลิงก์หมดอายุ/ถูกใช้แล้ว → ขอลิงก์ใหม่ได้จากหน้านี้เลย
//
//   type=recovery → โชว์ฟอร์มตั้งรหัสผ่านใหม่ (สองช่อง) แล้ว updateUser
//   type อื่น     → "✓ ยืนยันอีเมลเรียบร้อย" แล้วพาไปหน้าแรก
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { parseAuthParams, thaiAuthError, passwordProblem, callbackTitle, callbackUrl, MIN_PASSWORD } from '../../../lib/auth';

export default function AuthCallbackPage() {
  // อ่าน URL ตั้งแต่เรนเดอร์แรก — supabase-js จะล้าง #hash ทิ้งหลังเก็บ session
  const [params] = useState(() => parseAuthParams(typeof window === 'undefined' ? '' : window.location.href));
  const [stage, setStage] = useState('working');       // working | ok | recovery | done | error
  const [msg, setMsg] = useState('กำลังตรวจสอบลิงก์…');
  const [detail, setDetail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState(false);
  const recoveryRef = useRef(params.type === 'recovery');
  const doneRef = useRef(false);

  const fail = useCallback((raw) => {
    setStage('error'); setMsg(thaiAuthError(raw)); setDetail(String(raw || ''));
  }, []);

  useEffect(() => {
    // supabase ยิง PASSWORD_RECOVERY เมื่ออ่านลิงก์ตั้งรหัสใหม่ออก — เผื่อ type ไม่ติดมากับ URL
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { recoveryRef.current = true; setStage('recovery'); setMsg(''); }
      if (session?.user?.email) setEmail(session.user.email);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    (async () => {
      if (params.kind === 'error') { fail(params.error); return; }
      try {
        if (params.kind === 'code') {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) { fail(error.message); return; }
        } else if (params.kind === 'token') {
          const { error } = await supabase.auth.verifyOtp({ token_hash: params.token_hash, type: params.type || 'email' });
          if (error) { fail(error.message); return; }
        }
        // ทุกทางมาลงที่นี่: ต้องมี session แล้ว (implicit เก็บให้ตั้งแต่ตอนโหลดหน้า)
        let session = null;
        for (let i = 0; i < 20 && !session; i++) {                 // เผื่อ detectSessionInUrl ยังทำงานไม่เสร็จ
          ({ data: { session } } = await supabase.auth.getSession());
          if (!session) await new Promise(r => setTimeout(r, 150));
        }
        if (session?.user?.email) setEmail(session.user.email);
        if (recoveryRef.current) { setStage('recovery'); setMsg(''); return; }
        if (!session) { fail('Auth session missing'); return; }
        setStage('ok');
        setMsg('✓ ยืนยันอีเมลเรียบร้อยแล้ว — เข้าใช้งานได้เลย');
      } catch (e) { fail(e?.message ?? e); }
    })();
  }, [params, fail]);

  async function savePassword() {
    const bad = passwordProblem(pw, pw2);
    if (bad) { setMsg('⚠ ' + bad); return; }
    setBusy(true); setMsg('กำลังบันทึกรหัสผ่านใหม่…');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg('⚠ ' + thaiAuthError(error.message)); setDetail(error.message); return; }
    setStage('done'); setDetail('');
    setMsg('✓ ตั้งรหัสผ่านใหม่เรียบร้อย — ครั้งต่อไปเข้าสู่ระบบด้วยรหัสนี้');
  }

  async function resend() {
    if (!email.trim()) { setMsg('⚠ กรอกอีเมลที่ใช้สมัครก่อน'); return; }
    setBusy(true);
    const mail = email.trim().toLowerCase();
    const { error } = recoveryRef.current || params.type === 'recovery'
      ? await supabase.auth.resetPasswordForEmail(mail, { redirectTo: callbackUrl() })
      : await supabase.auth.resend({ type: 'signup', email: mail, options: { emailRedirectTo: callbackUrl() } });
    setBusy(false);
    if (error) { setMsg('⚠ ' + thaiAuthError(error.message)); setDetail(error.message); return; }
    setResent(true);
    setMsg('✓ ส่งลิงก์ใหม่ไปที่ ' + mail + ' แล้ว — ตรวจกล่องอีเมลและเมลขยะ');
  }

  const next = params.next || '/';
  return (
    <main className="container" style={{ maxWidth: '440px' }}>
      <div className="card" data-t="auth-callback" data-stage={stage}>
        <div className="section-title" style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>
          {callbackTitle(params.type)}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1.1rem' }}>
          หอจดหมายเหตุดนตรีไทย · ยืนยันตัวตนสมาชิก
        </div>

        {stage === 'working' && (
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>⏳ {msg}</div>
        )}

        {stage === 'ok' && (
          <>
            <div style={{ fontSize: '2rem', textAlign: 'center' }}>✅</div>
            <div data-t="ok-msg" style={{ fontSize: '0.92rem', color: 'var(--jade)', textAlign: 'center', lineHeight: 1.8, margin: '0.5rem 0 1rem' }}>
              {msg}{email && <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{email}</div>}
            </div>
            <Link href={next}><button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>เข้าใช้งานหอจดหมายเหตุ</button></Link>
            <Link href="/profile"><button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>กรอกโปรไฟล์ให้ครบก่อน</button></Link>
          </>
        )}

        {(stage === 'recovery') && (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.8, marginBottom: '0.9rem' }}>
              ตั้งรหัสผ่านใหม่สำหรับ <b style={{ color: 'var(--cream)' }}>{email || 'บัญชีของคุณ'}</b> — พิมพ์ให้ตรงกันทั้งสองช่อง
            </div>
            <div className="form-group">
              <label className="form-label">รหัสผ่านใหม่</label>
              <input className="form-input" data-t="pw1" type={show ? 'text' : 'password'} value={pw} autoComplete="new-password"
                onChange={e => setPw(e.target.value)} placeholder={`อย่างน้อย ${MIN_PASSWORD} ตัวอักษร`} />
            </div>
            <div className="form-group">
              <label className="form-label">ยืนยันรหัสผ่านใหม่</label>
              <input className="form-input" data-t="pw2" type={show ? 'text' : 'password'} value={pw2} autoComplete="new-password"
                onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePassword()} placeholder="พิมพ์ซ้ำอีกครั้ง" />
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.76rem', color: 'var(--muted)', marginBottom: '0.9rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} style={{ accentColor: 'var(--gold)' }} /> แสดงรหัสผ่าน
            </label>
            <button className="btn btn-primary" data-t="save-pw" disabled={busy} style={{ width: '100%', justifyContent: 'center' }} onClick={savePassword}>
              {busy ? '⏳ กำลังบันทึก…' : '✓ บันทึกรหัสผ่านใหม่'}
            </button>
          </>
        )}

        {stage === 'done' && (
          <>
            <div style={{ fontSize: '2rem', textAlign: 'center' }}>🔑</div>
            <div data-t="ok-msg" style={{ fontSize: '0.92rem', color: 'var(--jade)', textAlign: 'center', lineHeight: 1.8, margin: '0.5rem 0 1rem' }}>{msg}</div>
            <Link href="/"><button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>เข้าใช้งานหอจดหมายเหตุ</button></Link>
          </>
        )}

        {stage === 'error' && (
          <>
            <div style={{ fontSize: '2rem', textAlign: 'center' }}>⚠️</div>
            <div data-t="err-msg" style={{ fontSize: '0.88rem', color: 'var(--gold)', lineHeight: 1.8, margin: '0.5rem 0 1rem' }}>{msg}</div>
            {!resent && (
              <>
                <div className="form-group">
                  <label className="form-label">อีเมลที่ใช้สมัคร</label>
                  <input className="form-input" data-t="resend-email" type="email" value={email} inputMode="email"
                    autoCapitalize="none" autoCorrect="off" spellCheck="false"
                    onChange={e => setEmail(e.target.value)} placeholder="yourname@email.com" />
                </div>
                <button className="btn btn-primary" data-t="resend" disabled={busy} style={{ width: '100%', justifyContent: 'center' }} onClick={resend}>
                  {busy ? '⏳ กำลังส่ง…' : '📧 ขอลิงก์ใหม่'}
                </button>
              </>
            )}
            <Link href="/login"><button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>← กลับหน้าเข้าสู่ระบบ</button></Link>
          </>
        )}

        {msg && (stage === 'recovery') && (
          <div data-t="form-msg" style={{ marginTop: '0.8rem', fontSize: '0.82rem', lineHeight: 1.7, color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)' }}>{msg}</div>
        )}
        {detail && (
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '6px', fontFamily: 'monospace' }}>{detail}</div>
        )}
      </div>
    </main>
  );
}
