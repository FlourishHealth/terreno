declare namespace Express {
  export interface Request {
    authTokenPayload?: {
      sid?: string;
      sessionId?: string;
      [key: string]: unknown;
    };
    requestId?: string;
    sessionId?: string;
    user?: {
      _id: string | ObjectId;
      id: string;
      admin: boolean;
      disabled?: boolean;
      type?: string;
      testUser?: boolean;
      email?: string;
      [key: string]: unknown;
    };
  }
}
