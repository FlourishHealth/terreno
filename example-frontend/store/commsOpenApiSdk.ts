import {emptySplitApi as api} from "@terreno/rtk";
export const addTagTypes = ["comms", "pushtokens", "admin"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      deleteCommsPushTokensById: build.mutation<
        DeleteCommsPushTokensByIdRes,
        DeleteCommsPushTokensByIdArgs
      >({
        invalidatesTags: ["comms"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/comms/pushTokens/${queryArg}`,
        }),
      }),
      getCommsMessages: build.query<GetCommsMessagesRes, GetCommsMessagesArgs>({
        providesTags: ["admin", "comms"],
        query: (queryArg) => ({
          params: {
            channel: queryArg.channel,
            endDate: queryArg.endDate,
            limit: queryArg.limit,
            page: queryArg.page,
            startDate: queryArg.startDate,
            status: queryArg.status,
            userId: queryArg.userId,
          },
          url: `/comms/messages`,
        }),
      }),
      getCommsPushTokens: build.query<GetCommsPushTokensRes, GetCommsPushTokensArgs>({
        providesTags: ["comms"],
        query: (queryArg) => ({
          params: {
            active: queryArg.active,
            limit: queryArg.limit,
            page: queryArg.page,
            platform: queryArg.platform,
          },
          url: `/comms/pushTokens`,
        }),
      }),
      getCommsPushTokensById: build.query<GetCommsPushTokensByIdRes, GetCommsPushTokensByIdArgs>({
        providesTags: ["pushtokens"],
        query: (queryArg) => ({url: `/comms/pushTokens/${queryArg}`}),
      }),
      postCommsPushTokens: build.mutation<PostCommsPushTokensRes, PostCommsPushTokensArgs>({
        invalidatesTags: ["comms"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/comms/pushTokens`,
        }),
      }),
    }),
    overrideExisting: false,
  });

export {injectedRtkApi as commsOpenapi};
export type PostCommsPushTokensRes =
  /** status 200 Success */
  | {
      data?: object;
    }
  | /** status 201 Success */ {
      data?: object;
    };
export type PostCommsPushTokensArgs = {
  deviceId?: string;
  /** Device platform: android, ios, or web */
  platform: string;
  token: string;
};
export type GetCommsPushTokensRes = /** status 200 Success */ {
  data?: object[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetCommsPushTokensArgs = {
  page?: number;
  limit?: number;
  active?: boolean;
  platform?: string;
};
export type DeleteCommsPushTokensByIdRes = /** status 204 Success */ {};
export type DeleteCommsPushTokensByIdArgs = string;
export type GetCommsPushTokensByIdRes = /** status 200 Successful read */ {
  /** Whether the device token is available for push delivery */
  active?: boolean;
  /** Application-provided identifier for the device */
  deviceId?: string;
  /** Most recent time the device token was registered */
  lastSeenAt: string;
  /** Platform associated with the device token */
  platform: "android" | "ios" | "web";
  /** Push provider token identifying the device */
  token: string;
  /** User who owns the device token */
  userId: unknown;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  ownerId?: any;
};
export type GetCommsPushTokensByIdArgs = string;
export type GetCommsMessagesRes = /** status 200 Success */ {
  data?: object[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetCommsMessagesArgs = {
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
};
export type ApiError = {
  /** An application-specific error code, expressed as a string value. */
  code?: string;
  /** A human-readable explanation specific to this occurrence of the problem. Like title, this field’s value can be localized. */
  detail?: string;
  /** A unique identifier for this particular occurrence of the problem. */
  id?: string;
  links?: {
    /** A link that leads to further details about this particular occurrence of the problem. When derefenced, this URI SHOULD return a human-readable description of the error. */
    about?: string;
    /** A link that identifies the type of error that this particular error is an instance of. This URI SHOULD be dereferencable to a human-readable explanation of the general error. */
    type?: string;
  };
  /** A meta object containing non-standard meta-information about the error. */
  meta?: object;
  source?: {
    /** A string indicating the name of a single request header which caused the error. */
    header?: string;
    /** A string indicating which URI query parameter caused the error. */
    parameter?: string;
    /** A JSON Pointer [RFC6901] to the associated entity in the request document [e.g. "/data" for a primary data object, or "/data/attributes/title" for a specific attribute]. */
    pointer?: string;
  };
  /** The HTTP status code applicable to this problem, expressed as a string value. */
  status?: number;
  /** The error message */
  title?: string;
};
export const {
  usePostCommsPushTokensMutation,
  useGetCommsPushTokensQuery,
  useDeleteCommsPushTokensByIdMutation,
  useGetCommsPushTokensByIdQuery,
  useGetCommsMessagesQuery,
} = injectedRtkApi;
