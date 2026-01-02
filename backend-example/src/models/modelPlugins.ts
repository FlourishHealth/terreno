import {
	APIError,
	createdUpdatedPlugin,
	findExactlyOne,
	findOneOrNone,
	isDeletedPlugin,
} from "@terreno/api";
import type mongoose from "mongoose";
import type {Document, Model, Query, Schema} from "mongoose";

// biome-ignore lint/suspicious/noExplicitAny: Leaving as open as possible.
export function upsertPlugin<T extends Document>(schema: Schema<T, any, any, any>): void {
	schema.statics.upsert = async function (
		this: Model<T>,
		// biome-ignore lint/suspicious/noExplicitAny: Leaving as open as possible.
		conditions: Record<string, any>,
		// biome-ignore lint/suspicious/noExplicitAny: Leaving as open as possible.
		update: Record<string, any>
	): Promise<T> {
		// Try to find the document with the given conditions.
		const docs = await this.find(conditions);
		if (docs.length > 1) {
			throw new APIError({
				detail: `query: ${JSON.stringify(conditions)}`,
				status: 500,
				title: `${this.modelName}.upsert find query returned multiple documents`,
			});
		}
		const doc = docs[0];

		if (doc) {
			// If the document exists, update it with the provided update values.
			Object.assign(doc, update);
			return doc.save();
		} else {
			// If the document doesn't exist, create a new one with the combined conditions and update
			// values.
			const combinedData = {...conditions, ...update};
			const newDoc = new this(combinedData);
			return newDoc.save();
		}
	};
}

// This plugin modifies the find query to exclude archived documents by default.
export function excludeArchivedPlugin<T>(schema: Schema<T>): void {
	// biome-ignore lint/suspicious/noExplicitAny: Leaving as open as possible.
	schema.pre<Query<any, any>>("find", function (next) {
		const conditions = this.getFilter();

		// Check if the query explicitly requests archived documents
		if (conditions.archived !== true) {
			// If not, modify the query to exclude archived documents by default
			const newConditions = {...conditions, archived: {$ne: true}};
			this.setQuery(newConditions);
		}

		next();
	});
}

// biome-ignore lint/suspicious/noExplicitAny: Leaving as open as possible.
export function addDefaultPlugins(schema: mongoose.Schema<any, any, any, any>): void {
	schema.plugin(createdUpdatedPlugin);
	schema.plugin(isDeletedPlugin);
	schema.plugin(findOneOrNone);
	schema.plugin(findExactlyOne);
	schema.plugin(upsertPlugin);
}
