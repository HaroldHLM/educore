import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
