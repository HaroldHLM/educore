import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  teacherId?: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  credits: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  weight: number;
}
