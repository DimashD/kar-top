import { OrderStatus } from '@prisma/client';

/** Машина состояний заказа (docs/03-architecture.md §5). Переходы идемпотентны на уровне сервиса. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['PLACED', 'CANCELLED'],
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PICKING', 'CANCELLED'],
  PICKING: ['AWAITING_CUSTOMER', 'READY', 'CANCELLED'],
  AWAITING_CUSTOMER: ['PICKING', 'READY', 'CANCELLED'],
  READY: ['COURIER_ASSIGNED', 'DELIVERING', 'CANCELLED'],
  COURIER_ASSIGNED: ['DELIVERING', 'CANCELLED'],
  DELIVERING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** ПДн клиента доступны магазину только начиная с ACCEPTED. */
const PII_VISIBLE_FROM: OrderStatus[] = [
  'ACCEPTED',
  'PICKING',
  'AWAITING_CUSTOMER',
  'READY',
  'COURIER_ASSIGNED',
  'DELIVERING',
  'DELIVERED',
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function piiVisibleToMerchant(status: OrderStatus): boolean {
  return PII_VISIBLE_FROM.includes(status);
}
