import MyOrders from '../../components/MyOrders';
import { getDict } from '../../lib/i18n-server';

export function generateMetadata() {
  return { title: `${getDict().myOrders} — Kartop`, robots: { index: false } };
}

export default function OrdersPage() {
  return <MyOrders />;
}
