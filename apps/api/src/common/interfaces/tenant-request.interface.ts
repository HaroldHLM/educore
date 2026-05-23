import { Institution } from '@prisma/client';
import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user.interface';

export interface TenantRequest extends Request {
  user?: AuthenticatedUser;
  institution?: Institution;
}
