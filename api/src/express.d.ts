declare namespace Express {
  export interface Request {
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
