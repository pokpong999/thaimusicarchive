'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const DICT = {
  th: {
    nav_songs: 'จดหมายเหตุเพลงไทย', nav_archive: 'จดหมายเหตุดนตรีไทย', nav_board: 'ทำเนียบ',
    nav_add: '➕ เพิ่มเพลง', nav_mine: 'ของฉัน', nav_login: 'เข้าสู่ระบบ', nav_logout: 'ออกจากระบบ',
    home_title: 'รายการเพลงทั้งหมด', home_sub: 'ฐานข้อมูลเพลงไทย',
    st_songs: 'เพลง', st_verses: 'วรรคกระสวน', st_patterns: 'แบบกระสวน', st_records: 'เหตุการณ์', st_members: 'สมาชิก',
    f_krasuan: 'ค้นกระสวน', f_people: 'ครูดนตรี', f_timeline: 'เส้นเวลา', f_compare: 'เปรียบเทียบเพลง',
    f_search: 'ค้นหา', f_about: 'เกี่ยวกับโครงการ', f_spec: 'มาตรฐาน Krasuan Code', f_data: 'ข้อมูลเปิด/API',
    f_glossary: 'อภิธานศัพท์', f_learn: 'เรียนรู้',
  },
  en: {
    nav_songs: 'Song Archive', nav_archive: 'Music Archive', nav_board: 'Contributors',
    nav_add: '➕ Add Song', nav_mine: 'My Page', nav_login: 'Sign in', nav_logout: 'Sign out',
    home_title: 'All Songs', home_sub: 'Thai Classical Music Database',
    st_songs: 'songs', st_verses: 'verses', st_patterns: 'patterns', st_records: 'events', st_members: 'members',
    f_krasuan: 'Krasuan Search', f_people: 'Musicians', f_timeline: 'Timeline', f_compare: 'Compare',
    f_search: 'Search', f_about: 'About', f_spec: 'Krasuan Code Standard', f_data: 'Open Data / API',
    f_glossary: 'Glossary', f_learn: 'Learn',
  },
};

const LangCtx = createContext({ lang: 'th', setLang: () => {}, t: k => k });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('th');
  useEffect(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('thma_lang');
    if (saved) setLangState(saved);
  }, []);
  const setLang = l => { setLangState(l); localStorage.setItem('thma_lang', l); };
  const t = k => DICT[lang]?.[k] ?? DICT.th[k] ?? k;
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}
export const useLang = () => useContext(LangCtx);
