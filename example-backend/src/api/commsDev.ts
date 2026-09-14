import {APIError, modelRouter, Permissions, z} from "@terreno/api";
import {getCommsService, PushToken, type PushTokenDocument} from "@terreno/comms";
import type {Model} from "mongoose";

interface AuthenticatedUser {
  _id: unknown;
}

const getAuthenticatedUser = (user: unknown): AuthenticatedUser => {
  const authenticated = user as AuthenticatedUser | undefined;
  if (!authenticated?._id) {
    throw new APIError({status: 401, title: "Authentication required"});
  }
  return authenticated;
};

const testPushBodySchema = z
  .object({
    body: z.string().optional(),
    title: z.string().optional(),
  })
  .strict();

const disabledCrud = {
  create: [],
  delete: [],
  list: [],
  read: [],
  update: [],
};

/**
 * Dev-only test push. Mounted at `/comms/dev` so `testPush` stays `POST /comms/dev/testPush`.
 * Omitted in production.
 */
export const commsDevRouter =
  process.env.NODE_ENV === "production"
    ? undefined
    : modelRouter("/comms/dev", PushToken as Model<PushTokenDocument>, {
        collectionActions: {
          testPush: {
            body: testPushBodySchema,
            handler: async ({body, user}) => {
              const authenticated = getAuthenticatedUser(user);
              const payload = body as z.infer<typeof testPushBodySchema>;
              const results = await getCommsService().sendPushToUser({
                body: payload.body?.trim() ? payload.body : "Terreno test notification",
                title: payload.title?.trim() ? payload.title : "Test push",
                userId: String(authenticated._id),
              });
              return {
                accepted: results.filter((result) => result.accepted).length,
                results,
                tokenCount: results.length,
              };
            },
            method: "POST",
            permissions: [Permissions.IsAuthenticated],
            summary: "Send a development test push to the caller's registered devices",
            tag: "comms",
          },
        },
        permissions: disabledCrud,
      });
