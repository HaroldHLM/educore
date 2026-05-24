import { Plan, Role } from '@prisma/client';

export interface InstitutionAdminResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface InstitutionResponse {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  primaryColor: string | null;
  domain: string | null;
  plan: Plan;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  admin?: InstitutionAdminResponse;
}

export interface PaginatedInstitutionsResponse {
  data: InstitutionResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
