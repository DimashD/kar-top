// Клиентский помощник для веб-админки платформы.
// Токен сотрудника хранится в localStorage; эндпоинты под AdminGuard требуют Bearer.
import { CLIENT_API } from './api';

const TOKEN_KEY = 'kartop_admin_token';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setAdminToken(t: string) {
  try { window.localStorage.setItem(TOKEN_KEY, t); } catch { /* приватный режим */ }
}
export function clearAdminToken() {
  try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export class UnauthorizedError extends Error {}

/** Запрос к API от имени сотрудника. Бросает UnauthorizedError на 401/403. */
export async function adminFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const r = await fetch(`${CLIENT_API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (r.status === 401 || r.status === 403) throw new UnauthorizedError('Нет доступа');
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = Array.isArray((data as any).message) ? (data as any).message[0] : ((data as any).message || `Ошибка ${r.status}`);
    throw new Error(msg);
  }
  return data as T;
}

// --- Auth (вход сотрудника по паролю, без OTP) ---
export async function staffLogin(phone: string, password: string): Promise<string> {
  const r = await fetch(`${CLIENT_API}/auth/staff/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : (data.message || 'Неверный телефон или пароль'));
  const token = data.accessToken as string | undefined;
  if (!token) throw new Error('Не получен токен');
  return token;
}

// --- Заявки «Стать партнёром» ---
export type PartnerLeadStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'REJECTED';
export interface PartnerLead {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  twogisUrl: string | null;
  source: string;
  status: PartnerLeadStatus;
  note: string | null;
  createdAt: string;
}

export function listLeads(status?: string): Promise<PartnerLead[]> {
  const q = status && status !== 'ALL' ? `?status=${status}` : '';
  return adminFetch<PartnerLead[]>(`/partners${q}`);
}
export function setLeadStatus(id: string, status: PartnerLeadStatus, note?: string): Promise<PartnerLead> {
  return adminFetch<PartnerLead>(`/partners/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(note !== undefined ? { note } : {}) }),
  });
}

// --- Сотрудники платформы (доступ только у PLATFORM_ADMIN) ---
export type StaffRole = 'PLATFORM_ADMIN' | 'SUPPORT';
export interface Staff {
  id: string;
  name: string | null;
  phone: string;
  platformRole: StaffRole;
  createdAt: string;
}

export function listStaff(): Promise<Staff[]> {
  return adminFetch<Staff[]>('/admin/staff');
}
export function createStaff(name: string, phone: string, password: string, role: StaffRole): Promise<Staff> {
  return adminFetch<Staff>('/admin/staff', {
    method: 'POST',
    body: JSON.stringify({ name, phone, password, role }),
  });
}
export function setStaffRole(id: string, role: StaffRole | 'NONE'): Promise<Staff> {
  return adminFetch<Staff>(`/admin/staff/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}
export function setStaffPassword(id: string, password: string): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(`/admin/staff/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  });
}

// --- Магазины (invite-only: заводит платформа) ---
export type StoreStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
export interface AdminStore {
  id: string; slug: string; name: string; status: StoreStatus;
  phone: string | null; address: string | null; deliveryMode: string;
  createdAt: string; productCount: number; orderCount: number;
  owner: { phone: string; name: string | null } | null;
}

export function listStores(status?: string): Promise<AdminStore[]> {
  const q = status && status !== 'ALL' ? `?status=${status}` : '';
  return adminFetch<AdminStore[]>(`/admin/stores${q}`);
}
export function createStore(input: { name: string; ownerPhone: string; city?: string; address?: string; kaspiPhone?: string }) {
  return adminFetch('/admin/stores', { method: 'POST', body: JSON.stringify(input) });
}
export function storeAction(id: string, action: 'approve' | 'suspend' | 'block') {
  return adminFetch(`/admin/stores/${id}/${action}`, { method: 'POST' });
}

// --- Аналитика ---
export interface StoreStat {
  storeId: string; name: string | null; slug: string | null; status: string | null;
  rating: number | null; ordersCount: number; gmvTiyn: number; avgCheckTiyn: number; lastOrderAt: string | null;
}
export interface CustomerRow {
  customerId: string; name: string | null; phone: string | null;
  ordersCount: number; spentTiyn: number; lastOrderAt: string | null; firstSeenAt: string | null;
}
export interface CustomersResult { totals: { customers: number; gmvTiyn: number; orders: number }; rows: CustomerRow[] }

export function analyticsStores(): Promise<{ rows: StoreStat[] }> {
  return adminFetch<{ rows: StoreStat[] }>('/admin/analytics/stores');
}
export function analyticsCustomers(sort: 'spend' | 'orders' | 'recent' = 'spend'): Promise<CustomersResult> {
  return adminFetch<CustomersResult>(`/admin/customers?sort=${sort}`);
}

/** Скачать CSV с авторизацией (обычная ссылка не передаёт токен). */
export async function downloadCsv(path: string, filename: string): Promise<void> {
  const token = getAdminToken();
  const r = await fetch(`${CLIENT_API}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error('Не удалось выгрузить');
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
