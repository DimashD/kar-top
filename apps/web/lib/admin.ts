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

// --- Auth (OTP вход сотрудника) ---
export async function requestAdminOtp(phone: string): Promise<void> {
  const r = await fetch(`${CLIENT_API}/auth/otp/request`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!r.ok) throw new Error('Не удалось отправить код');
}
export async function verifyAdminOtp(phone: string, code: string): Promise<string> {
  const r = await fetch(`${CLIENT_API}/auth/otp/verify`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : (data.message || 'Неверный код'));
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
