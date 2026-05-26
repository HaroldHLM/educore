export interface CourseResponse {
  id: string;
  institutionId: string;
  name: string | null;
  displayName: string;
  grade: string;
  section: string;
  year: number;
  createdAt: Date;
  totalStudents: number;
  totalSubjects: number;
}

export interface PaginatedCoursesResponse {
  data: CourseResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
