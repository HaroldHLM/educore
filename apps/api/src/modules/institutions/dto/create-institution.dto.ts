import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Plan } from '@prisma/client';

export class CreateInstitutionAdminDto {
  @IsString()
  @Length(2, 80)
  firstName: string;

  @IsString()
  @Length(2, 80)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter and one number',
  })
  password: string;
}

export class CreateInstitutionDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsString()
  @Length(3, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase and may contain numbers and hyphens',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @Length(3, 120)
  domain?: string;

  @IsOptional()
  @IsUrl()
  logo?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @ValidateNested()
  @Type(() => CreateInstitutionAdminDto)
  admin: CreateInstitutionAdminDto;
}
