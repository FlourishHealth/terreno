import {UserDocument} from "../types";

declare global {
	namespace Express {
		interface Request {
			user: UserDocument;
		}
	}
}
