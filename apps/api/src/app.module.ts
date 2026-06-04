import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AttendancesModule } from './modules/attendances/attendances.module';
import { CoursesModule } from './modules/courses/courses.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { StudentsModule } from './modules/students/students.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TeachersModule } from './modules/teachers/teachers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    StudentsModule,
    CoursesModule,
    EnrollmentsModule,
    AttendancesModule,
    InstitutionsModule,
    TeachersModule,
    SubjectsModule,
    PeriodsModule,
  ],
})
export class AppModule {}
