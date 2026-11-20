import { IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ApplicationDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @Matches(/^\d{12}$/, { message: 'ИИН/БИН — 12 цифр' }) bin!: string;
  @IsString() @MinLength(3) @MaxLength(200) legalName!: string;
  @IsString() @MinLength(5) @MaxLength(300) address!: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
}

export class StoreDocumentDto {
  @IsIn(['SIGN_PHOTO', 'INSIDE_PHOTO', 'CONTRACT', 'ID_CARD']) kind!: 'SIGN_PHOTO' | 'INSIDE_PHOTO' | 'CONTRACT' | 'ID_CARD';
  @IsString() @MinLength(10) data!: string;
  @IsIn(['image/jpeg', 'image/png', 'image/webp']) type!: string;
}

export class RejectDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
