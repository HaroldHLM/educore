export interface SubjectCourseResponse {
  id: string;
  displayName: string;
  grade: string;
  section: string;
  year: number;
}

export interface SubjectTeacherResponse {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  specialty: string | null;
}

export interface SubjectResponse {
  id: string;
  courseId: string;
  teacherId: string | null;
  name: string;
  credits: number;
  weight: number;
  isActive: boolean;
  totalGrades: number;
  course: SubjectCourseResponse;
  teacher: SubjectTeacherResponse | null;
}

export interface PaginatedSubjectsResponse {
  data: SubjectResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
