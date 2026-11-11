import Profile from '../../components/Profile';
import { getDict } from '../../lib/i18n-server';

export function generateMetadata() {
  return { title: `${getDict().navProfile} — Kartop`, robots: { index: false } };
}

export default function ProfilePage() {
  return <Profile />;
}
