export interface TeacherCourseResponse {
  id: string;
  name: string;
  grade: string;
  section: string;
  year: number;
}

export interface TeacherResponse {
  id: string;
  institutionId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string | null;
  specialty: string | null;
  isActive: boolean;
  userIsActive: boolean;
  createdAt: Date;
  totalCourses: number;
  courses: TeacherCourseResponse[];
}

export interface PaginatedTeachersResponse {
  data: TeacherResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
