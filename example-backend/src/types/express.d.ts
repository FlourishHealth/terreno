import type {UserDocument} from "./models/userTypes";

declare global {
  namespace Express {
    interface Request {
      user: UserDocument;
    }
  }
}
