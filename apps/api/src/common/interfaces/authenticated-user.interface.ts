import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  institutionId: string;
  institutionSlug: string;
  role: Role;
}
