'use client';
import { usePermissions, useMe } from './Gate';
import { useLang } from '../lib/i18n';

export default function FooterNav() {
  const { can } = usePermissions();
  const { isAdmin } = useMe();
  const { t } = useLang();
  const links = [
    can('page_krasuan') && ['/krasuan', t('f_krasuan')],
    can('page_nathab') && ['/nathab', t('f_nathab')],
    isAdmin && ['/convert', t('f_convert')],   // เฉพาะแอดมินก่อน
    can('page_people') && ['/people', t('f_people')],
    can('page_timeline') && ['/timeline', t('f_timeline')],
    can('page_compare') && ['/compare', t('f_compare')],
    can('page_search') && ['/search', t('f_search')],
    ['/about', t('f_about')],
    ['/premium', t('f_premium')],
    can('page_spec') && ['/spec', t('f_spec')],
    can('page_data') && ['/data', t('f_data')],
    can('page_glossary') && ['/glossary', t('f_glossary')],
    can('page_learn') && ['/learn', t('f_learn')],
  ].filter(Boolean);
  return (
    <div style={{display:'flex',gap:'1.2rem',justifyContent:'center',flexWrap:'wrap',marginBottom:'0.6rem',fontSize:'0.8rem'}}>
      {links.map(([href, label]) => <a key={href} href={href} style={{color:'var(--gold2)'}}>{label}</a>)}
    </div>
  );
}
