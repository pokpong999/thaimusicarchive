// app/krasuan/page.js — หน้าคลังกระสวนส่วนตัว
import KrasuanClient from '../../components/KrasuanClient';

export const metadata = {
  title: 'คลังกระสวน',
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <KrasuanClient />;
}
