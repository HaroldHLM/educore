export interface PeriodResponse {
  id: string;
  institutionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  totalGrades: number;
  totalAttendances: number;
}

export interface PaginatedPeriodsResponse {
  data: PeriodResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
