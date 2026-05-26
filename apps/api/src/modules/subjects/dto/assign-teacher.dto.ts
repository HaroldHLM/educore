import { IsOptional, IsString } from 'class-validator';

export class AssignTeacherDto {
  @IsOptional()
  @IsString()
  teacherId: string | null;
}
