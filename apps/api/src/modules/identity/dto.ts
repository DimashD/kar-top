import { IsString, IsOptional, IsIn, Matches, Length } from 'class-validator';

// Только казахстанские номера (+7 7xx...) — защита от SMS-pumping (docs/07 §2.3)
export class OtpRequestDto {
  @Matches(/^\+?7\s?7\d{2}[\s\d]*$/) @IsString() phone!: string;
  @IsOptional() @IsIn(['telegram', 'whatsapp', 'sms']) channel?: 'telegram' | 'whatsapp' | 'sms';
}

export class OtpVerifyDto {
  @IsString() phone!: string;
  @IsString() @Length(6, 6) code!: string;
  @IsOptional() @IsString() deviceLabel?: string;
}
