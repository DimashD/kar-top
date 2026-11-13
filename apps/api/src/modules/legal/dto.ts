import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class AcceptDocsDto {
  @IsArray() @ArrayMinSize(1) @IsIn(['TERMS', 'PD_CONSENT'], { each: true }) docs!: ('TERMS' | 'PD_CONSENT')[];
}

export class AcceptOfferDto {
  @IsString() @MinLength(3) @MaxLength(200) legalName!: string;
  @Matches(/^\d{12}$/, { message: 'ИИН/БИН — 12 цифр' }) bin!: string;
  @IsString() @Length(6, 6) code!: string;
}

export class MarkOfferDto {
  @IsIn(['ECP', 'PAPER']) method!: 'ECP' | 'PAPER';
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @Matches(/^\d{12}$/, { message: 'ИИН/БИН — 12 цифр' }) bin?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
