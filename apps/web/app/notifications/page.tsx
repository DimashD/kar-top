import Notifications from '../../components/Notifications';
import { getDict } from '../../lib/i18n-server';

export function generateMetadata() {
  return { title: `${getDict().navNotifications} — Kartop`, robots: { index: false } };
}

export default function NotificationsPage() {
  return <Notifications />;
}
