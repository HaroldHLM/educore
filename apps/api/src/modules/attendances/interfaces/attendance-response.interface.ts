import { AttendanceStatus } from '@prisma/client';

export interface AttendanceStudentResponse {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
}

export interface AttendancePeriodResponse {
  id: string;
  name: string;
}

export interface AttendanceResponse {
  id: string;
  institutionId: string;
  date: Date;
  status: AttendanceStatus;
  note: string | null;
  createdAt: Date;
  student: AttendanceStudentResponse;
  period: AttendancePeriodResponse;
}

export interface PaginatedAttendancesResponse {
  data: AttendanceResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
