import { IsString, IsOptional, IsIn, Matches } from 'class-validator';

// Только казахстанские номера (+7 7xx...) — защита от SMS-pumping (docs/07 §2.3)
export class OtpRequestDto {
  @Matches(/^\+?7\s?7\d{2}.*$/) @IsString() phone!: string;
  @IsOptional() @IsIn(['telegram', 'sms', 'whatsapp']) channel?: 'telegram' | 'sms' | 'whatsapp';
}
export class OtpVerifyDto {
  @IsString() phone!: string;
  @IsString() code!: string;
}
