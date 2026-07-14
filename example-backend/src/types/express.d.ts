import type {UserDocument} from "./types/models/userTypes";

declare global {
  namespace Express {
    interface Request {
      user: UserDocument;
    }
  }
}
