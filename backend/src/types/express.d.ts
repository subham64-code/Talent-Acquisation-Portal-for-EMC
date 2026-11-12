import type { SubjectType } from "../utils/jwt";

export interface AuthContext {
  subjectId: string;
  type: SubjectType;
  sessionId: string;
  userId?: string;
  candidateId?: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  departments: string[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
