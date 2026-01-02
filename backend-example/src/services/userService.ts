import {APIError} from "@terreno/api";
import {User} from "../models/user";
import type {UserDocument} from "../types";
import {logger} from "../utils/logger";

export const userService = {
	createUser: async (email: string, name: string): Promise<UserDocument> => {
		if (!email || !name) {
			throw new APIError({status: 400, title: "Email and name are required"});
		}

		const existingUser = await User.findByEmail(email);
		if (existingUser) {
			throw new APIError({status: 400, title: "User with this email already exists"});
		}

		logger.info("Creating new user", {email, name});

		const user = await User.create({
			email,
			name,
		});

		logger.info("User created successfully", {userId: user._id});
		return user;
	},

	getUserById: async (userId: string): Promise<UserDocument> => {
		const user = await User.findExactlyOne({_id: userId});
		return user;
	},
};
