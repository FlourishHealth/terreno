import type {Request, Response} from "express";
import {APIError} from "@terreno/api";
import {User} from "../models/user";

export const GET = async (_req: Request, res: Response): Promise<void> => {
	// Fetch one user to ensure database connectivity
	const users = await User.find({}).limit(1);

	if (users.length === 0) {
		throw new APIError({status: 503, title: "No users found in database"});
	}

	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		userCount: users.length,
	});
};
