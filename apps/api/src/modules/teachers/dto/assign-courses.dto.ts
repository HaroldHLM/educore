import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AssignCoursesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  courseIds: string[];
}
