'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import SongTypeSelect from '../../components/SongTypeSelect';
import ProofBox from '../../components/ProofBox';
import { PROOF, proofProgress, proofLabel } from '../../lib/proof';
import { useLang } from '../../lib/i18n';
import { trText } from '../../lib/translate';

// รุ่นของหน้าฐานข้อมูลเพลง — ไว้ตรวจว่าไฟล์นี้ถูกอัพแล้ว
export const SONGDB_VERSION = '28 ส.ค. 69 · r3 (สองภาษา)';

const PAGE_SIZE = 25;


export default function SongDatabasePage() {
  const { t, lang } = useLang();
  const [songs, setSongs] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('');      // กรองตามประเภทเพลง (Pk 27 ส.ค. 69)
  const [fStyle, setFStyle] = useState('');   // กรองตามลักษณะการบรรเลง
  const [fProof, setFProof] = useState('');   // กรองตามสถานะตรวจทาน (Pk 27 ส.ค. 69)
  const [prog, setProg] = useState(null);     // ความคืบหน้าการตรวจทานทั้งคลัง
  const [names, setNames] = useState({});     // ชื่อผู้ดูแลที่ตรวจ
  const [loading, setLoading] = useState(true);
  const [videoCounts, setVideoCounts] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);

  // รับคำค้นจากช่องค้นหาด้านบน (/songs?q=…) — อ่านจาก URL ตรง ๆ
  // ไม่ใช้ useSearchParams เพราะ next build จะบังคับให้ห่อ Suspense ทั้งหน้า
  useEffect(() => {
    try {
      const s0 = new URLSearchParams(window.location.search).get('q');
      if (s0) setQ(s0);
    } catch (e) {}
  }, []);

  useEffect(() => { load(); }, [page, q, fType, fStyle, fProof]);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      setIsAdmin(p?.role === 'admin' || p?.role === 'moderator');
    });
  }, []);

  // ความคืบหน้าการตรวจทาน — โหลดเมื่อเป็นผู้ดูแล
  useEffect(() => { if (isAdmin) proofProgress().then(r => setProg(r.counts)); }, [isAdmin]);

  async function adminDeleteSong(s) {
    if (!confirm(`${t('del_ask')} "${s.name_th}" (${s.id})\n${t('del_warn')}`)) return;
    const { error } = await supabase.from('songs').delete().eq('id', s.id);
    if (error) { alert(t('del_fail') + ' ' + error.message); return; }
    load();
  }

  async function load() {
    setLoading(true);
    let query = supabase.from('songs').select('*', { count: 'exact' }).order('name_th');
    if (q) query = query.or(`name_th.ilike.%${q}%,id.ilike.%${q}%`);
    if (fType)  query = query.eq('type', fType);
    if (fStyle) query = query.eq('style', fStyle);
    if (fProof) query = fProof === 'none'
      ? query.or('proof_status.is.null,proof_status.eq.none')   // แถวเก่าที่ยังไม่มีค่า = ยังไม่ตรวจ
      : query.eq('proof_status', fProof);
    const { data, count: c } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setSongs(data ?? []);
    setCount(c ?? 0);
    setLoading(false);
    if (data?.length) {
      const ids = data.map(s => s.id);
      const { data: vids } = await supabase.from('song_videos')
        .select('song_id').in('song_id', ids).eq('approved', true);
      const vc = {};
      (vids ?? []).forEach(v => { vc[v.song_id] = (vc[v.song_id] ?? 0) + 1; });
      setVideoCounts(vc);
      // ชื่อผู้ดูแลที่ตรวจทาน — ให้คนถัดไปเห็นว่าใครตรวจไปแล้ว จะได้ไม่ตรวจซ้ำ
      const pu = [...new Set(data.map(s2 => s2.proof_by).filter(Boolean))];
      if (pu.length) {
        const { data: pn } = await supabase.from('profiles').select('id, display_name').in('id', pu);
        const nm = {}; (pn ?? []).forEach(x => { nm[x.id] = x.display_name; });
        setNames(n => ({ ...n, ...nm }));
      }
    }
  }

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <main className="container">
        <div className="section-title">{t('db_title')}</div>
        <div className="section-subtitle">{t('db_sub')} · {count} {t('unit_songs')}</div>
        <div className="search-bar">
          <input className="search-input" placeholder={t('db_search_ph')}
            value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
          {/* กรองตามบัญชีประเภทเพลง — รายการมาจากตาราง ไม่ใช่คำที่ฝังไว้ (Pk 27 ส.ค. 69) */}
          <SongTypeSelect kind="type" value={fType} className="filter-select" blankLabel={t('db_all_types')}
            onChange={v => { setFType(v ?? ''); setPage(0); }} />
          <SongTypeSelect kind="style" value={fStyle} className="filter-select" blankLabel={t('db_all_styles')}
            onChange={v => { setFStyle(v ?? ''); setPage(0); }} />
          {isAdmin && (
            <select className="filter-select" value={fProof} onChange={e => { setFProof(e.target.value); setPage(0); }}
              title={t('proof_filter')}>
              <option value="">{t('db_all_proof')}</option>
              {PROOF.map(p => <option key={p.v} value={p.v}>{p.icon} {proofLabel(p, lang)}</option>)}
            </select>
          )}
          {(fType || fStyle || fProof) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setFType(''); setFStyle(''); setFProof(''); setPage(0); }}>
              {t('db_clear')}</button>
          )}
        </div>
        {isAdmin && prog && (
          <div data-proofprog style={{display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'center',
            fontSize:'0.76rem',margin:'0.2rem 0 0.6rem'}}>
            <span style={{color:'var(--muted)'}}>{t('proof_head')}</span>
            {PROOF.map(p => (
              <button key={p.v} type="button" className="btn btn-outline btn-sm"
                onClick={() => { setFProof(fProof === p.v ? '' : p.v); setPage(0); }}
                style={{color:p.color,borderColor: fProof === p.v ? p.color : 'var(--border)',
                  padding:'3px 9px',minHeight:'28px',fontSize:'0.74rem'}}>
                {p.icon} {proofLabel(p, lang)} {prog[p.v] ?? 0}
              </button>
            ))}
            <span style={{color:'var(--jade)'}}>
              {t('proof_done')} {Math.round(((prog.ok ?? 0) / Math.max(1, prog.total ?? 1)) * 100)}%
              ({prog.ok ?? 0}/{prog.total ?? 0})
            </span>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('col_id')}</th><th>{t('col_name')}</th><th>{t('col_type')}</th><th>{t('col_style')}</th><th>{t('col_verses')}</th><th>{t('col_krasuan')}</th><th>{t('col_video')}</th>{isAdmin && <th>{t('col_proof')}</th>}{isAdmin && <th></th>}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 9 : 7} style={{textAlign:'center',color:'var(--muted)'}}>{t('loading')}</td></tr>
              ) : songs.map(s => (
                <tr key={s.id}>
                  <td className="song-id">{s.id}</td>
                  <td>
                    <Link href={`/songs/${s.id}`}><span className="song-name">{trText(lang, s, 'name_th')}</span></Link>
                    {/* เพลงย่อยที่แยกจากเพลงเรื่อง — บอกที่มาไว้ จะได้ไม่งงว่ามาจากไหน (Pk 27 ส.ค. 69) */}
                    {s.parent_song_id && <span style={{fontSize:'0.68rem',color:'var(--muted)',marginLeft:'6px'}}
                      title={t('part_of') + ' ' + s.parent_song_id}>🧩 {s.parent_song_id}</span>}
                    {/* ให้ผู้ใช้ทั่วไปเห็นด้วยว่าโน้ตเพลงนี้ผ่านการตรวจทานแล้ว */}
                    {s.proof_status === 'ok' && <span title={t('proof_badge')}
                      style={{fontSize:'0.68rem',color:'var(--jade)',marginLeft:'6px'}}>✅</span>}
                  </td>
                  <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{s.type || <span style={{color:'var(--border)'}}>—</span>}</td>
                  <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{s.style || <span style={{color:'var(--border)'}}>—</span>}</td>
                  <td style={{fontFamily:'monospace',color:'var(--jade)'}}>{s.total_verses}</td>
                  <td style={{fontFamily:'monospace',color:'var(--jade)'}}>{s.unique_patterns}</td>
                  <td>{videoCounts[s.id]
                    ? <span style={{color:'var(--jade)',fontSize:'0.78rem'}}>▶ {videoCounts[s.id]}</span>
                    : <span style={{color:'var(--border)'}}>—</span>}</td>
                  {isAdmin && <td>
                    <ProofBox song={s} names={names}
                      onChange={u => { setSongs(list => list.map(x => x.id === u.id ? u : x));
                                       proofProgress().then(r => setProg(r.counts)); }} />
                  </td>}
                  {isAdmin && <td>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => adminDeleteSong(s)}
                      title={t('del_song')}>🗑</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:'0.66rem',color:'var(--muted)',margin:'0.3rem 0'}} data-dbver>
          {t('db_ver')} {SONGDB_VERSION}
        </div>
        <div className="pagination">
          <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>
            {t('page_of')} {page + 1} / {totalPages || 1} · {t('page_total')} {count} {t('unit_songs')}
          </div>
          <div style={{display:'flex',gap:'4px'}}>
            <button className="page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t('page_prev')}</button>
            <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>{t('page_next')}</button>
          </div>
        </div>
    </main>
  );
}
