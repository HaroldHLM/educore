import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateTeacherDto {
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

  @IsOptional()
  @IsString()
  @Length(2, 120)
  specialty?: string;

  @IsOptional()
  @IsUrl()
  avatar?: string;
}
