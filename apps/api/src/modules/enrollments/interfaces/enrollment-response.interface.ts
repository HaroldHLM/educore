export interface EnrollmentStudentResponse {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
}

export interface EnrollmentCourseResponse {
  id: string;
  grade: string;
  section: string;
  year: number;
  displayName: string;
}

export interface EnrollmentResponse {
  id: string;
  institutionId: string;
  isActive: boolean;
  enrolledAt: Date;
  withdrawnAt: Date | null;
  student: EnrollmentStudentResponse;
  course: EnrollmentCourseResponse;
}

export interface PaginatedEnrollmentsResponse {
  data: EnrollmentResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
