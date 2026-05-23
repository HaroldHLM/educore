export interface StudentResponse {
  id: string;
  institutionId: string;
  code: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  dni: string | null;
  email: string | null;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentEmail: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedStudentsResponse {
  data: StudentResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
