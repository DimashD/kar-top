import { redirect } from 'next/navigation';

// /admin — вход в админку: открываем первый раздел (там окно входа, если не авторизован).
export default function AdminIndex() {
  redirect('/admin/stores');
}
