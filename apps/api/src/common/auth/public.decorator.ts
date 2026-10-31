import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
/** Пометка публичного роута (витрина, OTP, гостевой заказ, вебхук). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
