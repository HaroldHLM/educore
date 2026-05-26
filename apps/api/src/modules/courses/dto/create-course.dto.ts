import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateCourseDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  grade: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  section: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
}
