'use client';
// components/ArchiveContributions.js — ร่วมเล่าเหตุการณ์ของผู้อื่น
//
// สมาชิกทุกระดับเพิ่มเรื่องเล่าและรูปในบันทึกของคนอื่นได้
// แยกชัดว่าข้อความและรูปชิ้นไหนเป็นของใคร · เจ้าของแก้และลบของตัวเองได้
// แอดมิน/ผู้ช่วยแอดมิน ดูแลได้ทุกชิ้น และติดป้าย "ตรวจสอบแล้ว" ได้
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useMe } from './Gate';
import { shrinkImage } from '../lib/imgresize';
import Avatar from './Avatar';
import RankBadge from './RankBadge';

const BUCKET = 'archive-images';
const fmtDate = s => new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ArchiveContributions({ recordId, recordOwner }) {
  const me = useMe();
  const [items, setItems] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState(null);
  const [editBody, setEditBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setLoadErr('');
    // ไม่ใช้ embed profiles(...) — ต้องมี foreign key ไป profiles ซึ่งอาจไม่มี
    // (บทเรียนจากระบบความคิดเห็นที่เคยพังทั้งระบบเพราะเรื่องนี้)
    const { data, error } = await supabase.from('archive_contributions')
      .select('*, archive_contribution_media(*)')
      .eq('record_id', recordId).order('created_at', { ascending: true });
    if (error) { setLoadErr(error.message); setItems([]); setLoading(false); return; }
    const rows = data ?? [];
    const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
    const map = {};
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles')
        .select('id, display_name, points, avatar_url').in('id', ids);
      (ps ?? []).forEach(p => { map[p.id] = p; });
    }
    setProfiles(map); setItems(rows); setLoading(false);
  }, [recordId]);

  useEffect(() => { load(); }, [load]);

  async function uploadFiles(contributionId, fileList) {
    const picked = Array.from(fileList ?? []).slice(0, 5);
    for (let i = 0; i < picked.length; i++) {
      setMsg(`⏳ กำลังอัปโหลดรูป ${i + 1}/${picked.length}...`);
      const file = await shrinkImage(picked[i], 2000, 0.85);
      if (file.size > 5 * 1024 * 1024) { setMsg('⚠ รูปใหญ่เกินไป: ' + picked[i].name); continue; }
      const path = `${recordId}/contrib/${contributionId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) { setMsg('⚠ อัปโหลดรูปไม่สำเร็จ: ' + upErr.message); continue; }
      const { error: insErr } = await supabase.from('archive_contribution_media')
        .insert({ contribution_id: contributionId, storage_path: path });
      if (insErr) setMsg('⚠ บันทึกรูปไม่สำเร็จ: ' + insErr.message);
    }
  }

  async function submit() {
    if (!me.user) { setMsg('⚠ เข้าสู่ระบบก่อนจึงจะร่วมเล่าได้'); return; }
    if (!body.trim() && !files?.length) { setMsg('⚠ พิมพ์เรื่องเล่าหรือแนบรูปอย่างน้อยหนึ่งอย่าง'); return; }
    setBusy(true); setMsg('⏳ กำลังส่ง...');
    const { data: row, error } = await supabase.from('archive_contributions')
      .insert({ record_id: recordId, user_id: me.user.id, body: body.trim() || null })
      .select().single();
    if (error) { setMsg('⚠ ส่งไม่สำเร็จ: ' + error.message); setBusy(false); return; }
    if (files?.length) await uploadFiles(row.id, files);
    setBody(''); setFiles(null); setBusy(false);
    setMsg('✓ ขอบคุณที่ร่วมเล่า');
    await load();
    setTimeout(() => setMsg(''), 3000);
  }

  async function saveEdit(c) {
    setBusy(true);
    const { error, count } = await supabase.from('archive_contributions')
      .update({ body: editBody.trim() || null }, { count: 'exact' }).eq('id', c.id);
    setBusy(false);
    if (error) { setMsg('⚠ บันทึกไม่สำเร็จ: ' + error.message); return; }
    if (count === 0) { setMsg('⚠ ไม่มีสิทธิ์แก้ข้อความนี้'); return; }
    setEditId(null); await load();
  }

  async function remove(c) {
    if (!confirm('ลบเรื่องเล่านี้และรูปทั้งหมดในนั้น?')) return;
    setBusy(true);
    const paths = (c.archive_contribution_media ?? []).map(m => m.storage_path).filter(Boolean);
    const { error, count } = await supabase.from('archive_contributions')
      .delete({ count: 'exact' }).eq('id', c.id);
    if (error) { setMsg('⚠ ลบไม่สำเร็จ: ' + error.message); setBusy(false); return; }
    if (count === 0) { setMsg('⚠ ไม่มีสิทธิ์ลบเรื่องเล่านี้'); setBusy(false); return; }
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    setBusy(false); await load();
  }

  async function delImage(m) {
    if (!confirm('ลบรูปนี้?')) return;
    const { error, count } = await supabase.from('archive_contribution_media')
      .delete({ count: 'exact' }).eq('id', m.id);
    if (error) { setMsg('⚠ ลบรูปไม่สำเร็จ: ' + error.message); return; }
    if (count === 0) { setMsg('⚠ ไม่มีสิทธิ์ลบรูปนี้'); return; }
    await supabase.storage.from(BUCKET).remove([m.storage_path]);
    await load();
  }

  async function addImagesTo(c, fl) {
    if (!fl?.length) return;
    setBusy(true); await uploadFiles(c.id, fl); setBusy(false);
    await load(); setMsg('✓ เพิ่มรูปแล้ว'); setTimeout(() => setMsg(''), 3000);
  }

  async function toggleVerify(c) {
    const { error } = await supabase.from('archive_contributions')
      .update({ verified: !c.verified }).eq('id', c.id);
    if (error) { setMsg('⚠ ' + error.message); return; }
    await load();
  }

  const imgUrl = p => supabase.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

  return (
    <div style={{ marginTop: '1.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>🤝 ผู้ร่วมเล่าเหตุการณ์ ({items.length})</span>
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', lineHeight: 1.8, marginBottom: '0.8rem' }}>
        เรื่องเล่าและรูปในส่วนนี้เป็นของผู้ร่วมเล่าแต่ละคน แยกจากบันทึกหลักด้านบน
        {' '}· เจ้าของแต่ละชิ้นแก้ไขและลบของตัวเองได้ตลอดเวลา
      </div>

      {loadErr && (
        <div style={{ fontSize: '0.78rem', color: 'var(--gold)', lineHeight: 1.7, marginBottom: '0.6rem' }}>
          ⚠ โหลดส่วนร่วมเล่าไม่สำเร็จ
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{loadErr}</div>
        </div>
      )}
      {!loading && !loadErr && items.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
          ยังไม่มีใครร่วมเล่า — ถ้าคุณรู้เรื่องนี้ เล่าเพิ่มได้เลย
        </div>
      )}

      {items.map(c => {
        const p = profiles[c.user_id];
        const mine = me.user && c.user_id === me.user.id;
        const canManage = mine || me.isAdmin;
        const media = c.archive_contribution_media ?? [];
        return (
          <div key={c.id} className="card" style={{ padding: '0.9rem 1rem', marginBottom: '0.7rem',
            borderLeft: `3px solid ${mine ? 'var(--jade)' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Link href={`/members/${c.user_id}`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Avatar path={p?.avatar_url} name={p?.display_name} size={26} />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p?.display_name ?? 'สมาชิก'}</span>
                </Link>
                <RankBadge points={p?.points} />
                {mine && <span style={{ fontSize: '0.68rem', color: 'var(--jade)' }}>· ของคุณ</span>}
                {c.verified && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.5)',
                    borderRadius: '10px', padding: '1px 8px' }}>✓ ผู้ดูแลตรวจสอบแล้ว</span>
                )}
                <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{fmtDate(c.created_at)}</span>
              </div>
              {canManage && editId !== c.id && (
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem' }}>
                  <span onClick={() => { setEditId(c.id); setEditBody(c.body ?? ''); }}
                    style={{ color: 'var(--gold2)', cursor: 'pointer' }}>แก้ไข</span>
                  <span onClick={() => remove(c)} style={{ color: 'var(--danger)', cursor: 'pointer' }}>ลบ</span>
                  {me.isAdmin && (
                    <span onClick={() => toggleVerify(c)} style={{ color: 'var(--muted)', cursor: 'pointer' }}>
                      {c.verified ? 'ถอดป้ายตรวจสอบ' : 'ติดป้ายตรวจสอบ'}</span>
                  )}
                </div>
              )}
            </div>

            {editId === c.id ? (
              <div style={{ marginTop: '0.6rem' }}>
                <textarea className="form-input" rows="4" value={editBody}
                  onChange={e => setEditBody(e.target.value)} style={{ resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn btn-jade btn-sm" disabled={busy} onClick={() => saveEdit(c)}>✓ บันทึก</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditId(null)}>ยกเลิก</button>
                  <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                    ＋ เพิ่มรูป
                    <input type="file" accept="image/*" multiple hidden
                      onChange={e => addImagesTo(c, e.target.files)} />
                  </label>
                </div>
              </div>
            ) : (
              c.body && <div style={{ fontSize: '0.88rem', lineHeight: 1.85, marginTop: '0.45rem', whiteSpace: 'pre-wrap' }}>{c.body}</div>
            )}

            {media.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.7rem' }}>
                {media.map(m => (
                  <div key={m.id} style={{ position: 'relative' }}>
                    <a href={imgUrl(m.storage_path)} target="_blank" rel="noreferrer">
                      <img src={imgUrl(m.storage_path)} alt="" loading="lazy"
                        style={{ width: '150px', height: '112px', objectFit: 'cover', borderRadius: '6px',
                          border: '1px solid var(--border)' }} />
                    </a>
                    {canManage && (
                      <span onClick={() => delImage(m)} title="ลบรูปนี้"
                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.65)',
                          color: '#fff', borderRadius: '4px', fontSize: '0.66rem', padding: '1px 6px', cursor: 'pointer' }}>✕</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {media.length > 0 && (
              <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: '5px' }}>
                📷 รูปโดย {p?.display_name ?? 'สมาชิก'}
              </div>
            )}
          </div>
        );
      })}

      {me.user ? (
        <div className="card" style={{ padding: '0.9rem 1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            ร่วมเล่าเหตุการณ์นี้
          </div>
          <textarea className="form-input" rows="3" value={body} onChange={e => setBody(e.target.value)}
            placeholder="คุณรู้อะไรเพิ่มเติมเกี่ยวกับเหตุการณ์นี้ · ใครอยู่ในเหตุการณ์ · เล่นเพลงอะไร · ความทรงจำส่วนตัว..."
            style={{ resize: 'vertical', marginBottom: '0.6rem' }} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input key={files ? 'has' : 'empty'} type="file" accept="image/*" multiple
              onChange={e => setFiles(e.target.files)}
              style={{ fontSize: '0.75rem', color: 'var(--muted)' }} />
            <button className="btn btn-jade btn-sm" disabled={busy} onClick={submit}>
              {busy ? '...' : 'ส่งเรื่องเล่า'}</button>
          </div>
          {msg && <div style={{ marginTop: '0.5rem', fontSize: '0.78rem',
            color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)' }}>{msg}</div>}
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.7 }}>
            เรื่องเล่าจะแสดงในชื่อของคุณทันที และคุณกลับมาแก้ไขหรือลบได้ตลอด
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          <Link href="/login" style={{ color: 'var(--jade)' }}>เข้าสู่ระบบ</Link> เพื่อร่วมเล่าเหตุการณ์นี้
        </div>
      )}
    </div>
  );
}
