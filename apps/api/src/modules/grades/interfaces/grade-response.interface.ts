export interface GradeStudentResponse {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
}

export interface GradeSubjectResponse {
  id: string;
  name: string;
}

export interface GradePeriodResponse {
  id: string;
  name: string;
}

export interface GradeResponse {
  id: string;
  institutionId: string;
  score: number;
  observation: string | null;
  gradedBy: string;
  gradedAt: Date;
  updatedAt: Date;
  student: GradeStudentResponse;
  subject: GradeSubjectResponse;
  period: GradePeriodResponse;
}

export interface PaginatedGradesResponse {
  data: GradeResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
