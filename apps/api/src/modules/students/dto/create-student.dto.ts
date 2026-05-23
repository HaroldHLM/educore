import { Type } from 'class-transformer';
import { IsDate, IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateStudentDto {
  @IsOptional()
  @IsString()
  @Length(3, 30)
  code?: string;

  @IsString()
  @Length(2, 80)
  firstName: string;

  @IsString()
  @Length(2, 80)
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(6, 30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  dni?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthDate?: Date;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  parentName?: string;

  @IsOptional()
  @IsString()
  @Length(6, 30)
  parentPhone?: string;

  @IsOptional()
  @IsEmail()
  parentEmail?: string;
}
