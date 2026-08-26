'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, extractYouTubeId } from '../../lib/supabase';
import { textToVerses, versesToRows, rowsToVerses } from '../../lib/notation-core';
import NotationInput from '../../components/NotationInput';
import { NathabPreview } from '../../components/NathabEditor';
import { invalidateNathabLibrary } from '../../lib/nathab';
import { fmtDT, ago } from '../../lib/fmtdate';

// กระดานอ่านอย่างเดียวสำหรับดู/ฟังโน้ตที่ส่งมาก่อนอนุมัติ
function SubmissionBoard({ sub }) {
  const rows = submissionRows(sub);
  const j = sub.notation_json || {};
  if (!rows.length) return <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>อ่านโน้ตไม่ออก</div>;
  return <NotationInput initialVerses={rowsToVerses(rows)}
    options={{ readOnly: true, staff: true, base: j.base || 4, lineHong: j.line_hong || 8,
               twoHands: !!j.two_hands, level: j.level || 'สองชั้น', ensemble: j.ensemble || 'sai' }} />;
}

// แปลงสิ่งที่ส่งมา (รูปแบบใหม่ notation_json หรือข้อความเก่า) เป็นแถว song_melody
function submissionRows(sub) {
  const j = sub.notation_json;
  if (j && Array.isArray(j.rows) && j.rows.length) return j.rows;
  const verses = textToVerses(sub.notation_text || '', { base: 4 });
  const twoHands = verses.some(v => v.cells.some(c => c.l.length));
  return versesToRows(verses, { twoHands });
}

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState('archive');
  const [pendingVideos, setPendingVideos] = useState([]);
  const [pendingRecords, setPendingRecords] = useState([]);
  const [pendingTang, setPendingTang] = useState([]);
  const [boardOpen, setBoardOpen] = useState({});   // id → เปิดกระดานดูโน้ตที่ส่งมา
  const [pendingFiles, setPendingFiles] = useState([]);
  const [sampleFiles, setSampleFiles] = useState([]);
  const [sampleList, setSampleList] = useState([]);
  const [sampleMsg, setSampleMsg] = useState('');
  const [pendingSongs, setPendingSongs] = useState([]);
  const [songIdInput, setSongIdInput] = useState({});
  const [members, setMembers] = useState([]);
  const [nathabRows, setNathabRows] = useState([]);
  const [activity, setActivity] = useState({});   // id → {joined_at, last_sign_in_at}
  // เรียงตารางสมาชิก: กดหัวคอลัมน์ · กดซ้ำสลับ มาก→น้อย
  const [memberSort, setMemberSort] = useState({ key: 'points', dir: -1 });
  const sortMembers = key => setMemberSort(s => ({ key, dir: s.key === key ? -s.dir : (key === 'points' || key === 'joined' || key === 'lastseen' ? -1 : 1) }));
  const memberVal = (m, key) => {
    if (key === 'joined') return activity[m.id]?.joined_at ?? m.created_at ?? '';
    if (key === 'lastseen') return activity[m.id]?.last_sign_in_at ?? '';
    if (key === 'points') return m.points ?? 0;
    return (m[key] ?? '').toString();
  };
  const sortedMembers = [...members].sort((a, b) => {
    const va = memberVal(a, memberSort.key), vb = memberVal(b, memberSort.key);
    if (va === vb) return 0;
    if (va === '' || va == null) return 1;      // ค่าว่างไว้ท้ายเสมอ
    if (vb === '' || vb == null) return -1;
    const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'th');
    return c * memberSort.dir;
  });
  const Th = ({ k, children }) => (
    <th onClick={() => sortMembers(k)} style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} title="กดเพื่อเรียง · กดซ้ำสลับทิศ">
      {children}{memberSort.key === k ? (memberSort.dir > 0 ? ' ▲' : ' ▼') : <span style={{opacity:.25}}> ⇅</span>}
    </th>
  );
  const [mgQ, setMgQ] = useState('');
  const [mgSongs, setMgSongs] = useState([]);
  const [mgRecords, setMgRecords] = useState([]);
  const [mgComments, setMgComments] = useState([]);
  const [mgMsg, setMgMsg] = useState('');
  const [mgVideos, setMgVideos] = useState([]);
  const [mgTangs, setMgTangs] = useState([]);
  const [mgFiles, setMgFiles] = useState([]);
  const [pendingAudio, setPendingAudio] = useState([]);
  const [memberQ, setMemberQ] = useState('');
  const [memberList, setMemberList] = useState([]);
  const [memberMsg, setMemberMsg] = useState('');
  const [permRows, setPermRows] = useState([]);
  const [permMsg, setPermMsg] = useState('');
  const [scRows, setScRows] = useState([]);
  const [scMsg, setScMsg] = useState('');
  const [statTop, setStatTop] = useState({ song: [], archive: [] });
  const [statSum, setStatSum] = useState([]);
  async function loadStats() {
    const { data: ov } = await supabase.from('stats_overview').select('*');
    setStatSum(ov ?? []);
    const out = {};
    for (const t of ['song','archive']) {
      const { data } = await supabase.from('content_stats').select('*')
        .eq('target_type', t).order('views', { ascending: false }).limit(15);
      out[t] = data ?? [];
    }
    setStatTop(out);
  }
  async function loadSC() {
    const { data } = await supabase.from('site_content').select('*').order('key');
    setScRows(data ?? []);
  }
  async function clearSC(key) {
    if (!confirm('คืนค่าเดิมของ ' + key + ' ?')) return;
    await supabase.from('site_content').delete().eq('key', key);
    setScMsg('✓ คืนค่าเดิม ' + key); await loadSC();
    setTimeout(() => setScMsg(''), 2500);
  }
  async function loadPerms() {
    const { data } = await supabase.from('feature_permissions').select('*').order('sort');
    setPermRows(data ?? []);
  }
  async function togglePerm(row, tierKey) {
    const next = { ...row, [tierKey]: !row[tierKey] };
    setPermRows(permRows.map(r => r.feature_key === row.feature_key ? next : r));
    const { error } = await supabase.from('feature_permissions')
      .update({ [tierKey]: next[tierKey] }).eq('feature_key', row.feature_key);
    setPermMsg(error ? '⚠ ' + error.message : `✓ ${row.label} → มีผลทันที`);
    setTimeout(() => setPermMsg(''), 2500);
  }
  const [songs, setSongs] = useState([]);
  const [selSong, setSelSong] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        setRole(p?.role);
        if (p?.role === 'admin' || p?.role === 'moderator') { loadAll(); }
      }
      setLoading(false);
    });
  }, []);

  async function loadAll() {
    const { data: v } = await supabase.from('song_videos')
      .select('*, songs(name_th)').eq('approved', false).order('created_at');
    setPendingVideos(v ?? []);
    const { data: r } = await supabase.from('archive_records')
      .select('*, archive_media(*)').eq('approved', false).order('created_at');
    setPendingRecords(r ?? []);
    const { data: s } = await supabase.from('songs').select('id, name_th').order('name_th');
    setSongs(s ?? []);
    const { data: t } = await supabase.from('melody_submissions')
      .select('*, songs(name_th)').eq('approved', false).order('created_at');
    setPendingTang(t ?? []);
    const { data: f } = await supabase.from('song_files')
      .select('*, songs(name_th)').eq('approved', false).order('created_at');
    setPendingFiles(f ?? []);
    const { data: sl } = await supabase.storage.from('instrument-samples').list('gong');
    setSampleList((sl ?? []).map(x => x.name));
    const { data: ps } = await supabase.from('song_submissions')
      .select('*').eq('approved', false).order('created_at');
    setPendingSongs(ps ?? []);
    const { data: mb } = await supabase.from('profiles')
      .select('*').order('points', { ascending: false });
    setMembers(mb ?? []);
    // วันสมัคร/เข้าใช้ล่าสุด จาก auth.users (แอดมินเท่านั้น · ต้องรัน sql/10_timestamps.sql)
    try {
      const { data: act } = await supabase.rpc('thma_member_activity');
      const m = {}; (act ?? []).forEach(a => { m[a.id] = a; }); setActivity(m);
    } catch (e) {}
    const { data: np } = await supabase.from('nathab_patterns').select('*').order('id');
    setNathabRows(np ?? []);
    const { data: mr } = await supabase.from('archive_records')
      .select('id, what_text, who_text, when_text, approved').order('created_at', { ascending: false }).limit(50);
    setMgRecords(mr ?? []);
    // เดิมใช้ .select('*, profiles(display_name)') ซึ่งต้องมี foreign key
    // comments.user_id → profiles.id  ถ้าไม่มี PostgREST ตอบ 400 แล้วรายการว่างเปล่า
    const { data: mc } = await supabase.from('comments')
      .select('*').order('created_at', { ascending: false }).limit(50);
    const cRows = mc ?? [];
    const cIds = [...new Set(cRows.map(c => c.user_id).filter(Boolean))];
    const cProf = {};
    if (cIds.length) {
      const { data: cp } = await supabase.from('profiles').select('id, display_name').in('id', cIds);
      (cp ?? []).forEach(x => { cProf[x.id] = x; });
    }
    setMgComments(cRows.map(c => ({ ...c, profiles: cProf[c.user_id] ?? null })));
    const { data: mv } = await supabase.from('song_videos')
      .select('id, song_id, title, youtube_url, songs(name_th)').eq('approved', true)
      .order('created_at', { ascending: false }).limit(50);
    setMgVideos(mv ?? []);
    const { data: mt } = await supabase.from('song_melody')
      .select('song_id, instrument, songs(name_th)').neq('instrument', 'ทำนองหลัก').limit(2000);
    const seen = {}; const tangList = [];
    (mt ?? []).forEach(r => {
      const k = r.song_id + '|' + r.instrument;
      if (!seen[k]) { seen[k] = true; tangList.push(r); }
    });
    setMgTangs(tangList);
    const { data: pa } = await supabase.from('song_audio')
      .select('*, songs(name_th)').eq('approved', false).order('created_at');
    setPendingAudio(pa ?? []);
    const { data: mf } = await supabase.from('song_files')
      .select('id, song_id, title, storage_path, songs(name_th)').eq('approved', true)
      .order('created_at', { ascending: false }).limit(50);
    setMgFiles(mf ?? []);
  }

  async function approveVideo(id) {
    await supabase.from('song_videos').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
  }
  async function rejectVideo(id) {
    await supabase.from('song_videos').delete().eq('id', id);
    loadAll();
  }
  async function approveRecord(id) {
    await supabase.from('archive_records').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
  }
  async function rejectRecord(id) {
    await supabase.from('archive_records').delete().eq('id', id);
    loadAll();
  }

  // ── อนุมัติทางเครื่อง: แตกโน้ตลง song_melody จริง (เดิมแค่ติดธง ทางไม่เคยขึ้นหน้าเพลง) ──
  async function approveTang(id) {
    const sub = pendingTang.find(t => t.id === id);
    if (!sub) return;
    const parsed = submissionRows(sub);
    if (!parsed.length) { alert('อ่านโน้ตที่ส่งมาไม่ออก'); return; }
    const inst = sub.instrument || 'ทำนองหลัก';
    const { data: dup } = await supabase.from('song_melody').select('id').eq('song_id', sub.song_id).eq('instrument', inst).limit(1);
    if (dup && dup.length && !confirm(`เพลงนี้มีทาง ${inst} อยู่แล้ว — แทนที่ด้วยชุดที่ส่งมาใหม่?`)) return;
    if (dup && dup.length) await supabase.from('song_melody').delete().eq('song_id', sub.song_id).eq('instrument', inst);
    const rows = parsed.map(r => ({
      song_id: sub.song_id, verse_no: r.verse_no, instrument: inst,
      section: r.section ?? null, line_no: r.line_no ?? null,
      combined: r.combined, right_hand: r.right_hand ?? null, left_hand: r.left_hand ?? null,
      krasuan: r.krasuan ?? null, luktok: r.luktok ?? null,
      level: r.level ?? null, ching: r.ching ?? null,
      approved: true, submitted_by: sub.submitted_by,
    }));
    const { error } = await supabase.from('song_melody').insert(rows);
    if (error) { alert('บันทึกโน้ตไม่สำเร็จ: ' + error.message); return; }
    await supabase.from('melody_submissions').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    if (sub.submitted_by) await supabase.rpc('add_points', { uid: sub.submitted_by, pts: 10 });
    loadAll();
  }
  async function rejectTang(id) {
    await supabase.from('melody_submissions').delete().eq('id', id);
    loadAll();
  }

  async function approveFile(id) {
    await supabase.from('song_files').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
  }
  async function rejectFile(id) {
    await supabase.from('song_files').delete().eq('id', id);
    loadAll();
  }

  const EXPECTED = ['m_low','f_low','s_low','l_low','t_low',
    'd_mid','r_mid','m_mid','f_mid','s_mid','l_mid','t_mid',
    'd_high','r_high','m_high','f_high'];

  async function uploadSamples() {
    if (!sampleFiles.length) { setSampleMsg('⚠ เลือกไฟล์ก่อน'); return; }
    setSampleMsg('กำลังอัปโหลด...');
    let ok = 0, skip = 0;
    for (const file of Array.from(sampleFiles)) {
      const name = file.name.replace(/\.(mp3|wav|m4a)$/i, '');
      if (!EXPECTED.includes(name)) { skip++; continue; }
      const { error } = await supabase.storage.from('instrument-samples')
        .upload(`gong/${name}.mp3`, file, { upsert: true });
      if (!error) ok++;
    }
    setSampleMsg(`✓ อัปโหลด ${ok} ไฟล์` + (skip ? ` · ข้าม ${skip} ไฟล์ (ชื่อไม่ตรงระบบ)` : ''));
    loadAll();
  }

  // ── อนุมัติเพลงใหม่: สร้าง song + แตกโน้ต + ให้ศักดินา ──
  // ID ว่างถัดไปจากคำนำหน้า (SMR → SMR001/002/…)
  async function nextFreeId(prefixRaw) {
    const prefix = (prefixRaw || '').toUpperCase().replace(/\d+$/, '') || 'USR';
    const { data } = await supabase.from('songs').select('id').ilike('id', prefix + '%');
    const nums = (data ?? []).map(r => parseInt(String(r.id).slice(prefix.length))).filter(n => !isNaN(n));
    return prefix + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  }
  async function suggestId(sub) {
    const cur = (songIdInput[sub.id] ?? '').trim();
    const sid = await nextFreeId(cur || 'USR');
    setSongIdInput({ ...songIdInput, [sub.id]: sid });
  }
  async function approveSong(sub) {
    const sid = (songIdInput[sub.id] ?? '').trim().toUpperCase();
    if (!sid) { alert('ใส่ Song ID ก่อน เช่น USR001 (หรือกด 💡 ให้ระบบหา ID ว่าง)'); return; }
    const parsed = submissionRows(sub);
    if (!parsed.length) { alert('อ่านโน้ตที่ส่งมาไม่ออก'); return; }
    const inst = sub.instrument || 'ทำนองหลัก';
    // มีเพลง ID นี้อยู่แล้ว? → เสนอเพิ่มเป็น "ทาง" ใหม่ของเพลงเดิม (2026-08-26: เดิมชน songs_pkey แล้วหยุดเฉย ๆ)
    const { data: exist } = await supabase.from('songs').select('id, name_th').eq('id', sid).maybeSingle();
    let createSong = true;
    if (exist) {
      const free = await nextFreeId(sid);
      const addTang = confirm(`มีเพลง ${sid} "${exist.name_th}" อยู่แล้ว\n\nOK = เพิ่มโน้ตชุดนี้เป็นทาง "${inst}" ของเพลง ${sid} (ไม่สร้างเพลงใหม่)\nยกเลิก = ไม่ทำอะไร แล้วเปลี่ยน Song ID (ID ว่างถัดไปคือ ${free})`);
      if (!addTang) { setSongIdInput({ ...songIdInput, [sub.id]: free }); return; }
      createSong = false;
      const { count } = await supabase.from('song_melody').select('id', { count: 'exact', head: true }).eq('song_id', sid).eq('instrument', inst);
      if (count > 0) {
        if (!confirm(`เพลง ${sid} มีทาง "${inst}" อยู่แล้ว (${count} วรรค)\n\nOK = แทนที่ทางเดิมด้วยชุดนี้\nยกเลิก = ไม่ทำอะไร`)) return;
        const { error: eDel } = await supabase.from('song_melody').delete().eq('song_id', sid).eq('instrument', inst);
        if (eDel) { alert('ลบทางเดิมไม่สำเร็จ: ' + eDel.message); return; }
      }
    }
    if (createSong) {
      const { error: e1 } = await supabase.from('songs').insert({
        id: sid, name_th: sub.name_th, type: sub.song_type,
        total_verses: parsed.length, unique_patterns: new Set(parsed.map(r => r.krasuan)).size,
        contributed_by: sub.submitted_by,
      });
      if (e1) { alert('สร้างเพลงไม่สำเร็จ: ' + (e1.message.includes('songs_pkey') ? `Song ID ${sid} ถูกใช้แล้ว — กด 💡 ให้ระบบหา ID ว่าง` : e1.message)); return; }
    }
    const rows = parsed.map(r => ({
      song_id: sid, verse_no: r.verse_no, instrument: inst,
      section: r.section ?? null, line_no: r.line_no ?? null,
      combined: r.combined, right_hand: r.right_hand ?? null, left_hand: r.left_hand ?? null,
      krasuan: r.krasuan ?? null, luktok: r.luktok ?? null,
      level: r.level ?? null, ching: r.ching ?? null,
      approved: true, submitted_by: sub.submitted_by,
    }));
    const { error: e2 } = await supabase.from('song_melody').insert(rows);
    if (e2) { alert('บันทึกโน้ตไม่สำเร็จ: ' + e2.message); return; }
    await supabase.from('song_submissions').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(), assigned_song_id: sid,
    }).eq('id', sub.id);
    await supabase.rpc('add_points', { uid: sub.submitted_by, pts: 10 });
    alert(createSong ? `✓ สร้างเพลง ${sid} (${rows.length} วรรค) แล้ว` : `✓ เพิ่มทาง "${inst}" ให้เพลง ${sid} (${rows.length} วรรค) แล้ว`);
    loadAll();
  }
  async function rejectSong(id) {
    if (!confirm('ปฏิเสธเพลงนี้?')) return;
    await supabase.from('song_submissions').delete().eq('id', id);
    loadAll();
  }

  // ── จัดการข้อมูล ──
  async function searchSongs() {
    let q = supabase.from('songs').select('id, name_th, name_en, type').order('name_th').limit(30);
    if (mgQ) q = q.or(`name_th.ilike.%${mgQ}%,id.ilike.%${mgQ}%`);
    const { data } = await q;
    setMgSongs(data ?? []);
  }
  async function saveSong(s) {
    const { error } = await supabase.from('songs').update({ name_th: s.name_th, name_en: s.name_en || null, type: s.type }).eq('id', s.id);
    setMgMsg(error ? '⚠ ' + error.message : '✓ บันทึก ' + s.id);
  }
  async function deleteSong(id) {
    if (!confirm(`ลบเพลง ${id} ถาวร? โน้ต/วิดีโอ/ไฟล์ของเพลงนี้จะถูกลบทั้งหมด`)) return;
    await supabase.from('songs').delete().eq('id', id);
    setMgMsg('✓ ลบ ' + id + ' แล้ว'); searchSongs();
  }
  async function deleteRecord(id) {
    if (!confirm('ลบบันทึกนี้ถาวร?')) return;
    await supabase.from('archive_records').delete().eq('id', id); loadAll();
  }
  async function toggleRecordApprove(r) {
    await supabase.from('archive_records').update({ approved: !r.approved }).eq('id', r.id); loadAll();
  }
  async function deleteComment(id) {
    if (!confirm('ลบความคิดเห็นนี้?')) return;
    const c = mgComments.find(x => x.id === id);
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    if (c?.image_path) await supabase.storage.from('comment-images').remove([c.image_path]);
    loadAll();
  }
  async function deleteVideo(id) {
    if (!confirm('ลบวิดีโอนี้ถาวร?')) return;
    await supabase.from('song_videos').delete().eq('id', id); loadAll();
  }
  async function deleteTang(songId, instrument) {
    if (!confirm(`ลบทาง${instrument} ของเพลง ${songId} ทั้งหมด?`)) return;
    await supabase.from('song_melody').delete().eq('song_id', songId).eq('instrument', instrument);
    setMgMsg(`✓ ลบทาง${instrument} (${songId}) แล้ว`); loadAll();
  }
  async function deletePdf(f) {
    if (!confirm('ลบไฟล์ PDF นี้ถาวร?')) return;
    await supabase.storage.from('song-pdfs').remove([f.storage_path]);
    await supabase.from('song_files').delete().eq('id', f.id); loadAll();
  }

  async function setMemberRole(uid, newRole) {
    // ผ่านฟังก์ชันที่เช็คสิทธิ์ (คอลัมน์ role อัปเดตตรงไม่ได้แล้วหลังปิดช่องแอดมิน)
    const { error } = await supabase.rpc('set_user_role', { target: uid, new_role: newRole });
    if (error) { alert('เปลี่ยนสิทธิ์ไม่สำเร็จ: ' + error.message); return; }
    loadAll();
  }
  // คลังหน้าทับกลาง: แก้/เขียนที่หน้า /nathab · ที่นี่ใช้อนุมัติของที่สมาชิกส่งมา
  async function judgeNathab(row, ok) {
    const { error } = await supabase.rpc('approve_nathab', { p_id: String(row.id), p_ok: ok });
    setMgMsg(error ? '⚠ ' + error.message : (ok ? `✓ อนุมัติหน้าทับ ${row.nathab} · ${row.level} · ${row.instrument} เข้าคลังแล้ว` : `✗ ไม่อนุมัติ ${row.nathab}`));
    invalidateNathabLibrary();
    const { data: np } = await supabase.from('nathab_patterns').select('*').order('id');
    setNathabRows(np ?? []);
  }

  const [backupMsg, setBackupMsg] = useState('');
  async function searchMembers() {
    let q = supabase.from('profiles').select('id, display_name, province, points, role, tier')
      .order('points', { ascending: false }).limit(30);
    if (memberQ.trim()) q = q.ilike('display_name', `%${memberQ.trim()}%`);
    const { data } = await q;
    setMemberList(data ?? []);
  }
  async function saveMember(m) {
    const r = await supabase.rpc('set_user_role', { target: m.id, new_role: m.role });
    const t = r.error ? r : await supabase.rpc('set_user_tier', { target: m.id, new_tier: m.tier });
    const error = r.error || t.error;
    setMemberMsg(error ? '⚠ ' + error.message : `✓ บันทึก ${m.display_name} แล้ว`);
    setTimeout(() => setMemberMsg(''), 3000);
  }
  async function backupAll() {
    setBackupMsg('⏳ กำลังดึงข้อมูล...');
    await new Promise((res) => {
      if (window.XLSX) return res();
      const js = document.createElement('script');
      js.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      js.onload = res; document.head.appendChild(js);
    });
    const tables = ['songs','song_melody','archive_records','song_videos','song_files',
      'comments','profiles','nathab_patterns','melody_submissions','song_submissions'];
    const wb = window.XLSX.utils.book_new();
    for (const t of tables) {
      setBackupMsg(`⏳ ${t}...`);
      let all = [], from = 0;
      while (true) {
        const { data, error } = await supabase.from(t).select('*').range(from, from + 999);
        if (error || !data?.length) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      if (all.length) {
        const ws = window.XLSX.utils.json_to_sheet(all);
        window.XLSX.utils.book_append_sheet(wb, ws, t.slice(0, 31));
      }
    }
    const d = new Date().toISOString().slice(0, 10);
    window.XLSX.writeFile(wb, `THMA_backup_${d}.xlsx`);
    setBackupMsg('✓ ดาวน์โหลดไฟล์สำรองแล้ว — เก็บไว้ในที่ปลอดภัย');
  }

  async function exportMembers() {
    await new Promise((res) => {
      if (window.XLSX) return res();
      const js = document.createElement('script');
      js.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      js.onload = res; document.head.appendChild(js);
    });
    const rows = [['ชื่อ','อีเมล','เบอร์โทร','LINE','สำนัก/วง','จังหวัด','ศักดินา','สถานะ','สมัครเมื่อ','เข้าใช้ล่าสุด']];
    sortedMembers.forEach(m => rows.push([
      m.display_name ?? '', m.email ?? '', m.phone ?? '', m.line_id ?? '',
      m.organization ?? '', m.province ?? '', m.points ?? 0, m.role ?? '',
      fmtDT(activity[m.id]?.joined_at ?? m.created_at), fmtDT(activity[m.id]?.last_sign_in_at),
    ]));
    const ws = window.XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map(() => ({ wch: 18 }));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'สมาชิก');
    window.XLSX.writeFile(wb, 'THMA_members.xlsx');
  }

  async function addDirect() {
    const ytId = extractYouTubeId(url);
    if (!selSong) { setMsg('⚠ เลือกเพลงก่อน'); return; }
    if (!ytId) { setMsg('⚠ URL ไม่ถูกต้อง'); return; }
    const { error } = await supabase.from('song_videos').insert({
      song_id: selSong, youtube_url: url, youtube_id: ytId,
      title: title || null, submitted_by: user.id,
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    });
    if (error) { setMsg('⚠ ' + error.message); return; }
    setMsg('✓ เพิ่มวิดีโอเข้าเพลง ' + selSong + ' แล้ว');
    setUrl(''); setTitle('');
  }

  if (loading) return <main className="container">กำลังโหลด...</main>;
  const isRealAdmin = role === 'admin';
  if (!user || (role !== 'admin' && role !== 'moderator')) return (
    <main className="container">
      <div className="lock-box">
        <div style={{fontSize:'2rem',marginBottom:'0.8rem'}}>👑</div>
        <div style={{marginBottom:'1rem'}}>หน้านี้สำหรับ Admin เท่านั้น</div>
        <Link href="/login"><button className="btn btn-outline">เข้าสู่ระบบ</button></Link>
      </div>
    </main>
  );

  return (
    <main className="container">
      <div className="section-title">Admin Panel</div>
      <div className="section-subtitle">
        หอจดหมายเหตุรอตรวจ {pendingRecords.length} · วิดีโอเพลงรอตรวจ {pendingVideos.length}
      </div>

      <div style={{display:'flex',gap:'0',borderBottom:'1px solid var(--border)',marginBottom:'1.2rem'}}>
        {[['archive','หอจดหมายเหตุ ('+pendingRecords.length+')'],['videos','วิดีโอเพลง ('+pendingVideos.length+')'],['tang','ทางเครื่อง ('+pendingTang.length+')'],['files','PDF ('+pendingFiles.length+')'],['newsongs','เพลงใหม่ ('+pendingSongs.length+')'],['audio','เสียง ('+pendingAudio.length+')'],['manage','จัดการข้อมูล'],['members','สมาชิก ('+members.length+')'],['nathab','🥁 หน้าทับ'+(nathabRows.filter(r=>r.status==='pending').length?' ('+nathabRows.filter(r=>r.status==='pending').length+')':'')],['samples','🎵 เสียง'],['add','➕วิดีโอ'],['backup','💾 สำรอง'],['perm','🔐 สิทธิ์'],['content','🖼 เนื้อหาเว็บ'],['stats','📈 สถิติ']].map(([k,label]) => (
          <div key={k} onClick={() => setTab(k)}
            style={{padding:'8px 16px',fontSize:'0.85rem',cursor:'pointer',
              color: tab===k ? 'var(--gold)' : 'var(--muted)',
              borderBottom: tab===k ? '2px solid var(--gold)' : '2px solid transparent'}}>
            {label}
          </div>
        ))}
      </div>

      {tab === 'archive' && (
        pendingRecords.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีบันทึกรอตรวจ</div>
          : pendingRecords.map(r => (
            <div className="card" key={r.id}>
              <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                    <span className="badge badge-fixed">{r.era}</span>
                    <span style={{fontSize:'0.75rem',color:'var(--muted)'}}>{r.when_text}</span>
                  </div>
                  <div style={{fontWeight:600,margin:'6px 0 2px'}}>{r.what_text}</div>
                  <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>{r.who_text} · {r.where_text}</div>
                  {r.description && <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:'6px'}}>{r.description}</div>}
                  <div style={{fontSize:'0.72rem',color:'var(--jade)',marginTop:'6px'}}>
                    แนบ: รูป {(r.archive_media??[]).filter(m=>m.media_type==='image').length} · วิดีโอ {(r.archive_media??[]).filter(m=>m.media_type==='youtube').length}
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px',alignItems:'flex-start'}}>
                  <button className="btn btn-jade btn-sm" onClick={() => approveRecord(r.id)}>✓ Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => rejectRecord(r.id)}>✕ Reject</button>
                </div>
              </div>
            </div>
          ))
      )}

      {tab === 'videos' && (
        pendingVideos.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีวิดีโอรอตรวจ</div>
          : pendingVideos.map(v => (
            <div className="card" key={v.id}>
              <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                <div>
                  <div style={{fontWeight:500}}>{v.songs?.name_th} <span className="song-id">({v.song_id})</span></div>
                  <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:'4px'}}>{v.title || '(ไม่มีคำอธิบาย)'}</div>
                  <a href={v.youtube_url} target="_blank" style={{fontSize:'0.75rem',color:'var(--jade)'}}>เปิดดูบน YouTube ↗</a>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn btn-jade btn-sm" onClick={() => approveVideo(v.id)}>✓ Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => rejectVideo(v.id)}>✕ Reject</button>
                </div>
              </div>
            </div>
          ))
      )}

      {tab === 'tang' && (
        pendingTang.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีทางเครื่องรอตรวจ</div>
          : pendingTang.map(t => (
            <div className="card" key={t.id}>
              <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontWeight:600}}>{t.songs?.name_th} <span className="song-id">({t.song_id})</span>
                    <span className="badge badge-fixed" style={{marginLeft:'8px'}}>{t.instrument}</span></div>
                  {boardOpen[t.id]
                    ? <div style={{marginTop:'0.6rem'}}><SubmissionBoard sub={t} /></div>
                    : <pre style={{fontSize:'0.78rem',color:'var(--cream)',background:'var(--navy3)',
                        padding:'0.7rem',borderRadius:'5px',marginTop:'0.6rem',overflowX:'auto',
                        whiteSpace:'pre-wrap',fontFamily:'monospace'}}>{t.notation_text}</pre>}
                  <button className="btn btn-outline btn-sm" style={{marginTop:'0.4rem'}}
                    onClick={() => setBoardOpen({...boardOpen, [t.id]: !boardOpen[t.id]})}>
                    {boardOpen[t.id] ? 'ดูเป็นข้อความ' : '🎼 ดูบนกระดาน / ฟัง'}</button>
                  <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>
                    {submissionRows(t).length} วรรค
                    {t.notation_json?.two_hands ? ' · สองมือ R/L' : ''}
                    {t.notation_json?.line_hong && t.notation_json.line_hong !== 8 ? ` · บรรทัดละ ${t.notation_json.line_hong} ห้อง` : ''}
                    {' · กระสวน: '}<span style={{fontFamily:'monospace',color:'var(--gold)'}}>{submissionRows(t).map(r => r.krasuan).join(' ')}</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px',alignItems:'flex-start'}}>
                  <button className="btn btn-jade btn-sm" onClick={() => approveTang(t.id)}>✓ Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => rejectTang(t.id)}>✕ Reject</button>
                </div>
              </div>
            </div>
          ))
      )}

      {tab === 'files' && (
        pendingFiles.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีไฟล์รอตรวจ</div>
          : pendingFiles.map(f => {
            const url = supabase.storage.from('song-pdfs').getPublicUrl(f.storage_path).data.publicUrl;
            return (
              <div className="card" key={f.id}>
                <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontWeight:600}}>{f.songs?.name_th} <span className="song-id">({f.song_id})</span></div>
                    <div style={{fontSize:'0.8rem',color:'var(--muted)',marginTop:'4px'}}>{f.title}</div>
                    <a href={url} target="_blank" style={{fontSize:'0.75rem',color:'var(--jade)'}}>เปิดดู PDF ↗</a>
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'flex-start'}}>
                    <button className="btn btn-jade btn-sm" onClick={() => approveFile(f.id)}>✓ Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => rejectFile(f.id)}>✕ Reject</button>
                  </div>
                </div>
              </div>
            );
          })
      )}

      {tab === 'samples' && (
        <div className="card" style={{borderColor:'rgba(201,168,76,0.5)',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{flex:'1 1 320px',fontSize:'0.8rem',lineHeight:1.8}}>
            <b>🥁 คลังเสียงกลอง ฉิ่ง และเครื่องอื่น</b><br/>
            <span style={{color:'var(--muted)'}}>ตะโพน กลองแขก กลองสองหน้า โทนรำมะนา กลองทัด ฉิ่ง — โฟลเดอร์ = เครื่อง · ชื่อไฟล์ = พยางค์ (theng.mp3 = เท่ง) อัปแล้วหน้าทับใช้เสียงจริงทันที</span>
          </div>
          <Link href="/admin/samples"><button className="btn btn-primary btn-sm">เปิดคลังเสียงเครื่องดนตรี →</button></Link>
        </div>
      )}
      {tab === 'samples' && (
        <div className="card" style={{borderColor:'rgba(76,154,132,0.3)'}}>
          <div style={{fontSize:'0.95rem',fontWeight:600,marginBottom:'0.4rem'}}>🎵 ไฟล์เสียงฆ้องวงใหญ่ (16 ลูก)</div>
          <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:'1rem',lineHeight:1.7}}>
            ตั้งชื่อไฟล์: <code style={{color:'var(--gold)'}}>ตัวโน้ต_ระดับ.mp3</code> เช่น d_mid.mp3, t_low.mp3, f_high.mp3<br/>
            (d=ด r=ร m=ม f=ฟ s=ซ l=ล t=ท · low=ต่ำฺ mid=กลาง high=สูงํ) · เลือกหลายไฟล์พร้อมกันได้ · อัปโหลดซ้ำ=แทนที่
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))',gap:'6px',marginBottom:'1rem'}}>
            {EXPECTED.map(k => {
              const have = sampleList.includes(k + '.mp3');
              return (
                <div key={k} style={{padding:'6px 8px',borderRadius:'5px',fontSize:'0.72rem',
                  fontFamily:'monospace',textAlign:'center',
                  background: have ? 'rgba(76,154,132,0.15)' : 'var(--navy3)',
                  border: have ? '1px solid rgba(76,154,132,0.4)' : '1px solid var(--border)',
                  color: have ? 'var(--jade)' : 'var(--muted)'}}>
                  {have ? '✓' : '·'} {k}
                </div>
              );
            })}
          </div>
          <div className="form-group">
            <input className="form-input" type="file" accept=".mp3,.wav,.m4a" multiple
              onChange={e => setSampleFiles(e.target.files)} />
          </div>
          <button className="btn btn-jade" onClick={uploadSamples}>⬆ อัปโหลดไฟล์เสียง</button>
          {sampleMsg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{sampleMsg}</div>}
        </div>
      )}

      {tab === 'newsongs' && (
        pendingSongs.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีเพลงใหม่รอตรวจ</div>
          : pendingSongs.map(s => (
            <div className="card" key={s.id}>
              <div style={{fontWeight:600}}>{s.name_th}
                <span className="badge badge-fixed" style={{marginLeft:'8px'}}>{s.song_type}</span>
                <span className="badge badge-mixed" style={{marginLeft:'4px'}}>{s.instrument}</span></div>
              {s.note && <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'4px'}}>📝 {s.note}</div>}
              {boardOpen[s.id]
                ? <div style={{marginTop:'0.6rem'}}><SubmissionBoard sub={s} /></div>
                : <pre style={{fontSize:'0.8rem',background:'var(--navy3)',padding:'0.7rem',borderRadius:'5px',
                    marginTop:'0.6rem',overflowX:'auto',whiteSpace:'pre-wrap',fontFamily:'monospace'}}>{s.notation_text}</pre>}
              <div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:'4px'}}>
                {submissionRows(s).length} วรรค · กระสวน: <span style={{fontFamily:'monospace',color:'var(--gold)'}}>{submissionRows(s).map(r => r.krasuan).join(' ')}</span>
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginTop:'0.6rem'}}>
                <button className="btn btn-outline btn-sm" onClick={() => setBoardOpen({...boardOpen, [s.id]: !boardOpen[s.id]})}>
                  {boardOpen[s.id] ? 'ดูเป็นข้อความ' : '🎼 ดูบนกระดาน / ฟัง'}</button>
                <input className="form-input" style={{width:'140px'}} placeholder="Song ID เช่น USR001"
                  value={songIdInput[s.id] ?? ''} onChange={e => setSongIdInput({...songIdInput, [s.id]: e.target.value})} />
                <button className="btn btn-outline btn-sm" title="หา Song ID ว่างถัดไปจากคำนำหน้าที่พิมพ์ (เช่น SMR → SMR002)" onClick={() => suggestId(s)}>💡 ID ว่าง</button>
                <button className="btn btn-jade btn-sm" onClick={() => approveSong(s)}>✓ อนุมัติ + สร้างเพลง</button>
                <button className="btn btn-danger btn-sm" onClick={() => rejectSong(s.id)}>✕ ปฏิเสธ</button>
              </div>
            </div>
          ))
      )}

      {tab === 'audio' && (
        pendingAudio.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีไฟล์เสียงรอตรวจ</div>
          : pendingAudio.map(a => {
            const url = supabase.storage.from('song-audio').getPublicUrl(a.storage_path).data.publicUrl;
            return (
              <div className="card" key={a.id}>
                <div style={{fontWeight:600}}>{a.songs?.name_th}
                  <span style={{color:'var(--muted)',fontSize:'0.78rem'}}> · {a.title ?? '-'} · {a.performer ?? '-'} · {a.year_recorded ?? '-'}</span></div>
                <audio controls preload="none" src={url} style={{width:'100%',margin:'0.6rem 0'}} />
                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn btn-jade btn-sm" onClick={async () => {
                    await supabase.from('song_audio').update({ approved: true }).eq('id', a.id); loadAll();
                  }}>✓ อนุมัติ (+10 ศักดินา)</button>
                  <button className="btn btn-danger btn-sm" onClick={async () => {
                    if (!confirm('ปฏิเสธและลบไฟล์เสียงนี้?')) return;
                    await supabase.storage.from('song-audio').remove([a.storage_path]);
                    await supabase.from('song_audio').delete().eq('id', a.id); loadAll();
                  }}>✕ ปฏิเสธ</button>
                </div>
              </div>
            );
          })
      )}

      {tab === 'manage' && (
        <>
          {mgMsg && <div style={{fontSize:'0.8rem',color:'var(--jade)',marginBottom:'0.6rem'}}>{mgMsg}</div>}
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎼 เพลง — แก้ไข / ลบ</div>
            <div style={{display:'flex',gap:'8px',marginBottom:'0.8rem'}}>
              <input className="form-input" placeholder="ค้นหาชื่อเพลงหรือ ID..." value={mgQ}
                onChange={e => setMgQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchSongs()} />
              <button className="btn btn-outline btn-sm" onClick={searchSongs}>ค้นหา</button>
            </div>
            {mgSongs.map((s, i) => (
              <div key={s.id} style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px',flexWrap:'wrap'}}>
                <span className="song-id" style={{width:'70px'}}>{s.id}</span>
                <input className="form-input" style={{flex:1,minWidth:'160px'}} value={s.name_th}
                  onChange={e => setMgSongs(mgSongs.map((x,j) => j===i ? {...x, name_th: e.target.value} : x))} />
                <input className="form-input" style={{width:'130px'}} value={s.type ?? ''}
                  onChange={e => setMgSongs(mgSongs.map((x,j) => j===i ? {...x, type: e.target.value} : x))} />
                <input className="form-input" style={{width:'150px'}} placeholder="English name" value={s.name_en ?? ''}
                  onChange={e => setMgSongs(mgSongs.map((x,j) => j===i ? {...x, name_en: e.target.value} : x))} />
                <button className="btn btn-jade btn-sm" onClick={() => saveSong(s)}>💾</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteSong(s.id)}>🗑</button>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>📜 จดหมายเหตุ (50 ล่าสุด) — ซ่อน / ลบ</div>
            {mgRecords.map(r => (
              <div key={r.id} style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px',flexWrap:'wrap'}}>
                <span style={{flex:1,fontSize:'0.82rem',minWidth:'200px'}}>
                  {r.approved ? '🟢' : '⚪'} {r.what_text} <span style={{color:'var(--muted)'}}>· {r.who_text} · {r.when_text}</span>
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => toggleRecordApprove(r)}>
                  {r.approved ? 'ซ่อน' : 'แสดง'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteRecord(r.id)}>🗑</button>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎬 วิดีโอเพลง (50 ล่าสุด) — ลบ</div>
            {mgVideos.map(v => (
              <div key={v.id} style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                <span style={{flex:1,fontSize:'0.8rem'}}>{v.songs?.name_th}
                  <span style={{color:'var(--muted)'}}> · {v.title ?? v.youtube_url}</span></span>
                <a href={v.youtube_url} target="_blank" style={{fontSize:'0.72rem',color:'var(--jade)'}}>ดู↗</a>
                <button className="btn btn-danger btn-sm" onClick={() => deleteVideo(v.id)}>🗑</button>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎹 ทางเครื่องดนตรี — ลบ</div>
            {mgTangs.length === 0
              ? <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>มีเฉพาะทำนองหลัก</div>
              : mgTangs.map((t, i) => (
                <div key={i} style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{flex:1,fontSize:'0.8rem'}}>{t.songs?.name_th}
                    <span className="badge badge-fixed" style={{marginLeft:'6px'}}>{t.instrument}</span></span>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteTang(t.song_id, t.instrument)}>🗑</button>
                </div>
              ))}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>📁 ไฟล์ PDF (50 ล่าสุด) — ลบ</div>
            {mgFiles.map(f => {
              const url = supabase.storage.from('song-pdfs').getPublicUrl(f.storage_path).data.publicUrl;
              return (
                <div key={f.id} style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{flex:1,fontSize:'0.8rem'}}>{f.songs?.name_th}
                    <span style={{color:'var(--muted)'}}> · {f.title}</span></span>
                  <a href={url} target="_blank" style={{fontSize:'0.72rem',color:'var(--jade)'}}>เปิด↗</a>
                  <button className="btn btn-danger btn-sm" onClick={() => deletePdf(f)}>🗑</button>
                </div>
              );
            })}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>💬 ความคิดเห็น (50 ล่าสุด)</div>
            {mgComments.length === 0 &&
              <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>ยังไม่มีความคิดเห็น</div>}
            {mgComments.map(c => {
              const href = c.target_type === 'archive' ? `/archive/${c.target_id}`
                : c.target_type === 'song' ? `/songs/${c.target_id}` : '#';
              return (
                <div key={c.id} style={{display:'flex',gap:'8px',alignItems:'flex-start',marginBottom:'8px'}}>
                  <span style={{flex:1,fontSize:'0.8rem',lineHeight:1.6}}>
                    <b>{c.profiles?.display_name ?? 'สมาชิก'}</b>
                    <span style={{color:'var(--muted)',fontSize:'0.72rem',marginLeft:'6px'}}>
                      {new Date(c.created_at).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' })}
                    </span>
                    <br/>{(c.body ?? '(รูปภาพ)').slice(0, 120)}
                  </span>
                  <a href={href} target="_blank" style={{fontSize:'0.72rem',color:'var(--jade)',whiteSpace:'nowrap'}}>ดู↗</a>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteComment(c.id)}>🗑</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'stats' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.3rem'}}>📈 สถิติการเข้าชมและการแชร์</div>
          <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:'0.8rem'}}>
            นับ 1 วิวต่อผู้ชม 1 คนต่อชิ้นงาน ทุก 6 ชั่วโมง · ยอดแชร์นับเมื่อกดปุ่มแชร์
            <button className="btn btn-outline btn-sm" style={{marginLeft:'8px'}} onClick={loadStats}>โหลดสถิติ</button>
          </div>
          {statSum.length > 0 && (
            <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'1rem'}}>
              {statSum.map(r => (
                <div key={r.target_type} className="card" style={{flex:'1 1 190px',margin:0,padding:'0.8rem'}}>
                  <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>
                    {r.target_type === 'song' ? '🎵 เพลง' : r.target_type === 'archive' ? '📜 เหตุการณ์' : r.target_type}</div>
                  <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--gold)'}}>
                    👁 {Number(r.total_views ?? 0).toLocaleString('th-TH')}</div>
                  <div style={{fontSize:'0.78rem',color:'var(--jade)'}}>
                    ↗ แชร์ {Number(r.total_shares ?? 0).toLocaleString('th-TH')} · {r.items} รายการ</div>
                </div>
              ))}
            </div>
          )}
          {['song','archive'].map(t => (statTop[t]?.length > 0 && (
            <div key={t} style={{marginBottom:'1rem'}}>
              <div style={{fontWeight:600,fontSize:'0.85rem',marginBottom:'0.4rem'}}>
                {t === 'song' ? '🎵 เพลงยอดนิยม 15 อันดับ' : '📜 เหตุการณ์ยอดนิยม 15 อันดับ'}</div>
              {statTop[t].map((r, i) => (
                <div key={r.target_id} style={{display:'flex',gap:'10px',fontSize:'0.8rem',
                  padding:'5px 0',borderBottom:'1px solid rgba(42,63,92,0.3)'}}>
                  <span style={{color:'var(--muted)',width:'22px'}}>{i+1}.</span>
                  <a href={`/${t === 'song' ? 'songs' : 'archive'}/${r.target_id}`}
                    style={{flex:1,color:'var(--gold2)',overflow:'hidden',textOverflow:'ellipsis'}}>{r.target_id}</a>
                  <span>👁 {r.views}</span><span style={{color:'var(--jade)'}}>↗ {r.shares}</span>
                </div>
              ))}
            </div>
          )))}
          {statSum.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>กด "โหลดสถิติ" (ต้องรัน thma_stats.sql ก่อน)</div>}
        </div>
      )}

      {tab === 'content' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.3rem'}}>🖼 เนื้อหาเว็บที่ถูกแก้ไข</div>
          <div style={{fontSize:'0.74rem',color:'var(--muted)',lineHeight:1.9,marginBottom:'0.8rem'}}>
            วิธีแก้ข้อความ/รูป: เข้าหน้านั้นๆ ขณะล็อกอินเป็น Admin แล้วกดปุ่ม ✏️ ข้างข้อความ หรือปุ่ม ＋ เพิ่มรูป บนกรอบรูป<br/>
            ตารางนี้แสดงรายการที่แก้ไปแล้ว กด "คืนค่าเดิม" เพื่อกลับไปใช้ข้อความต้นฉบับในโค้ด
            <button className="btn btn-outline btn-sm" style={{marginLeft:'8px'}} onClick={loadSC}>โหลดรายการ</button>
          </div>
          {scMsg && <div style={{fontSize:'0.8rem',color:'var(--jade)',marginBottom:'0.5rem'}}>{scMsg}</div>}
          {scRows.map(r => (
            <div key={r.key} style={{display:'flex',gap:'10px',alignItems:'flex-start',
              padding:'8px 0',borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'0.72rem',color:'var(--gold)'}}>{r.key}</div>
                <div style={{fontSize:'0.8rem',color:'var(--cream)',whiteSpace:'pre-wrap',
                  maxHeight:'60px',overflow:'hidden'}}>{r.text_value ?? (r.image_path ? '🖼 ' + r.image_path : '—')}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => clearSC(r.key)}
                style={{fontSize:'0.68rem'}}>↺ คืนค่าเดิม</button>
            </div>
          ))}
          {scRows.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>ยังไม่มีการแก้ไข (หรือกดโหลดรายการ)</div>}
        </div>
      )}

      {tab === 'perm' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.3rem'}}>🔐 ตารางสิทธิ์การมองเห็น</div>
          <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:'0.8rem'}}>
            ติ๊ก = เปิดให้เห็น/ใช้งาน · บันทึกและมีผลทันทีทั้งเว็บ · คอลัมน์ Admin ล็อกเปิดเสมอ
            {permRows.length === 0 && <button className="btn btn-outline btn-sm" style={{marginLeft:'8px'}} onClick={loadPerms}>โหลดตาราง</button>}
          </div>
          {permMsg && <div style={{fontSize:'0.78rem',color:'var(--jade)',marginBottom:'0.5rem'}}>{permMsg}</div>}
          {permRows.length > 0 && (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem'}}>
                <thead><tr style={{borderBottom:'2px solid var(--border)'}}>
                  <th style={{textAlign:'left',padding:'6px'}}>สิทธิ์</th>
                  <th style={{padding:'6px'}}>👤 ผู้เยี่ยมชม</th>
                  <th style={{padding:'6px'}}>สมาชิกฟรี</th>
                  <th style={{padding:'6px'}}>💎 อุปถัมภ์</th>
                  <th style={{padding:'6px'}}>Admin</th>
                </tr></thead>
                <tbody>
                  {permRows.map((row, i) => (
                    <>
                      {(i === 0 || permRows[i-1].section !== row.section) && (
                        <tr key={row.section}><td colSpan={5} style={{padding:'10px 6px 4px',color:'var(--gold)',fontWeight:700,fontSize:'0.75rem'}}>▸ {row.section}</td></tr>
                      )}
                      <tr key={row.feature_key} style={{borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
                        <td style={{padding:'6px'}}>{row.label}</td>
                        {['guest','free','premium'].map(tk => (
                          <td key={tk} style={{textAlign:'center'}}>
                            <input type="checkbox" checked={!!row[tk]} onChange={() => togglePerm(row, tk)}
                              style={{width:'17px',height:'17px',accentColor:'var(--gold)',cursor:'pointer'}} />
                          </td>
                        ))}
                        <td style={{textAlign:'center'}}>
                          <input type="checkbox" checked disabled style={{width:'17px',height:'17px',accentColor:'var(--jade)'}} />
                        </td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {permRows.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>กด "โหลดตาราง" (ต้องรัน thma_permissions.sql ก่อน)</div>}
        </div>
      )}

      {tab === 'members' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.8rem'}}>
            <div style={{fontWeight:600}}>👥 สมาชิกทั้งหมด ({members.length})</div>
            <button className="btn btn-jade btn-sm" onClick={exportMembers}>📊 Export Excel</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><Th k="display_name">ชื่อ / อีเมล</Th><Th k="phone">ติดต่อ</Th><Th k="organization">สำนัก / จังหวัด</Th><Th k="points">ศักดินา</Th><Th k="joined">สมัคร · เข้าใช้ล่าสุด</Th><Th k="role">สถานะ</Th></tr></thead>
              <tbody>
                {sortedMembers.map(m => (
                  <tr key={m.id}>
                    <td style={{minWidth:'150px'}}>
                      <Link href={`/members/${m.id}`} style={{color:'var(--cream)'}}>{m.display_name ?? '—'}</Link>
                      <div style={{fontSize:'0.68rem',color:'var(--muted)',wordBreak:'break-all'}}>{m.email ?? '—'}</div>
                    </td>
                    <td style={{fontSize:'0.7rem',color:'var(--muted)'}}>{[m.phone, m.line_id && 'LINE ' + m.line_id].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{fontSize:'0.7rem',color:'var(--muted)'}}>{[m.organization, m.province].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{fontFamily:'monospace',color:'var(--jade)',whiteSpace:'nowrap'}}>{(m.points ?? 0).toLocaleString()}</td>
                    <td style={{fontSize:'0.68rem',whiteSpace:'nowrap'}}>
                      <div title={activity[m.id]?.joined_at ?? m.created_at ?? ''}>{fmtDT(activity[m.id]?.joined_at ?? m.created_at) || '—'}</div>
                      <div style={{color:'var(--muted)'}} title={fmtDT(activity[m.id]?.last_sign_in_at)}>{activity[m.id]?.last_sign_in_at ? 'ล่าสุด ' + ago(activity[m.id].last_sign_in_at) : ''}</div>
                    </td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <select className="filter-select" value={m.role ?? 'member'}
                        onChange={e => setMemberRole(m.id, e.target.value)}
                        disabled={m.role === 'admin' && !isRealAdmin}
                        title={m.role === 'admin' && !isRealAdmin ? 'บัญชีแอดมิน — แก้ได้เฉพาะแอดมินด้วยกัน' : ''}
                        style={{fontSize:'0.72rem',padding:'2px 6px'}}>
                        <option value="member">สมาชิก</option>
                        <option value="student">🎓 Student (ใช้กระดานโน้ตได้)</option>
                        <option value="superuser">👁 Super user (เห็นทุกอย่าง)</option>
                        <option value="moderator">🛡 Moderator</option>
                        {(isRealAdmin || m.role === 'admin') && <option value="admin">⭐ Admin</option>}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'nathab' && (
        <div>
          <div className="card" style={{fontSize:'0.8rem',lineHeight:1.9}}>
            <b>🥁 คลังหน้าทับกลาง</b> — เขียน/แก้/ลบหน้าทับทั้งหมดได้ที่หน้า{' '}
            <Link href="/nathab" style={{color:'var(--gold)'}}>/nathab</Link> (แอดมินบันทึกเข้าคลังทันที)
            · ในคลังตอนนี้ {nathabRows.filter(r => r.status === 'approved').length} รายการ
            · ผูกหน้าทับกับเพลงได้ที่หน้าเพลง แผง 🥁 หน้าทับ
          </div>
          {mgMsg && <div style={{fontSize:'0.8rem',color: mgMsg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)',margin:'0.5rem 0'}}>{mgMsg}</div>}
          <div style={{fontWeight:600,fontSize:'0.9rem',margin:'0.8rem 0 0.4rem'}}>
            ⏳ รออนุมัติ ({nathabRows.filter(r => r.status === 'pending').length})
          </div>
          {nathabRows.filter(r => r.status === 'pending').length === 0 && (
            <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>ไม่มีหน้าทับที่รออนุมัติ</div>
          )}
          {nathabRows.filter(r => r.status === 'pending').map(row => {
            const cur = nathabRows.find(x => x.status === 'approved' && x.nathab === row.nathab && x.level === row.level && x.instrument === row.instrument);
            const who = members.find(m => m.id === row.submitted_by);
            return (
              <div className="card" key={row.id} style={{padding:'0.8rem'}}>
                <div style={{fontSize:'0.82rem',fontWeight:600,marginBottom:'0.4rem'}}>
                  {row.nathab} · {row.level} · {row.instrument}
                  <span style={{fontWeight:400,color:'var(--muted)',fontSize:'0.72rem',marginLeft:8}}>
                    โดย {who?.display_name ?? '—'} · {row.created_at ? new Date(row.created_at).toLocaleDateString('th-TH') : ''}
                    {cur ? ' · จะแทนที่แถวเดิมในคลัง' : ' · หน้าทับใหม่'}</span>
                </div>
                {row.note && <div style={{fontSize:'0.74rem',color:'var(--muted)',marginBottom:4}}>หมายเหตุ: {row.note}{row.source ? ` · ที่มา: ${row.source}` : ''}</div>}
                <div style={{fontSize:'0.68rem',color:'var(--muted)'}}>ที่ส่งมา</div>
                <NathabPreview row={row} />
                {cur && <>
                  <div style={{fontSize:'0.68rem',color:'var(--muted)',marginTop:6}}>ของเดิมในคลัง</div>
                  <NathabPreview row={cur} />
                </>}
                <div style={{display:'flex',gap:8,marginTop:'0.6rem'}}>
                  <button className="btn btn-jade btn-sm" onClick={() => judgeNathab(row, true)}>✓ อนุมัติ</button>
                  <button className="btn btn-outline btn-sm" onClick={() => judgeNathab(row, false)}>✗ ไม่อนุมัติ</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'stats' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.3rem'}}>📈 สถิติการเข้าชมและการแชร์</div>
          <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:'0.8rem'}}>
            นับ 1 วิวต่อผู้ชม 1 คนต่อชิ้นงาน ทุก 6 ชั่วโมง · ยอดแชร์นับเมื่อกดปุ่มแชร์
            <button className="btn btn-outline btn-sm" style={{marginLeft:'8px'}} onClick={loadStats}>โหลดสถิติ</button>
          </div>
          {statSum.length > 0 && (
            <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'1rem'}}>
              {statSum.map(r => (
                <div key={r.target_type} className="card" style={{flex:'1 1 190px',margin:0,padding:'0.8rem'}}>
                  <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>
                    {r.target_type === 'song' ? '🎵 เพลง' : r.target_type === 'archive' ? '📜 เหตุการณ์' : r.target_type}</div>
                  <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--gold)'}}>
                    👁 {Number(r.total_views ?? 0).toLocaleString('th-TH')}</div>
                  <div style={{fontSize:'0.78rem',color:'var(--jade)'}}>
                    ↗ แชร์ {Number(r.total_shares ?? 0).toLocaleString('th-TH')} · {r.items} รายการ</div>
                </div>
              ))}
            </div>
          )}
          {['song','archive'].map(t => (statTop[t]?.length > 0 && (
            <div key={t} style={{marginBottom:'1rem'}}>
              <div style={{fontWeight:600,fontSize:'0.85rem',marginBottom:'0.4rem'}}>
                {t === 'song' ? '🎵 เพลงยอดนิยม 15 อันดับ' : '📜 เหตุการณ์ยอดนิยม 15 อันดับ'}</div>
              {statTop[t].map((r, i) => (
                <div key={r.target_id} style={{display:'flex',gap:'10px',fontSize:'0.8rem',
                  padding:'5px 0',borderBottom:'1px solid rgba(42,63,92,0.3)'}}>
                  <span style={{color:'var(--muted)',width:'22px'}}>{i+1}.</span>
                  <a href={`/${t === 'song' ? 'songs' : 'archive'}/${r.target_id}`}
                    style={{flex:1,color:'var(--gold2)',overflow:'hidden',textOverflow:'ellipsis'}}>{r.target_id}</a>
                  <span>👁 {r.views}</span><span style={{color:'var(--jade)'}}>↗ {r.shares}</span>
                </div>
              ))}
            </div>
          )))}
          {statSum.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>กด "โหลดสถิติ" (ต้องรัน thma_stats.sql ก่อน)</div>}
        </div>
      )}

      {tab === 'content' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.3rem'}}>🖼 เนื้อหาเว็บที่ถูกแก้ไข</div>
          <div style={{fontSize:'0.74rem',color:'var(--muted)',lineHeight:1.9,marginBottom:'0.8rem'}}>
            วิธีแก้ข้อความ/รูป: เข้าหน้านั้นๆ ขณะล็อกอินเป็น Admin แล้วกดปุ่ม ✏️ ข้างข้อความ หรือปุ่ม ＋ เพิ่มรูป บนกรอบรูป<br/>
            ตารางนี้แสดงรายการที่แก้ไปแล้ว กด "คืนค่าเดิม" เพื่อกลับไปใช้ข้อความต้นฉบับในโค้ด
            <button className="btn btn-outline btn-sm" style={{marginLeft:'8px'}} onClick={loadSC}>โหลดรายการ</button>
          </div>
          {scMsg && <div style={{fontSize:'0.8rem',color:'var(--jade)',marginBottom:'0.5rem'}}>{scMsg}</div>}
          {scRows.map(r => (
            <div key={r.key} style={{display:'flex',gap:'10px',alignItems:'flex-start',
              padding:'8px 0',borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'0.72rem',color:'var(--gold)'}}>{r.key}</div>
                <div style={{fontSize:'0.8rem',color:'var(--cream)',whiteSpace:'pre-wrap',
                  maxHeight:'60px',overflow:'hidden'}}>{r.text_value ?? (r.image_path ? '🖼 ' + r.image_path : '—')}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => clearSC(r.key)}
                style={{fontSize:'0.68rem'}}>↺ คืนค่าเดิม</button>
            </div>
          ))}
          {scRows.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>ยังไม่มีการแก้ไข (หรือกดโหลดรายการ)</div>}
        </div>
      )}

      {tab === 'perm' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.3rem'}}>🔐 ตารางสิทธิ์การมองเห็น</div>
          <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:'0.8rem'}}>
            ติ๊ก = เปิดให้เห็น/ใช้งาน · บันทึกและมีผลทันทีทั้งเว็บ · คอลัมน์ Admin ล็อกเปิดเสมอ
            {permRows.length === 0 && <button className="btn btn-outline btn-sm" style={{marginLeft:'8px'}} onClick={loadPerms}>โหลดตาราง</button>}
          </div>
          {permMsg && <div style={{fontSize:'0.78rem',color:'var(--jade)',marginBottom:'0.5rem'}}>{permMsg}</div>}
          {permRows.length > 0 && (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem'}}>
                <thead><tr style={{borderBottom:'2px solid var(--border)'}}>
                  <th style={{textAlign:'left',padding:'6px'}}>สิทธิ์</th>
                  <th style={{padding:'6px'}}>👤 ผู้เยี่ยมชม</th>
                  <th style={{padding:'6px'}}>สมาชิกฟรี</th>
                  <th style={{padding:'6px'}}>💎 อุปถัมภ์</th>
                  <th style={{padding:'6px'}}>Admin</th>
                </tr></thead>
                <tbody>
                  {permRows.map((row, i) => (
                    <>
                      {(i === 0 || permRows[i-1].section !== row.section) && (
                        <tr key={row.section}><td colSpan={5} style={{padding:'10px 6px 4px',color:'var(--gold)',fontWeight:700,fontSize:'0.75rem'}}>▸ {row.section}</td></tr>
                      )}
                      <tr key={row.feature_key} style={{borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
                        <td style={{padding:'6px'}}>{row.label}</td>
                        {['guest','free','premium'].map(tk => (
                          <td key={tk} style={{textAlign:'center'}}>
                            <input type="checkbox" checked={!!row[tk]} onChange={() => togglePerm(row, tk)}
                              style={{width:'17px',height:'17px',accentColor:'var(--gold)',cursor:'pointer'}} />
                          </td>
                        ))}
                        <td style={{textAlign:'center'}}>
                          <input type="checkbox" checked disabled style={{width:'17px',height:'17px',accentColor:'var(--jade)'}} />
                        </td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {permRows.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>กด "โหลดตาราง" (ต้องรัน thma_permissions.sql ก่อน)</div>}
        </div>
      )}

      {tab === 'members' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.8rem'}}>
            <div style={{fontWeight:600}}>👥 สมาชิกทั้งหมด ({members.length})</div>
            <button className="btn btn-jade btn-sm" onClick={exportMembers}>📊 Export Excel</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><Th k="display_name">ชื่อ / อีเมล</Th><Th k="phone">ติดต่อ</Th><Th k="organization">สำนัก / จังหวัด</Th><Th k="points">ศักดินา</Th><Th k="joined">สมัคร · เข้าใช้ล่าสุด</Th><Th k="role">สถานะ</Th></tr></thead>
              <tbody>
                {sortedMembers.map(m => (
                  <tr key={m.id}>
                    <td style={{minWidth:'150px'}}>
                      <Link href={`/members/${m.id}`} style={{color:'var(--cream)'}}>{m.display_name ?? '—'}</Link>
                      <div style={{fontSize:'0.68rem',color:'var(--muted)',wordBreak:'break-all'}}>{m.email ?? '—'}</div>
                    </td>
                    <td style={{fontSize:'0.7rem',color:'var(--muted)'}}>{[m.phone, m.line_id && 'LINE ' + m.line_id].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{fontSize:'0.7rem',color:'var(--muted)'}}>{[m.organization, m.province].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{fontFamily:'monospace',color:'var(--jade)',whiteSpace:'nowrap'}}>{(m.points ?? 0).toLocaleString()}</td>
                    <td style={{fontSize:'0.68rem',whiteSpace:'nowrap'}}>
                      <div title={activity[m.id]?.joined_at ?? m.created_at ?? ''}>{fmtDT(activity[m.id]?.joined_at ?? m.created_at) || '—'}</div>
                      <div style={{color:'var(--muted)'}} title={fmtDT(activity[m.id]?.last_sign_in_at)}>{activity[m.id]?.last_sign_in_at ? 'ล่าสุด ' + ago(activity[m.id].last_sign_in_at) : ''}</div>
                    </td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <select className="filter-select" value={m.role ?? 'member'}
                        onChange={e => setMemberRole(m.id, e.target.value)}
                        disabled={m.role === 'admin' && !isRealAdmin}
                        title={m.role === 'admin' && !isRealAdmin ? 'บัญชีแอดมิน — แก้ได้เฉพาะแอดมินด้วยกัน' : ''}
                        style={{fontSize:'0.72rem',padding:'2px 6px'}}>
                        <option value="member">สมาชิก</option>
                        <option value="student">🎓 Student (ใช้กระดานโน้ตได้)</option>
                        <option value="superuser">👁 Super user (เห็นทุกอย่าง)</option>
                        <option value="moderator">🛡 Moderator</option>
                        {(isRealAdmin || m.role === 'admin') && <option value="admin">⭐ Admin</option>}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'nathab' && (
        <div>
          <div style={{fontSize:'0.78rem',color:'var(--muted)',marginBottom:'0.8rem'}}>
            แก้ไขหน้าทับได้โดยตรง — รูปแบบ: พยางค์กลองต่อตำแหน่ง คั่นห้องด้วย | (เช่น - - - เท่ง | - - - พรึม)
            พยางค์ที่รองรับ: เท่ง ทิง ติง พรึม ตุ๊บ ทั่ม ป๊ะ จ๊ะ โจ๊ะ
          </div>
          {nathabRows.map((row, i) => (
            <div className="card" key={row.id} style={{padding:'0.8rem'}}>
              <div style={{fontSize:'0.8rem',fontWeight:600,marginBottom:'0.4rem'}}>
                {row.nathab} · {row.level} · {row.instrument}
              </div>
              <textarea className="form-input" rows="2" value={row.pattern_text}
                onChange={e => setNathabRows(nathabRows.map((x,j) => j===i ? {...x, pattern_text: e.target.value} : x))}
                style={{fontFamily:'monospace',fontSize:'0.8rem',resize:'vertical'}} />
              <button className="btn btn-jade btn-sm" style={{marginTop:'0.4rem'}} onClick={() => saveNathab(row)}>💾 บันทึก</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'stats' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.3rem'}}>📈 สถิติการเข้าชมและการแชร์</div>
          <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:'0.8rem'}}>
            นับ 1 วิวต่อผู้ชม 1 คนต่อชิ้นงาน ทุก 6 ชั่วโมง · ยอดแชร์นับเมื่อกดปุ่มแชร์
            <button className="btn btn-outline btn-sm" style={{marginLeft:'8px'}} onClick={loadStats}>โหลดสถิติ</button>
          </div>
          {statSum.length > 0 && (
            <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'1rem'}}>
              {statSum.map(r => (
                <div key={r.target_type} className="card" style={{flex:'1 1 190px',margin:0,padding:'0.8rem'}}>
                  <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>
                    {r.target_type === 'song' ? '🎵 เพลง' : r.target_type === 'archive' ? '📜 เหตุการณ์' : r.target_type}</div>
                  <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--gold)'}}>
                    👁 {Number(r.total_views ?? 0).toLocaleString('th-TH')}</div>
                  <div style={{fontSize:'0.78rem',color:'var(--jade)'}}>
                    ↗ แชร์ {Number(r.total_shares ?? 0).toLocaleString('th-TH')} · {r.items} รายการ</div>
                </div>
              ))}
            </div>
          )}
          {['song','archive'].map(t => (statTop[t]?.length > 0 && (
            <div key={t} style={{marginBottom:'1rem'}}>
              <div style={{fontWeight:600,fontSize:'0.85rem',marginBottom:'0.4rem'}}>
                {t === 'song' ? '🎵 เพลงยอดนิยม 15 อันดับ' : '📜 เหตุการณ์ยอดนิยม 15 อันดับ'}</div>
              {statTop[t].map((r, i) => (
                <div key={r.target_id} style={{display:'flex',gap:'10px',fontSize:'0.8rem',
                  padding:'5px 0',borderBottom:'1px solid rgba(42,63,92,0.3)'}}>
                  <span style={{color:'var(--muted)',width:'22px'}}>{i+1}.</span>
                  <a href={`/${t === 'song' ? 'songs' : 'archive'}/${r.target_id}`}
                    style={{flex:1,color:'var(--gold2)',overflow:'hidden',textOverflow:'ellipsis'}}>{r.target_id}</a>
                  <span>👁 {r.views}</span><span style={{color:'var(--jade)'}}>↗ {r.shares}</span>
                </div>
              ))}
            </div>
          )))}
          {statSum.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>กด "โหลดสถิติ" (ต้องรัน thma_stats.sql ก่อน)</div>}
        </div>
      )}

      {tab === 'content' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.3rem'}}>🖼 เนื้อหาเว็บที่ถูกแก้ไข</div>
          <div style={{fontSize:'0.74rem',color:'var(--muted)',lineHeight:1.9,marginBottom:'0.8rem'}}>
            วิธีแก้ข้อความ/รูป: เข้าหน้านั้นๆ ขณะล็อกอินเป็น Admin แล้วกดปุ่ม ✏️ ข้างข้อความ หรือปุ่ม ＋ เพิ่มรูป บนกรอบรูป<br/>
            ตารางนี้แสดงรายการที่แก้ไปแล้ว กด "คืนค่าเดิม" เพื่อกลับไปใช้ข้อความต้นฉบับในโค้ด
            <button className="btn btn-outline btn-sm" style={{marginLeft:'8px'}} onClick={loadSC}>โหลดรายการ</button>
          </div>
          {scMsg && <div style={{fontSize:'0.8rem',color:'var(--jade)',marginBottom:'0.5rem'}}>{scMsg}</div>}
          {scRows.map(r => (
            <div key={r.key} style={{display:'flex',gap:'10px',alignItems:'flex-start',
              padding:'8px 0',borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'0.72rem',color:'var(--gold)'}}>{r.key}</div>
                <div style={{fontSize:'0.8rem',color:'var(--cream)',whiteSpace:'pre-wrap',
                  maxHeight:'60px',overflow:'hidden'}}>{r.text_value ?? (r.image_path ? '🖼 ' + r.image_path : '—')}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => clearSC(r.key)}
                style={{fontSize:'0.68rem'}}>↺ คืนค่าเดิม</button>
            </div>
          ))}
          {scRows.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>ยังไม่มีการแก้ไข (หรือกดโหลดรายการ)</div>}
        </div>
      )}

      {tab === 'perm' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.3rem'}}>🔐 ตารางสิทธิ์การมองเห็น</div>
          <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:'0.8rem'}}>
            ติ๊ก = เปิดให้เห็น/ใช้งาน · บันทึกและมีผลทันทีทั้งเว็บ · คอลัมน์ Admin ล็อกเปิดเสมอ
            {permRows.length === 0 && <button className="btn btn-outline btn-sm" style={{marginLeft:'8px'}} onClick={loadPerms}>โหลดตาราง</button>}
          </div>
          {permMsg && <div style={{fontSize:'0.78rem',color:'var(--jade)',marginBottom:'0.5rem'}}>{permMsg}</div>}
          {permRows.length > 0 && (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem'}}>
                <thead><tr style={{borderBottom:'2px solid var(--border)'}}>
                  <th style={{textAlign:'left',padding:'6px'}}>สิทธิ์</th>
                  <th style={{padding:'6px'}}>👤 ผู้เยี่ยมชม</th>
                  <th style={{padding:'6px'}}>สมาชิกฟรี</th>
                  <th style={{padding:'6px'}}>💎 อุปถัมภ์</th>
                  <th style={{padding:'6px'}}>Admin</th>
                </tr></thead>
                <tbody>
                  {permRows.map((row, i) => (
                    <>
                      {(i === 0 || permRows[i-1].section !== row.section) && (
                        <tr key={row.section}><td colSpan={5} style={{padding:'10px 6px 4px',color:'var(--gold)',fontWeight:700,fontSize:'0.75rem'}}>▸ {row.section}</td></tr>
                      )}
                      <tr key={row.feature_key} style={{borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
                        <td style={{padding:'6px'}}>{row.label}</td>
                        {['guest','free','premium'].map(tk => (
                          <td key={tk} style={{textAlign:'center'}}>
                            <input type="checkbox" checked={!!row[tk]} onChange={() => togglePerm(row, tk)}
                              style={{width:'17px',height:'17px',accentColor:'var(--gold)',cursor:'pointer'}} />
                          </td>
                        ))}
                        <td style={{textAlign:'center'}}>
                          <input type="checkbox" checked disabled style={{width:'17px',height:'17px',accentColor:'var(--jade)'}} />
                        </td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {permRows.length === 0 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>กด "โหลดตาราง" (ต้องรัน thma_permissions.sql ก่อน)</div>}
        </div>
      )}

      {tab === 'members' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.7rem'}}>👥 จัดการสมาชิก — ตั้ง Admin / สมาชิกอุปถัมภ์</div>
          <div style={{display:'flex',gap:'8px',marginBottom:'1rem'}}>
            <input className="form-input" placeholder="ค้นหาชื่อสมาชิก... (เว้นว่าง = 30 อันดับศักดินาสูงสุด)"
              value={memberQ} onChange={e => setMemberQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchMembers()} />
            <button className="btn btn-primary btn-sm" onClick={searchMembers}>ค้นหา</button>
          </div>
          {memberMsg && <div style={{fontSize:'0.8rem',color:'var(--jade)',marginBottom:'0.6rem'}}>{memberMsg}</div>}
          {memberList.map((m, i) => (
            <div key={m.id} style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',
              padding:'8px 0',borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
              <span style={{flex:1,minWidth:'160px',fontSize:'0.86rem'}}>
                {m.display_name ?? 'ไม่ระบุชื่อ'}
                <span style={{color:'var(--muted)',fontSize:'0.7rem'}}> · {m.province ?? '-'} · {m.points ?? 0} ศักดินา</span>
              </span>
              <select className="form-input" style={{width:'150px'}} value={m.role ?? 'member'}
                disabled={m.role === 'admin' && !isRealAdmin}
                onChange={e => setMemberList(memberList.map((x,j) => j===i ? {...x, role: e.target.value} : x))}>
                <option value="member">สมาชิก</option>
                <option value="student">🎓 Student</option>
                <option value="superuser">👁 Super user</option>
                <option value="moderator">🛡 Moderator</option>
                {(isRealAdmin || m.role === 'admin') && <option value="admin">⭐ Admin</option>}
              </select>
              <select className="form-input" style={{width:'150px'}} value={m.tier ?? 'free'}
                onChange={e => setMemberList(memberList.map((x,j) => j===i ? {...x, tier: e.target.value} : x))}>
                <option value="free">ฟรี</option>
                <option value="premium">💎 อุปถัมภ์</option>
              </select>
              <button className="btn btn-jade btn-sm" onClick={() => saveMember(m)}>💾</button>
            </div>
          ))}
          {memberList.length === 0 && <div style={{color:'var(--muted)',fontSize:'0.8rem'}}>กดค้นหาเพื่อแสดงรายชื่อ</div>}
          <div style={{fontSize:'0.68rem',color:'var(--muted)',marginTop:'0.8rem'}}>
            ⚠ Admin มีสิทธิ์เต็มทุกอย่าง โปรดตั้งเฉพาะคนที่ไว้ใจ · สมาชิกอุปถัมภ์ = พิมพ์/ดาวน์โหลดโน้ตและข้อมูลได้</div>
        </div>
      )}

      {tab === 'backup' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>💾 สำรองข้อมูลทั้งเว็บ</div>
          <div style={{fontSize:'0.8rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'1rem'}}>
            ดาวน์โหลดข้อมูลทุกตาราง (เพลง โน้ต จดหมายเหตุ วิดีโอ สมาชิก คอมเมนต์ หน้าทับ ฯลฯ)
            เป็น Excel ไฟล์เดียว — แนะนำสำรองสม่ำเสมอ เดือนละครั้งเป็นอย่างน้อย
            และเก็บไฟล์ไว้หลายที่ (คอมพิวเตอร์ + Google Drive)
          </div>
          <button className="btn btn-jade" onClick={backupAll}>📦 ดาวน์โหลดไฟล์สำรองทั้งหมด</button>
          {backupMsg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{backupMsg}</div>}
        </div>
      )}

      {tab === 'add' && (
        <div className="card" style={{borderColor:'rgba(201,168,76,0.3)'}}>
          <div style={{fontSize:'0.95rem',marginBottom:'1rem'}}>➕ เพิ่มวิดีโอเพลงโดยตรง (อนุมัติทันที)</div>
          <div className="form-group">
            <label className="form-label">เลือกเพลง</label>
            <select className="form-input" value={selSong} onChange={e => setSelSong(e.target.value)}>
              <option value="">— เลือกเพลง —</option>
              {songs.map(s => <option key={s.id} value={s.id}>{s.name_th} ({s.id})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">YouTube URL</label>
            <input className="form-input" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..." />
          </div>
          <div className="form-group">
            <label className="form-label">คำอธิบาย (ถ้ามี)</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <button className="btn btn-jade" onClick={addDirect}>✓ เพิ่มและอนุมัติทันที</button>
          {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}
        </div>
      )}
    </main>
  );
}
