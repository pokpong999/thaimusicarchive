'use client';
// components/NotationInput.js — กระดานโน้ตไทย (React wrapper ของ lib/notation-engine.js)
//
// <NotationInput
//    initialVerses={verses}        // จาก rowsToVerses(rows) หรือ textToVerses(text) · ไม่ใส่ = กระดานว่าง
//    initialText={text}            // ทางเลือก: ข้อความโน้ตแบบเก่า
//    options={{ base: 4, lineHong: 8, twoHands: false, level: 'สองชั้น', ensemble: 'sai' }}
//    onChange={({ verses, base, lineHong, twoHands, ensemble, level }) => …}
// />
//
// ref (useRef) ใช้เรียก getVerses() / getState() / toText() / loadText(text) ได้โดยตรง
import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { NotationEngine } from '../lib/notation-engine';
import { textToVerses } from '../lib/notation-core';

const NotationInput = forwardRef(function NotationInput({ initialVerses, initialText, options = {}, onChange }, ref) {
  const rootRef = useRef(null);
  const engRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!rootRef.current) return;
    const verses = initialVerses && initialVerses.length ? initialVerses
      : initialText ? textToVerses(initialText, { base: options.base || 4 }) : null;
    const eng = new NotationEngine(rootRef.current, {
      ...options, verses,
      onChange: d => onChangeRef.current && onChangeRef.current(d),
    });
    engRef.current = eng;
    return () => { eng.destroy(); engRef.current = null; };
    // สร้างครั้งเดียวตอน mount — ข้อมูลเริ่มต้นเปลี่ยนทีหลังให้ใช้ ref.loadVerses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getVerses: () => engRef.current ? engRef.current.getVerses() : [],
    getState:  () => engRef.current ? engRef.current.getState() : {},
    toText:    () => engRef.current ? engRef.current.toText() : '',
    loadText:  t  => engRef.current ? engRef.current.loadText(t) : 0,
    loadVerses: v => { if (engRef.current) { engRef.current.setVerses(v); engRef.current.emit(); } },
    stop:      () => engRef.current && engRef.current.stopPlay(),
  }), []);

  return <div ref={rootRef} />;
});

export default NotationInput;
