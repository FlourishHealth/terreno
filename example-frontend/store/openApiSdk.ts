// biome-ignore-all lint/suspicious/noExplicitAny: types are generated from backend OpenAPI schemas
import {emptySplitApi as api} from "./betterAuthApi";
export const addTagTypes = [
  "ai",
  "observability",
  "gpthistories",
  "gpt",
  "admin-users",
  "settings",
  "loadtest",
  "comms",
  "todos",
  "exampleprojects",
  "users",
  "admin",
  "featureflags",
  "adminauditlogs",
  "consentforms",
  "consentresponses",
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      deleteAdminConsentFormsById: build.mutation<
        DeleteAdminConsentFormsByIdRes,
        DeleteAdminConsentFormsByIdArgs
      >({
        invalidatesTags: ["consentforms"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/admin/consent-forms/${queryArg}`,
        }),
      }),
      deleteAdminFeatureFlagsById: build.mutation<
        DeleteAdminFeatureFlagsByIdRes,
        DeleteAdminFeatureFlagsByIdArgs
      >({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/admin/feature-flags/${queryArg}`,
        }),
      }),
      deleteAdminUsersById: build.mutation<DeleteAdminUsersByIdRes, DeleteAdminUsersByIdArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/admin/users/${queryArg}`,
        }),
      }),
      deleteAiObservabilityEvaluatorsById: build.mutation<
        DeleteAiObservabilityEvaluatorsByIdRes,
        DeleteAiObservabilityEvaluatorsByIdArgs
      >({
        invalidatesTags: ["observability"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/ai/observability/evaluators/${queryArg}`,
        }),
      }),
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
      deleteFeatureFlagsFlagsById: build.mutation<
        DeleteFeatureFlagsFlagsByIdRes,
        DeleteFeatureFlagsFlagsByIdArgs
      >({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/feature-flags/flags/${queryArg}`,
        }),
      }),
      deleteGptHistoriesById: build.mutation<DeleteGptHistoriesByIdRes, DeleteGptHistoriesByIdArgs>(
        {
          invalidatesTags: ["gpthistories"],
          query: (queryArg) => ({
            method: "DELETE",
            url: `/gpt/histories/${queryArg}`,
          }),
        }
      ),
      deleteProjectsById: build.mutation<DeleteProjectsByIdRes, DeleteProjectsByIdArgs>({
        invalidatesTags: ["exampleprojects"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/projects/${queryArg}`,
        }),
      }),
      deleteSettingsGcs: build.mutation<DeleteSettingsGcsRes, DeleteSettingsGcsArgs>({
        invalidatesTags: ["settings"],
        query: () => ({method: "DELETE", url: `/settings/gcs`}),
      }),
      deleteTodosById: build.mutation<DeleteTodosByIdRes, DeleteTodosByIdArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({method: "DELETE", url: `/todos/${queryArg}`}),
      }),
      deleteUsersById: build.mutation<DeleteUsersByIdRes, DeleteUsersByIdArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({method: "DELETE", url: `/users/${queryArg}`}),
      }),
      getAdminAuditLogs: build.query<GetAdminAuditLogsRes, GetAdminAuditLogsArgs>({
        providesTags: ["adminauditlogs"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            actorId: queryArg.actorId,
            createdAt: queryArg.createdAt,
            limit: queryArg.limit,
            modelName: queryArg.modelName,
            page: queryArg.page,
            q: queryArg.q,
            recordId: queryArg.recordId,
            recordLabel: queryArg.recordLabel,
            sort: queryArg.sort,
            verb: queryArg.verb,
          },
          url: `/admin/audit-logs/`,
        }),
      }),
      getAdminAuditLogsById: build.query<GetAdminAuditLogsByIdRes, GetAdminAuditLogsByIdArgs>({
        providesTags: ["adminauditlogs"],
        query: (queryArg) => ({url: `/admin/audit-logs/${queryArg}`}),
      }),
      getAdminConfig: build.query<GetAdminConfigRes, GetAdminConfigArgs>({
        providesTags: ["admin"],
        query: () => ({url: `/admin/config`}),
      }),
      getAdminConsentForms: build.query<GetAdminConsentFormsRes, GetAdminConsentFormsArgs>({
        providesTags: ["consentforms"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            active: queryArg.active,
            limit: queryArg.limit,
            order: queryArg.order,
            page: queryArg.page,
            q: queryArg.q,
            slug: queryArg.slug,
            sort: queryArg.sort,
            title: queryArg.title,
            type: queryArg.type,
            version: queryArg.version,
          },
          url: `/admin/consent-forms/`,
        }),
      }),
      getAdminConsentFormsById: build.query<
        GetAdminConsentFormsByIdRes,
        GetAdminConsentFormsByIdArgs
      >({
        providesTags: ["consentforms"],
        query: (queryArg) => ({url: `/admin/consent-forms/${queryArg}`}),
      }),
      getAdminConsentResponses: build.query<
        GetAdminConsentResponsesRes,
        GetAdminConsentResponsesArgs
      >({
        providesTags: ["consentresponses"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            agreed: queryArg.agreed,
            agreedAt: queryArg.agreedAt,
            limit: queryArg.limit,
            locale: queryArg.locale,
            page: queryArg.page,
            q: queryArg.q,
            sort: queryArg.sort,
            userId: queryArg.userId,
          },
          url: `/admin/consent-responses/`,
        }),
      }),
      getAdminConsentResponsesById: build.query<
        GetAdminConsentResponsesByIdRes,
        GetAdminConsentResponsesByIdArgs
      >({
        providesTags: ["consentresponses"],
        query: (queryArg) => ({url: `/admin/consent-responses/${queryArg}`}),
      }),
      getAdminFeatureFlags: build.query<GetAdminFeatureFlagsRes, GetAdminFeatureFlagsArgs>({
        providesTags: ["featureflags"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            archived: queryArg.archived,
            created: queryArg.created,
            defaultVariant: queryArg.defaultVariant,
            enabled: queryArg.enabled,
            key: queryArg.key,
            limit: queryArg.limit,
            name: queryArg.name,
            page: queryArg.page,
            q: queryArg.q,
            sort: queryArg.sort,
            type: queryArg.type,
          },
          url: `/admin/feature-flags/`,
        }),
      }),
      getAdminFeatureFlagsById: build.query<
        GetAdminFeatureFlagsByIdRes,
        GetAdminFeatureFlagsByIdArgs
      >({
        providesTags: ["featureflags"],
        query: (queryArg) => ({url: `/admin/feature-flags/${queryArg}`}),
      }),
      getAdminTodos: build.query<GetAdminTodosRes, GetAdminTodosArgs>({
        providesTags: ["todos"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            completed: queryArg.completed,
            created: queryArg.created,
            created_gte: queryArg.createdGte,
            created_lte: queryArg.createdLte,
            limit: queryArg.limit,
            ownerId: queryArg.ownerId,
            page: queryArg.page,
            priority: queryArg.priority,
            q: queryArg.q,
            sort: queryArg.sort,
            tags: queryArg.tags,
            title: queryArg.title,
          },
          url: `/admin/todos/`,
        }),
      }),
      getAdminTodosById: build.query<GetAdminTodosByIdRes, GetAdminTodosByIdArgs>({
        providesTags: ["todos"],
        query: (queryArg) => ({url: `/admin/todos/${queryArg}`}),
      }),
      getAdminUsers: build.query<GetAdminUsersRes, GetAdminUsersArgs>({
        providesTags: ["users"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            admin: queryArg.admin,
            created: queryArg.created,
            email: queryArg.email,
            limit: queryArg.limit,
            name: queryArg.name,
            page: queryArg.page,
            q: queryArg.q,
            sort: queryArg.sort,
          },
          url: `/admin/users/`,
        }),
      }),
      getAdminUsersById: build.query<GetAdminUsersByIdRes, GetAdminUsersByIdArgs>({
        providesTags: ["users"],
        query: (queryArg) => ({url: `/admin/users/${queryArg}`}),
      }),
      getAiModels: build.query<GetAiModelsRes, GetAiModelsArgs>({
        providesTags: ["ai"],
        query: () => ({url: `/ai/models`}),
      }),
      getAiObservabilityEvaluators: build.query<
        GetAiObservabilityEvaluatorsRes,
        GetAiObservabilityEvaluatorsArgs
      >({
        providesTags: ["observability"],
        query: () => ({url: `/ai/observability/evaluators`}),
      }),
      getAiObservabilityEvaluatorsById: build.query<
        GetAiObservabilityEvaluatorsByIdRes,
        GetAiObservabilityEvaluatorsByIdArgs
      >({
        providesTags: ["observability"],
        query: (queryArg) => ({
          url: `/ai/observability/evaluators/${queryArg}`,
        }),
      }),
      getAiObservabilityEvaluatorsTemplates: build.query<
        GetAiObservabilityEvaluatorsTemplatesRes,
        GetAiObservabilityEvaluatorsTemplatesArgs
      >({
        providesTags: ["observability"],
        query: () => ({url: `/ai/observability/evaluators/templates`}),
      }),
      getAiObservabilityPrompts: build.query<
        GetAiObservabilityPromptsRes,
        GetAiObservabilityPromptsArgs
      >({
        providesTags: ["observability"],
        query: (queryArg) => ({
          params: {
            folder: queryArg.folder,
            include: queryArg.include,
            search: queryArg.search,
          },
          url: `/ai/observability/prompts`,
        }),
      }),
      getAiObservabilityPromptsByName: build.query<
        GetAiObservabilityPromptsByNameRes,
        GetAiObservabilityPromptsByNameArgs
      >({
        providesTags: ["observability"],
        query: (queryArg) => ({url: `/ai/observability/prompts/${queryArg}`}),
      }),
      getAiObservabilityReview: build.query<
        GetAiObservabilityReviewRes,
        GetAiObservabilityReviewArgs
      >({
        providesTags: ["observability"],
        query: () => ({url: `/ai/observability/review`}),
      }),
      getAiObservabilityReviewById: build.query<
        GetAiObservabilityReviewByIdRes,
        GetAiObservabilityReviewByIdArgs
      >({
        providesTags: ["observability"],
        query: (queryArg) => ({url: `/ai/observability/review/${queryArg}`}),
      }),
      getAiObservabilityStatus: build.query<
        GetAiObservabilityStatusRes,
        GetAiObservabilityStatusArgs
      >({
        providesTags: ["observability"],
        query: () => ({url: `/ai/observability/status`}),
      }),
      getAiObservabilityTraces: build.query<
        GetAiObservabilityTracesRes,
        GetAiObservabilityTracesArgs
      >({
        providesTags: ["observability"],
        query: () => ({url: `/ai/observability/traces`}),
      }),
      getAiObservabilityTracesById: build.query<
        GetAiObservabilityTracesByIdRes,
        GetAiObservabilityTracesByIdArgs
      >({
        providesTags: ["observability"],
        query: (queryArg) => ({url: `/ai/observability/traces/${queryArg}`}),
      }),
      getCommsMessages: build.query<GetCommsMessagesRes, GetCommsMessagesArgs>({
        providesTags: ["admin", "comms"],
        query: (queryArg) => ({
          params: {
            channel: queryArg.channel,
            endDate: queryArg.endDate,
            errorClass: queryArg.errorClass,
            errorCode: queryArg.errorCode,
            limit: queryArg.limit,
            page: queryArg.page,
            provider: queryArg.provider,
            q: queryArg.q,
            retriedFromId: queryArg.retriedFromId,
            startDate: queryArg.startDate,
            status: queryArg.status,
            templateId: queryArg.templateId,
            to: queryArg.to,
            userId: queryArg.userId,
          },
          url: `/comms/messages`,
        }),
      }),
      getCommsMessagesById: build.query<GetCommsMessagesByIdRes, GetCommsMessagesByIdArgs>({
        providesTags: ["admin", "comms"],
        query: (queryArg) => ({url: `/comms/messages/${queryArg}`}),
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
        providesTags: ["comms"],
        query: (queryArg) => ({url: `/comms/pushTokens/${queryArg}`}),
      }),
      getCommsStats: build.query<GetCommsStatsRes, GetCommsStatsArgs>({
        providesTags: ["admin", "comms"],
        query: (queryArg) => ({
          params: {
            channel: queryArg.channel,
            endDate: queryArg.endDate,
            errorClass: queryArg.errorClass,
            errorCode: queryArg.errorCode,
            limit: queryArg.limit,
            page: queryArg.page,
            provider: queryArg.provider,
            q: queryArg.q,
            retriedFromId: queryArg.retriedFromId,
            startDate: queryArg.startDate,
            status: queryArg.status,
            templateId: queryArg.templateId,
            to: queryArg.to,
            userId: queryArg.userId,
          },
          url: `/comms/stats`,
        }),
      }),
      getFeatureFlagsFlags: build.query<GetFeatureFlagsFlagsRes, GetFeatureFlagsFlagsArgs>({
        providesTags: ["featureflags"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            limit: queryArg.limit,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/feature-flags/flags/`,
        }),
      }),
      getFeatureFlagsFlagsById: build.query<
        GetFeatureFlagsFlagsByIdRes,
        GetFeatureFlagsFlagsByIdArgs
      >({
        providesTags: ["featureflags"],
        query: (queryArg) => ({url: `/feature-flags/flags/${queryArg}`}),
      }),
      getGptHistories: build.query<GetGptHistoriesRes, GetGptHistoriesArgs>({
        providesTags: ["gpthistories"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            limit: queryArg.limit,
            page: queryArg.page,
            projectId: queryArg.projectId,
            sort: queryArg.sort,
            userId: queryArg.userId,
          },
          url: `/gpt/histories/`,
        }),
      }),
      getGptHistoriesById: build.query<GetGptHistoriesByIdRes, GetGptHistoriesByIdArgs>({
        providesTags: ["gpthistories"],
        query: (queryArg) => ({url: `/gpt/histories/${queryArg}`}),
      }),
      getGptTools: build.query<GetGptToolsRes, GetGptToolsArgs>({
        providesTags: ["gpt"],
        query: () => ({url: `/gpt/tools`}),
      }),
      getProjects: build.query<GetProjectsRes, GetProjectsArgs>({
        providesTags: ["exampleprojects"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            limit: queryArg.limit,
            organizationId: queryArg.organizationId,
            page: queryArg.page,
            sort: queryArg.sort,
            title: queryArg.title,
          },
          url: `/projects/`,
        }),
      }),
      getProjectsById: build.query<GetProjectsByIdRes, GetProjectsByIdArgs>({
        providesTags: ["exampleprojects"],
        query: (queryArg) => ({url: `/projects/${queryArg}`}),
      }),
      getSettingsGcs: build.query<GetSettingsGcsRes, GetSettingsGcsArgs>({
        providesTags: ["settings"],
        query: () => ({url: `/settings/gcs`}),
      }),
      getTodos: build.query<GetTodosRes, GetTodosArgs>({
        providesTags: ["todos"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            completed: queryArg.completed,
            limit: queryArg.limit,
            ownerId: queryArg.ownerId,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/todos/`,
        }),
      }),
      getTodosById: build.query<GetTodosByIdRes, GetTodosByIdArgs>({
        providesTags: ["todos"],
        query: (queryArg) => ({url: `/todos/${queryArg}`}),
      }),
      getUsers: build.query<GetUsersRes, GetUsersArgs>({
        providesTags: ["users"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            email: queryArg.email,
            limit: queryArg.limit,
            name: queryArg.name,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/users/`,
        }),
      }),
      getUsersById: build.query<GetUsersByIdRes, GetUsersByIdArgs>({
        providesTags: ["users"],
        query: (queryArg) => ({url: `/users/${queryArg}`}),
      }),
      patchAdminConsentFormsById: build.mutation<
        PatchAdminConsentFormsByIdRes,
        PatchAdminConsentFormsByIdArgs
      >({
        invalidatesTags: ["consentforms"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/admin/consent-forms/${queryArg.id}`,
        }),
      }),
      patchAdminFeatureFlagsById: build.mutation<
        PatchAdminFeatureFlagsByIdRes,
        PatchAdminFeatureFlagsByIdArgs
      >({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/admin/feature-flags/${queryArg.id}`,
        }),
      }),
      patchAdminTodosById: build.mutation<PatchAdminTodosByIdRes, PatchAdminTodosByIdArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/admin/todos/${queryArg.id}`,
        }),
      }),
      patchAdminUsersById: build.mutation<PatchAdminUsersByIdRes, PatchAdminUsersByIdArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/admin/users/${queryArg.id}`,
        }),
      }),
      patchAiObservabilityEvaluatorsById: build.mutation<
        PatchAiObservabilityEvaluatorsByIdRes,
        PatchAiObservabilityEvaluatorsByIdArgs
      >({
        invalidatesTags: ["observability"],
        query: (queryArg) => ({
          method: "PATCH",
          url: `/ai/observability/evaluators/${queryArg}`,
        }),
      }),
      patchFeatureFlagsFlagsById: build.mutation<
        PatchFeatureFlagsFlagsByIdRes,
        PatchFeatureFlagsFlagsByIdArgs
      >({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/feature-flags/flags/${queryArg.id}`,
        }),
      }),
      patchGptHistoriesById: build.mutation<PatchGptHistoriesByIdRes, PatchGptHistoriesByIdArgs>({
        invalidatesTags: ["gpthistories"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/gpt/histories/${queryArg.id}`,
        }),
      }),
      patchGptHistoriesByIdRating: build.mutation<
        PatchGptHistoriesByIdRatingRes,
        PatchGptHistoriesByIdRatingArgs
      >({
        invalidatesTags: ["gpt"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/gpt/histories/${queryArg.id}/rating`,
        }),
      }),
      patchProjectsById: build.mutation<PatchProjectsByIdRes, PatchProjectsByIdArgs>({
        invalidatesTags: ["exampleprojects"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/projects/${queryArg.id}`,
        }),
      }),
      patchTodosById: build.mutation<PatchTodosByIdRes, PatchTodosByIdArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/todos/${queryArg.id}`,
        }),
      }),
      patchUsersById: build.mutation<PatchUsersByIdRes, PatchUsersByIdArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/users/${queryArg.id}`,
        }),
      }),
      postAdminAuditLogsBulkPatch: build.mutation<
        PostAdminAuditLogsBulkPatchRes,
        PostAdminAuditLogsBulkPatchArgs
      >({
        invalidatesTags: ["admin"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/audit-logs/bulk-patch`,
        }),
      }),
      postAdminBackgroundTasks: build.mutation<
        PostAdminBackgroundTasksRes,
        PostAdminBackgroundTasksArgs
      >({
        invalidatesTags: ["admin"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/background-tasks`,
        }),
      }),
      postAdminConsentForms: build.mutation<PostAdminConsentFormsRes, PostAdminConsentFormsArgs>({
        invalidatesTags: ["consentforms"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/consent-forms/`,
        }),
      }),
      postAdminConsentFormsBulkPatch: build.mutation<
        PostAdminConsentFormsBulkPatchRes,
        PostAdminConsentFormsBulkPatchArgs
      >({
        invalidatesTags: ["admin"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/consent-forms/bulk-patch`,
        }),
      }),
      postAdminConsentResponsesBulkPatch: build.mutation<
        PostAdminConsentResponsesBulkPatchRes,
        PostAdminConsentResponsesBulkPatchArgs
      >({
        invalidatesTags: ["admin"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/consent-responses/bulk-patch`,
        }),
      }),
      postAdminFeatureFlags: build.mutation<PostAdminFeatureFlagsRes, PostAdminFeatureFlagsArgs>({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/feature-flags/`,
        }),
      }),
      postAdminFeatureFlagsBulkPatch: build.mutation<
        PostAdminFeatureFlagsBulkPatchRes,
        PostAdminFeatureFlagsBulkPatchArgs
      >({
        invalidatesTags: ["admin"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/feature-flags/bulk-patch`,
        }),
      }),
      postAdminTodos: build.mutation<PostAdminTodosRes, PostAdminTodosArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/todos/`,
        }),
      }),
      postAdminTodosBulkPatch: build.mutation<
        PostAdminTodosBulkPatchRes,
        PostAdminTodosBulkPatchArgs
      >({
        invalidatesTags: ["admin"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/todos/bulk-patch`,
        }),
      }),
      postAdminUsers: build.mutation<PostAdminUsersRes, PostAdminUsersArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/users/`,
        }),
      }),
      postAdminUsersBulkPatch: build.mutation<
        PostAdminUsersBulkPatchRes,
        PostAdminUsersBulkPatchArgs
      >({
        invalidatesTags: ["admin"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/users/bulk-patch`,
        }),
      }),
      postAdminUsersByIdPassword: build.mutation<
        PostAdminUsersByIdPasswordRes,
        PostAdminUsersByIdPasswordArgs
      >({
        invalidatesTags: ["admin-users"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "POST",
          url: `/admin/users/${queryArg.id}/password`,
        }),
      }),
      postAiExampleSummarize: build.mutation<PostAiExampleSummarizeRes, PostAiExampleSummarizeArgs>(
        {
          invalidatesTags: ["ai", "observability"],
          query: (queryArg) => ({
            body: queryArg,
            method: "POST",
            url: `/ai/example-summarize`,
          }),
        }
      ),
      postAiObservabilityEvaluators: build.mutation<
        PostAiObservabilityEvaluatorsRes,
        PostAiObservabilityEvaluatorsArgs
      >({
        invalidatesTags: ["observability"],
        query: () => ({method: "POST", url: `/ai/observability/evaluators`}),
      }),
      postAiObservabilityEvaluatorsTemplatesByName: build.mutation<
        PostAiObservabilityEvaluatorsTemplatesByNameRes,
        PostAiObservabilityEvaluatorsTemplatesByNameArgs
      >({
        invalidatesTags: ["observability"],
        query: (queryArg) => ({
          method: "POST",
          url: `/ai/observability/evaluators/templates/${queryArg}`,
        }),
      }),
      postAiObservabilityPrompts: build.mutation<
        PostAiObservabilityPromptsRes,
        PostAiObservabilityPromptsArgs
      >({
        invalidatesTags: ["observability"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/ai/observability/prompts`,
        }),
      }),
      postAiObservabilityPromptsByNameLabels: build.mutation<
        PostAiObservabilityPromptsByNameLabelsRes,
        PostAiObservabilityPromptsByNameLabelsArgs
      >({
        invalidatesTags: ["observability"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "POST",
          url: `/ai/observability/prompts/${queryArg.name}/labels`,
        }),
      }),
      postAiObservabilityPromptsByNamePlayground: build.mutation<
        PostAiObservabilityPromptsByNamePlaygroundRes,
        PostAiObservabilityPromptsByNamePlaygroundArgs
      >({
        invalidatesTags: ["observability"],
        query: (queryArg) => ({
          method: "POST",
          url: `/ai/observability/prompts/${queryArg}/playground`,
        }),
      }),
      postAiObservabilityPromptsByNameVersions: build.mutation<
        PostAiObservabilityPromptsByNameVersionsRes,
        PostAiObservabilityPromptsByNameVersionsArgs
      >({
        invalidatesTags: ["observability"],
        query: (queryArg) => ({
          method: "POST",
          url: `/ai/observability/prompts/${queryArg}/versions`,
        }),
      }),
      postAiObservabilityReviewById: build.mutation<
        PostAiObservabilityReviewByIdRes,
        PostAiObservabilityReviewByIdArgs
      >({
        invalidatesTags: ["observability"],
        query: (queryArg) => ({
          method: "POST",
          url: `/ai/observability/review/${queryArg}`,
        }),
      }),
      postAiObservabilityTracesByIdScores: build.mutation<
        PostAiObservabilityTracesByIdScoresRes,
        PostAiObservabilityTracesByIdScoresArgs
      >({
        invalidatesTags: ["observability"],
        query: (queryArg) => ({
          method: "POST",
          url: `/ai/observability/traces/${queryArg}/scores`,
        }),
      }),
      postAiObservabilityTracesReview: build.mutation<
        PostAiObservabilityTracesReviewRes,
        PostAiObservabilityTracesReviewArgs
      >({
        invalidatesTags: ["observability"],
        query: () => ({
          method: "POST",
          url: `/ai/observability/traces/review`,
        }),
      }),
      postCommsDevTestPush: build.mutation<PostCommsDevTestPushRes, PostCommsDevTestPushArgs>({
        invalidatesTags: ["comms"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/comms/dev/testPush`,
        }),
      }),
      postCommsMessagesByIdRetry: build.mutation<
        PostCommsMessagesByIdRetryRes,
        PostCommsMessagesByIdRetryArgs
      >({
        invalidatesTags: ["admin", "comms"],
        query: (queryArg) => ({
          method: "POST",
          url: `/comms/messages/${queryArg}/retry`,
        }),
      }),
      postCommsMessagesRetryMany: build.mutation<
        PostCommsMessagesRetryManyRes,
        PostCommsMessagesRetryManyArgs
      >({
        invalidatesTags: ["admin", "comms"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/comms/messages/retryMany`,
        }),
      }),
      postCommsPushTokens: build.mutation<PostCommsPushTokensRes, PostCommsPushTokensArgs>({
        invalidatesTags: ["comms"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/comms/pushTokens`,
        }),
      }),
      postFeatureFlagsFlags: build.mutation<PostFeatureFlagsFlagsRes, PostFeatureFlagsFlagsArgs>({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/feature-flags/flags/`,
        }),
      }),
      postGptHistories: build.mutation<PostGptHistoriesRes, PostGptHistoriesArgs>({
        invalidatesTags: ["gpthistories"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/gpt/histories/`,
        }),
      }),
      postGptPrompt: build.mutation<PostGptPromptRes, PostGptPromptArgs>({
        invalidatesTags: ["gpt"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/gpt/prompt`,
        }),
      }),
      postGptRemix: build.mutation<PostGptRemixRes, PostGptRemixArgs>({
        invalidatesTags: ["gpt"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/gpt/remix`,
        }),
      }),
      postLoadtestTodosChurn: build.mutation<PostLoadtestTodosChurnRes, PostLoadtestTodosChurnArgs>(
        {
          invalidatesTags: ["loadtest"],
          query: (queryArg) => ({
            body: queryArg,
            method: "POST",
            url: `/loadtest/todos/churn`,
          }),
        }
      ),
      postLoadtestTodosClear: build.mutation<PostLoadtestTodosClearRes, PostLoadtestTodosClearArgs>(
        {
          invalidatesTags: ["loadtest"],
          query: () => ({method: "POST", url: `/loadtest/todos/clear`}),
        }
      ),
      postLoadtestTodosGenerate: build.mutation<
        PostLoadtestTodosGenerateRes,
        PostLoadtestTodosGenerateArgs
      >({
        invalidatesTags: ["loadtest"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/loadtest/todos/generate`,
        }),
      }),
      postProjects: build.mutation<PostProjectsRes, PostProjectsArgs>({
        invalidatesTags: ["exampleprojects"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/projects/`,
        }),
      }),
      postSettingsGcs: build.mutation<PostSettingsGcsRes, PostSettingsGcsArgs>({
        invalidatesTags: ["settings"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/settings/gcs`,
        }),
      }),
      postTodos: build.mutation<PostTodosRes, PostTodosArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/todos/`,
        }),
      }),
      postUsers: build.mutation<PostUsersRes, PostUsersArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/users/`,
        }),
      }),
      todosBulkComplete: build.mutation<TodosBulkCompleteRes, TodosBulkCompleteArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/todos/bulkComplete`,
        }),
      }),
      todosMarkComplete: build.mutation<TodosMarkCompleteRes, TodosMarkCompleteArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          method: "POST",
          url: `/todos/${queryArg}/markComplete`,
        }),
      }),
    }),
    overrideExisting: false,
  });

export {injectedRtkApi as openapi};
export type GetAiModelsRes = /** status 200 Success */ {
  models?: {
    label?: string;
    value?: string;
  }[];
};
export type GetAiModelsArgs = undefined;
export type PostAiExampleSummarizeRes = /** status 200 Success */ {
  data?: {
    output?: string;
  };
};
export type PostAiExampleSummarizeArgs = {
  text?: string;
};
export type PostGptHistoriesRes = /** status 201 Successful create */ {
  /** Project this conversation belongs to */
  projectId?: string;
  /** Ordered list of messages in this conversation */
  prompts?: {
    /** Arguments passed to a tool call */
    args?: any;
    /** Multipart content attached to this prompt */
    content?: {
      /** Original filename of the attached file */
      filename?: string;
      /** MIME type of the content part */
      mimeType?: string;
      /** Text content of this part */
      text?: string;
      /** The kind of content this part represents */
      type: "text" | "image" | "file";
      /** URL pointing to the content resource */
      url?: string;
    }[];
    /** AI model identifier used for this prompt */
    model?: string;
    /** User feedback rating for this prompt */
    rating?: "up" | "down";
    /** Result returned from a tool call */
    result?: any;
    /** Text content of the prompt or response */
    text: string;
    /** Identifier linking a tool result to its originating call */
    toolCallId?: string;
    /** Name of the tool that was invoked */
    toolName?: string;
    /** Role of this message in the conversation */
    type: "user" | "assistant" | "system" | "tool-call" | "tool-result";
  }[];
  /** Auto-generated title from the first assistant response */
  title?: string;
  /** The user who owns this conversation history */
  userId: string;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  ownerId?: any;
};
export type PostGptHistoriesArgs = {
  /** Project this conversation belongs to */
  projectId?: string;
  /** Ordered list of messages in this conversation */
  prompts?: {
    /** Arguments passed to a tool call */
    args?: any;
    /** Multipart content attached to this prompt */
    content?: {
      /** Original filename of the attached file */
      filename?: string;
      /** MIME type of the content part */
      mimeType?: string;
      /** Text content of this part */
      text?: string;
      /** The kind of content this part represents */
      type: "text" | "image" | "file";
      /** URL pointing to the content resource */
      url?: string;
    }[];
    /** AI model identifier used for this prompt */
    model?: string;
    /** User feedback rating for this prompt */
    rating?: "up" | "down";
    /** Result returned from a tool call */
    result?: any;
    /** Text content of the prompt or response */
    text: string;
    /** Identifier linking a tool result to its originating call */
    toolCallId?: string;
    /** Name of the tool that was invoked */
    toolName?: string;
    /** Role of this message in the conversation */
    type: "user" | "assistant" | "system" | "tool-call" | "tool-result";
  }[];
  /** Auto-generated title from the first assistant response */
  title?: string;
  /** The user who owns this conversation history */
  userId?: string;
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  ownerId?: any;
};
export type GetGptHistoriesRes = /** status 200 Successful list */ {
  data?: {
    /** Project this conversation belongs to */
    projectId?: string;
    /** Ordered list of messages in this conversation */
    prompts?: {
      /** Arguments passed to a tool call */
      args?: any;
      /** Multipart content attached to this prompt */
      content?: {
        /** Original filename of the attached file */
        filename?: string;
        /** MIME type of the content part */
        mimeType?: string;
        /** Text content of this part */
        text?: string;
        /** The kind of content this part represents */
        type: "text" | "image" | "file";
        /** URL pointing to the content resource */
        url?: string;
      }[];
      /** AI model identifier used for this prompt */
      model?: string;
      /** User feedback rating for this prompt */
      rating?: "up" | "down";
      /** Result returned from a tool call */
      result?: any;
      /** Text content of the prompt or response */
      text: string;
      /** Identifier linking a tool result to its originating call */
      toolCallId?: string;
      /** Name of the tool that was invoked */
      toolName?: string;
      /** Role of this message in the conversation */
      type: "user" | "assistant" | "system" | "tool-call" | "tool-result";
    }[];
    /** Auto-generated title from the first assistant response */
    title?: string;
    /** The user who owns this conversation history */
    userId: string;
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
    ownerId?: any;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetGptHistoriesArgs = {
  _id?: {
    $in?: string[];
  };
  userId?:
    | any
    | {
        $in?: any[];
      };
  projectId?:
    | any
    | {
        $in?: any[];
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetGptHistoriesByIdRes = /** status 200 Successful read */ {
  /** Project this conversation belongs to */
  projectId?: string;
  /** Ordered list of messages in this conversation */
  prompts?: {
    /** Arguments passed to a tool call */
    args?: any;
    /** Multipart content attached to this prompt */
    content?: {
      /** Original filename of the attached file */
      filename?: string;
      /** MIME type of the content part */
      mimeType?: string;
      /** Text content of this part */
      text?: string;
      /** The kind of content this part represents */
      type: "text" | "image" | "file";
      /** URL pointing to the content resource */
      url?: string;
    }[];
    /** AI model identifier used for this prompt */
    model?: string;
    /** User feedback rating for this prompt */
    rating?: "up" | "down";
    /** Result returned from a tool call */
    result?: any;
    /** Text content of the prompt or response */
    text: string;
    /** Identifier linking a tool result to its originating call */
    toolCallId?: string;
    /** Name of the tool that was invoked */
    toolName?: string;
    /** Role of this message in the conversation */
    type: "user" | "assistant" | "system" | "tool-call" | "tool-result";
  }[];
  /** Auto-generated title from the first assistant response */
  title?: string;
  /** The user who owns this conversation history */
  userId: string;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  ownerId?: any;
};
export type GetGptHistoriesByIdArgs = string;
export type PatchGptHistoriesByIdRes = /** status 200 Successful update */ {
  /** Project this conversation belongs to */
  projectId?: string;
  /** Ordered list of messages in this conversation */
  prompts?: {
    /** Arguments passed to a tool call */
    args?: any;
    /** Multipart content attached to this prompt */
    content?: {
      /** Original filename of the attached file */
      filename?: string;
      /** MIME type of the content part */
      mimeType?: string;
      /** Text content of this part */
      text?: string;
      /** The kind of content this part represents */
      type: "text" | "image" | "file";
      /** URL pointing to the content resource */
      url?: string;
    }[];
    /** AI model identifier used for this prompt */
    model?: string;
    /** User feedback rating for this prompt */
    rating?: "up" | "down";
    /** Result returned from a tool call */
    result?: any;
    /** Text content of the prompt or response */
    text: string;
    /** Identifier linking a tool result to its originating call */
    toolCallId?: string;
    /** Name of the tool that was invoked */
    toolName?: string;
    /** Role of this message in the conversation */
    type: "user" | "assistant" | "system" | "tool-call" | "tool-result";
  }[];
  /** Auto-generated title from the first assistant response */
  title?: string;
  /** The user who owns this conversation history */
  userId: string;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  ownerId?: any;
};
export type PatchGptHistoriesByIdArgs = {
  id: string;
  body: {
    /** Project this conversation belongs to */
    projectId?: string;
    /** Ordered list of messages in this conversation */
    prompts?: {
      /** Arguments passed to a tool call */
      args?: any;
      /** Multipart content attached to this prompt */
      content?: {
        /** Original filename of the attached file */
        filename?: string;
        /** MIME type of the content part */
        mimeType?: string;
        /** Text content of this part */
        text?: string;
        /** The kind of content this part represents */
        type: "text" | "image" | "file";
        /** URL pointing to the content resource */
        url?: string;
      }[];
      /** AI model identifier used for this prompt */
      model?: string;
      /** User feedback rating for this prompt */
      rating?: "up" | "down";
      /** Result returned from a tool call */
      result?: any;
      /** Text content of the prompt or response */
      text: string;
      /** Identifier linking a tool result to its originating call */
      toolCallId?: string;
      /** Name of the tool that was invoked */
      toolName?: string;
      /** Role of this message in the conversation */
      type: "user" | "assistant" | "system" | "tool-call" | "tool-result";
    }[];
    /** Auto-generated title from the first assistant response */
    title?: string;
    /** The user who owns this conversation history */
    userId?: string;
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
    ownerId?: any;
  };
};
export type DeleteGptHistoriesByIdRes = unknown;
export type DeleteGptHistoriesByIdArgs = string;
export type PostGptPromptRes = /** status 200 Success */ {
  data?: string;
};
export type PostGptPromptArgs = {
  attachments?: {
    filename?: string;
    mimeType?: string;
    type?: string;
    url?: string;
  }[];
  historyId?: string;
  model?: string;
  projectId?: string;
  prompt?: string;
  promptLabel?: string;
  promptName?: string;
  sensitive?: boolean;
  sessionId?: string;
  systemPrompt?: string;
};
export type PatchGptHistoriesByIdRatingRes = /** status 200 Success */ {
  data?: object;
};
export type PatchGptHistoriesByIdRatingArgs = {
  id: string;
  body: {
    promptIndex?: number;
    rating?: string;
  };
};
export type PostGptRemixRes = /** status 200 Success */ {
  data?: string;
};
export type PostGptRemixArgs = {
  promptLabel?: string;
  promptName?: string;
  sensitive?: boolean;
  sessionId?: string;
  text?: string;
};
export type GetGptToolsRes = /** status 200 Success */ {
  data?: {
    description?: string;
    name?: string;
    source?: string;
  }[];
};
export type GetGptToolsArgs = undefined;
export type PostAdminUsersByIdPasswordRes = /** status 200 Success */ {
  data?: {
    _id?: string;
    message?: string;
  };
};
export type PostAdminUsersByIdPasswordArgs = {
  id: string;
  body: {
    /** New password for the user */
    password?: string;
  };
};
export type GetSettingsGcsRes = /** status 200 Success */ {
  data?: {
    bucketName?: string;
    configured?: boolean;
    hasCredentials?: boolean;
    projectId?: string;
  };
};
export type GetSettingsGcsArgs = undefined;
export type PostSettingsGcsRes = /** status 200 Success */ {
  data?: {
    configured?: boolean;
    message?: string;
  };
};
export type PostSettingsGcsArgs = {
  bucketName?: string;
  projectId?: string;
  serviceAccountKey?: string;
};
export type DeleteSettingsGcsRes = /** status 200 Success */ {
  data?: {
    configured?: boolean;
    message?: string;
  };
};
export type DeleteSettingsGcsArgs = undefined;
export type PostLoadtestTodosGenerateRes = /** status 200 Success */ {
  data?: {
    created?: number;
  };
};
export type PostLoadtestTodosGenerateArgs = {
  count?: number;
};
export type PostLoadtestTodosChurnRes = /** status 200 Success */ {
  data?: {
    created?: number;
    deleted?: number;
    updated?: number;
  };
};
export type PostLoadtestTodosChurnArgs = {
  creates?: number;
  deletes?: number;
  updates?: number;
};
export type PostLoadtestTodosClearRes = /** status 200 Success */ {
  data?: {
    deleted?: number;
  };
};
export type PostLoadtestTodosClearArgs = undefined;
export type PostCommsDevTestPushRes = /** status 200 Success */ {
  data?: {
    accepted?: number;
    results?: object[];
    tokenCount?: number;
  };
};
export type PostCommsDevTestPushArgs = {
  body?: string;
  title?: string;
};
export type TodosMarkCompleteRes = /** status 200 Successful response */ {
  data?: object;
};
export type TodosMarkCompleteArgs = string;
export type TodosBulkCompleteRes = /** status 200 Successful response */ {
  data: {
    matched: number;
    modified: number;
  };
};
export type TodosBulkCompleteArgs = {
  ids: string[];
};
export type PostTodosRes = /** status 201 Successful create */ {
  /** The document id (String so offline sync clients can mint ids) */
  _id: string;
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: string;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type PostTodosArgs = {
  /** The document id (String so offline sync clients can mint ids) */
  _id?: string;
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId?: string;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type GetTodosRes = /** status 200 Successful list */ {
  data?: {
    /** The document id (String so offline sync clients can mint ids) */
    _id: string;
    /** Whether the todo item has been completed */
    completed?: boolean;
    /** The user who owns this todo */
    ownerId: string;
    /** Priority level of the todo */
    priority?: "low" | "medium" | "high";
    /** Free-form tags for categorization */
    tags?: string[];
    /** The title of the todo item */
    title: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
    /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
    _syncPrevStream?: string;
    /** Monotonic per-stream sequence stamped on every synced write */
    _syncSeq?: number;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetTodosArgs = {
  _id?: {
    $in?: string[];
  };
  completed?:
    | boolean
    | {
        $in?: boolean[];
      };
  ownerId?:
    | any
    | {
        $in?: any[];
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetTodosByIdRes = /** status 200 Successful read */ {
  /** The document id (String so offline sync clients can mint ids) */
  _id: string;
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: string;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type GetTodosByIdArgs = string;
export type PatchTodosByIdRes = /** status 200 Successful update */ {
  /** The document id (String so offline sync clients can mint ids) */
  _id: string;
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: string;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type PatchTodosByIdArgs = {
  id: string;
  body: {
    /** The document id (String so offline sync clients can mint ids) */
    _id?: string;
    /** Whether the todo item has been completed */
    completed?: boolean;
    /** The user who owns this todo */
    ownerId?: string;
    /** Priority level of the todo */
    priority?: "low" | "medium" | "high";
    /** Free-form tags for categorization */
    tags?: string[];
    /** The title of the todo item */
    title?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
    /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
    _syncPrevStream?: string;
    /** Monotonic per-stream sequence stamped on every synced write */
    _syncSeq?: number;
  };
};
export type DeleteTodosByIdRes = unknown;
export type DeleteTodosByIdArgs = string;
export type PostProjectsRes = /** status 201 Successful create */ {
  /** The document id (String so offline sync clients can mint ids) */
  _id: string;
  /** The organization (tenant) this project belongs to */
  organizationId: string;
  /** The title of the project */
  title: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type PostProjectsArgs = {
  /** The document id (String so offline sync clients can mint ids) */
  _id?: string;
  /** The organization (tenant) this project belongs to */
  organizationId?: string;
  /** The title of the project */
  title?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type GetProjectsRes = /** status 200 Successful list */ {
  data?: {
    /** The document id (String so offline sync clients can mint ids) */
    _id: string;
    /** The organization (tenant) this project belongs to */
    organizationId: string;
    /** The title of the project */
    title: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
    /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
    _syncPrevStream?: string;
    /** Monotonic per-stream sequence stamped on every synced write */
    _syncSeq?: number;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetProjectsArgs = {
  _id?: {
    $in?: string[];
  };
  organizationId?:
    | string
    | {
        $in?: string[];
      };
  title?:
    | string
    | {
        $in?: string[];
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetProjectsByIdRes = /** status 200 Successful read */ {
  /** The document id (String so offline sync clients can mint ids) */
  _id: string;
  /** The organization (tenant) this project belongs to */
  organizationId: string;
  /** The title of the project */
  title: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type GetProjectsByIdArgs = string;
export type PatchProjectsByIdRes = /** status 200 Successful update */ {
  /** The document id (String so offline sync clients can mint ids) */
  _id: string;
  /** The organization (tenant) this project belongs to */
  organizationId: string;
  /** The title of the project */
  title: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type PatchProjectsByIdArgs = {
  id: string;
  body: {
    /** The document id (String so offline sync clients can mint ids) */
    _id?: string;
    /** The organization (tenant) this project belongs to */
    organizationId?: string;
    /** The title of the project */
    title?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
    /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
    _syncPrevStream?: string;
    /** Monotonic per-stream sequence stamped on every synced write */
    _syncSeq?: number;
  };
};
export type DeleteProjectsByIdRes = unknown;
export type DeleteProjectsByIdArgs = string;
export type PostUsersRes = /** status 201 Successful create */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
  organizationIds?: string[];
  _id: string;
  hash?: string;
  salt?: string;
  /** RBAC role names assigned to this user */
  roles?: string[];
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostUsersArgs = {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email?: string;
  /** The user's display name */
  name?: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
  organizationIds?: string[];
  _id?: string;
  hash?: string;
  salt?: string;
  /** RBAC role names assigned to this user */
  roles?: string[];
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetUsersRes = /** status 200 Successful list */ {
  data?: {
    /** Whether the user has admin privileges */
    admin?: boolean;
    /** Identifier linking to the Better Auth session provider */
    betterAuthId?: string;
    /** The user's email address, used for authentication */
    email: string;
    /** The user's display name */
    name: string;
    /** OAuth provider used for authentication */
    oauthProvider?: "google" | "github" | "apple" | null;
    /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
    organizationIds?: string[];
    _id: string;
    hash?: string;
    salt?: string;
    /** RBAC role names assigned to this user */
    roles?: string[];
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetUsersArgs = {
  _id?: {
    $in?: string[];
  };
  email?:
    | string
    | {
        $in?: string[];
      };
  name?:
    | string
    | {
        $in?: string[];
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetUsersByIdRes = /** status 200 Successful read */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
  organizationIds?: string[];
  _id: string;
  hash?: string;
  salt?: string;
  /** RBAC role names assigned to this user */
  roles?: string[];
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetUsersByIdArgs = string;
export type PatchUsersByIdRes = /** status 200 Successful update */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
  organizationIds?: string[];
  _id: string;
  hash?: string;
  salt?: string;
  /** RBAC role names assigned to this user */
  roles?: string[];
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchUsersByIdArgs = {
  id: string;
  body: {
    /** Whether the user has admin privileges */
    admin?: boolean;
    /** Identifier linking to the Better Auth session provider */
    betterAuthId?: string;
    /** The user's email address, used for authentication */
    email?: string;
    /** The user's display name */
    name?: string;
    /** OAuth provider used for authentication */
    oauthProvider?: "google" | "github" | "apple" | null;
    /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
    organizationIds?: string[];
    _id?: string;
    hash?: string;
    salt?: string;
    /** RBAC role names assigned to this user */
    roles?: string[];
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteUsersByIdRes = unknown;
export type DeleteUsersByIdArgs = string;
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
  userId: string;
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
  provider?: string;
  status?: string;
  errorClass?: string;
  errorCode?: string;
  userId?: string;
  to?: string;
  templateId?: string;
  retriedFromId?: string;
  startDate?: string;
  endDate?: string;
  q?: string;
};
export type PostCommsMessagesRetryManyRes = /** status 200 Success */ {
  retried?: object[];
  skipped?: object[];
};
export type PostCommsMessagesRetryManyArgs = {
  channel?: string;
  endDate?: string;
  errorClass?: string;
  errorCode?: string;
  limit?: number;
  provider?: string;
  q?: string;
  retriedFromId?: string;
  startDate?: string;
  status?: string;
  templateId?: string;
  to?: string;
  userId?: string;
};
export type GetCommsMessagesByIdRes = /** status 200 Success */ {
  data?: object;
};
export type GetCommsMessagesByIdArgs = string;
export type PostCommsMessagesByIdRetryRes = /** status 200 Success */ {
  data?: object;
};
export type PostCommsMessagesByIdRetryArgs = string;
export type GetCommsStatsRes = /** status 200 Success */ {
  buckets?: object[];
  byProvider?: object[];
  totals?: object;
};
export type GetCommsStatsArgs = {
  page?: number;
  limit?: number;
  channel?: string;
  provider?: string;
  status?: string;
  errorClass?: string;
  errorCode?: string;
  userId?: string;
  to?: string;
  templateId?: string;
  retriedFromId?: string;
  startDate?: string;
  endDate?: string;
  q?: string;
};
export type PostFeatureFlagsFlagsRes = /** status 201 Successful create */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
  defaultVariant?: string;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
    _id?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
    _id?: string;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostFeatureFlagsFlagsArgs = {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
  defaultVariant?: string;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key?: string;
  /** Human-readable display name */
  name?: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
    _id?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
    _id?: string;
  }[];
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetFeatureFlagsFlagsRes = /** status 200 Successful list */ {
  data?: {
    /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
    archived?: boolean;
    /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
    defaultVariant?: string;
    /** Explanation of what this flag controls */
    description?: string;
    /** Global kill switch — if false, flag is off for everyone */
    enabled?: boolean;
    /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
    key: string;
    /** Human-readable display name */
    name: string;
    /** For boolean flags with no matching rules: percentage of users who get true */
    rolloutPercentage?: number;
    rules?: {
      /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
      enabled?: boolean;
      /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
      field?: string;
      /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
      operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
      /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
      segment?: string;
      /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
      value?: any;
      /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
      variant?: string;
      _id?: string;
    }[];
    /** Boolean toggle or multi-variant A/B test */
    type?: "boolean" | "variant";
    variants?: {
      /** Variant identifier, e.g., 'control', 'variant-a' */
      key: string;
      /** Percentage weight for assignment (0-100, all must sum to 100) */
      weight: number;
      _id?: string;
    }[];
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetFeatureFlagsFlagsArgs = {
  _id?: {
    $in?: string[];
  };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetFeatureFlagsFlagsByIdRes = /** status 200 Successful read */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
  defaultVariant?: string;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
    _id?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
    _id?: string;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetFeatureFlagsFlagsByIdArgs = string;
export type PatchFeatureFlagsFlagsByIdRes = /** status 200 Successful update */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
  defaultVariant?: string;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
    _id?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
    _id?: string;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchFeatureFlagsFlagsByIdArgs = {
  id: string;
  body: {
    /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
    archived?: boolean;
    /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
    defaultVariant?: string;
    /** Explanation of what this flag controls */
    description?: string;
    /** Global kill switch — if false, flag is off for everyone */
    enabled?: boolean;
    /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
    key?: string;
    /** Human-readable display name */
    name?: string;
    /** For boolean flags with no matching rules: percentage of users who get true */
    rolloutPercentage?: number;
    rules?: {
      /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
      enabled?: boolean;
      /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
      field?: string;
      /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
      operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
      /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
      segment?: string;
      /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
      value?: any;
      /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
      variant?: string;
      _id?: string;
    }[];
    /** Boolean toggle or multi-variant A/B test */
    type?: "boolean" | "variant";
    variants?: {
      /** Variant identifier, e.g., 'control', 'variant-a' */
      key: string;
      /** Percentage weight for assignment (0-100, all must sum to 100) */
      weight: number;
      _id?: string;
    }[];
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteFeatureFlagsFlagsByIdRes = unknown;
export type DeleteFeatureFlagsFlagsByIdArgs = string;
export type GetAiObservabilityStatusRes = /** status 200 Success */ {
  data?: object;
};
export type GetAiObservabilityStatusArgs = undefined;
export type GetAiObservabilityPromptsRes = /** status 200 Success */ {
  data?: any;
};
export type GetAiObservabilityPromptsArgs = {
  folder?: string;
  search?: string;
  include?: string;
};
export type PostAiObservabilityPromptsRes = /** status 201 Success */ {
  data?: object;
};
export type PostAiObservabilityPromptsArgs = {
  folder: string;
  name: string;
};
export type GetAiObservabilityPromptsByNameRes = /** status 200 Success */ {
  data?: object;
};
export type GetAiObservabilityPromptsByNameArgs = string;
export type PostAiObservabilityPromptsByNameVersionsRes = /** status 201 Success */ {
  data?: object;
};
export type PostAiObservabilityPromptsByNameVersionsArgs = string;
export type PostAiObservabilityPromptsByNameLabelsRes = /** status 200 Success */ {
  data?: object;
};
export type PostAiObservabilityPromptsByNameLabelsArgs = {
  name: string;
  body: {
    label: string;
    version: number;
  };
};
export type PostAiObservabilityPromptsByNamePlaygroundRes = /** status 200 Success */ {
  data?: object;
};
export type PostAiObservabilityPromptsByNamePlaygroundArgs = string;
export type GetAiObservabilityTracesRes = /** status 200 Success */ {
  data?: any;
};
export type GetAiObservabilityTracesArgs = undefined;
export type GetAiObservabilityTracesByIdRes = /** status 200 Success */ {
  data?: object;
};
export type GetAiObservabilityTracesByIdArgs = string;
export type PostAiObservabilityTracesByIdScoresRes = /** status 201 Success */ {
  data?: object;
};
export type PostAiObservabilityTracesByIdScoresArgs = string;
export type GetAiObservabilityEvaluatorsTemplatesRes = /** status 200 Success */ {
  data?: any;
};
export type GetAiObservabilityEvaluatorsTemplatesArgs = undefined;
export type PostAiObservabilityEvaluatorsTemplatesByNameRes = /** status 201 Success */ {
  data?: object;
};
export type PostAiObservabilityEvaluatorsTemplatesByNameArgs = string;
export type GetAiObservabilityEvaluatorsRes = /** status 200 Success */ {
  data?: any;
};
export type GetAiObservabilityEvaluatorsArgs = undefined;
export type PostAiObservabilityEvaluatorsRes = /** status 201 Success */ {
  data?: object;
};
export type PostAiObservabilityEvaluatorsArgs = undefined;
export type GetAiObservabilityEvaluatorsByIdRes = /** status 200 Success */ {
  data?: object;
};
export type GetAiObservabilityEvaluatorsByIdArgs = string;
export type PatchAiObservabilityEvaluatorsByIdRes = /** status 200 Success */ {
  data?: object;
};
export type PatchAiObservabilityEvaluatorsByIdArgs = string;
export type DeleteAiObservabilityEvaluatorsByIdRes = /** status 204 Success */ {};
export type DeleteAiObservabilityEvaluatorsByIdArgs = string;
export type PostAiObservabilityTracesReviewRes = /** status 201 Success */ {
  data?: any;
};
export type PostAiObservabilityTracesReviewArgs = undefined;
export type GetAiObservabilityReviewRes = /** status 200 Success */ {
  data?: any;
};
export type GetAiObservabilityReviewArgs = undefined;
export type GetAiObservabilityReviewByIdRes = /** status 200 Success */ {
  data?: object;
};
export type GetAiObservabilityReviewByIdArgs = string;
export type PostAiObservabilityReviewByIdRes = /** status 200 Success */ {
  data?: object;
};
export type PostAiObservabilityReviewByIdArgs = string;
export type GetAdminConfigRes = /** status 200 Success */ {
  capabilities?: {
    actions?: boolean;
    fieldsets?: boolean;
    filters?: boolean;
    realtime?: boolean;
  };
  customScreens?: {
    description?: string;
    displayName?: string;
    group?: string;
    icon?: string;
    name?: string;
  }[];
  home?: object;
  models?: any;
  platformTools?: {
    configuration?: boolean;
    roles?: boolean;
    runScripts?: boolean;
    scripts?: boolean;
    version?: boolean;
    viewScripts?: boolean;
  };
  schemaVersion?: number;
  scripts?: {
    args?: any;
    description?: string;
    name?: string;
  }[];
  widgetIds?: string[];
};
export type GetAdminConfigArgs = undefined;
export type PostAdminBackgroundTasksRes = /** status 201 Success */ {
  taskId?: string;
};
export type PostAdminBackgroundTasksArgs = {
  /** Optional target document ids */
  ids?: string[];
  /** Task kind label persisted as taskType */
  kind: string;
  /** Opaque JSON metadata for workers */
  metadata?: object;
  /** Optional admin model route this task relates to */
  resourceRoute?: string;
};
export type PostAdminAuditLogsBulkPatchRes = /** status 200 Success */ {
  failures?: any;
  updated?: number;
};
export type PostAdminAuditLogsBulkPatchArgs = {
  /** Document ids to update */
  ids: string[];
  /** Partial document; keys must be allowlisted for this model */
  patch: object;
};
export type GetAdminAuditLogsRes = /** status 200 Successful list */ {
  data?: {
    /** User who performed the action */
    actorId?: string;
    /** Mongoose model name affected */
    modelName: string;
    /** Primary key of the affected document */
    recordId?: string;
    /** Human-readable label for the record */
    recordLabel?: string;
    /** Mutation kind */
    verb: "created" | "deleted" | "updated";
    _id: string;
    createdAt?: string;
    updatedAt?: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminAuditLogsArgs = {
  _id?: {
    $in?: string[];
  };
  q?:
    | any
    | {
        $in?: any[];
      };
  verb?:
    | ("created" | "deleted" | "updated")
    | {
        $in?: string[];
      };
  modelName?:
    | string
    | {
        $in?: string[];
      };
  recordLabel?:
    | string
    | {
        $in?: string[];
      };
  recordId?:
    | any
    | {
        $in?: any[];
      };
  actorId?:
    | any
    | {
        $in?: any[];
      };
  createdAt?:
    | string
    | {
        $gt?: string;
        $gte?: string;
        $lt?: string;
        $lte?: string;
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminAuditLogsByIdRes = /** status 200 Successful read */ {
  /** User who performed the action */
  actorId?: string;
  /** Mongoose model name affected */
  modelName: string;
  /** Primary key of the affected document */
  recordId?: string;
  /** Human-readable label for the record */
  recordLabel?: string;
  /** Mutation kind */
  verb: "created" | "deleted" | "updated";
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminAuditLogsByIdArgs = string;
export type PostAdminFeatureFlagsBulkPatchRes = /** status 200 Success */ {
  failures?: any;
  updated?: number;
};
export type PostAdminFeatureFlagsBulkPatchArgs = {
  /** Document ids to update */
  ids: string[];
  /** Partial document; keys must be allowlisted for this model */
  patch: object;
};
export type PostAdminFeatureFlagsRes = /** status 201 Successful create */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
  defaultVariant?: string;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
    _id?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
    _id?: string;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostAdminFeatureFlagsArgs = {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
  defaultVariant?: string;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key?: string;
  /** Human-readable display name */
  name?: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
    _id?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
    _id?: string;
  }[];
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminFeatureFlagsRes = /** status 200 Successful list */ {
  data?: {
    /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
    archived?: boolean;
    /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
    defaultVariant?: string;
    /** Explanation of what this flag controls */
    description?: string;
    /** Global kill switch — if false, flag is off for everyone */
    enabled?: boolean;
    /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
    key: string;
    /** Human-readable display name */
    name: string;
    /** For boolean flags with no matching rules: percentage of users who get true */
    rolloutPercentage?: number;
    rules?: {
      /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
      enabled?: boolean;
      /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
      field?: string;
      /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
      operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
      /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
      segment?: string;
      /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
      value?: any;
      /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
      variant?: string;
      _id?: string;
    }[];
    /** Boolean toggle or multi-variant A/B test */
    type?: "boolean" | "variant";
    variants?: {
      /** Variant identifier, e.g., 'control', 'variant-a' */
      key: string;
      /** Percentage weight for assignment (0-100, all must sum to 100) */
      weight: number;
      _id?: string;
    }[];
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminFeatureFlagsArgs = {
  _id?: {
    $in?: string[];
  };
  q?:
    | any
    | {
        $in?: any[];
      };
  key?:
    | string
    | {
        $in?: string[];
      };
  name?:
    | string
    | {
        $in?: string[];
      };
  type?:
    | ("boolean" | "variant")
    | {
        $in?: string[];
      };
  enabled?:
    | boolean
    | {
        $in?: boolean[];
      };
  archived?:
    | boolean
    | {
        $in?: boolean[];
      };
  defaultVariant?:
    | string
    | {
        $in?: string[];
      };
  created?:
    | string
    | {
        /** When this document was created */
        $gt?: string;
        /** When this document was created */
        $gte?: string;
        /** When this document was created */
        $lt?: string;
        /** When this document was created */
        $lte?: string;
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminFeatureFlagsByIdRes = /** status 200 Successful read */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
  defaultVariant?: string;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
    _id?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
    _id?: string;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminFeatureFlagsByIdArgs = string;
export type PatchAdminFeatureFlagsByIdRes = /** status 200 Successful update */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
  defaultVariant?: string;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
    _id?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
    _id?: string;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchAdminFeatureFlagsByIdArgs = {
  id: string;
  body: {
    /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
    archived?: boolean;
    /** OpenFeature defaultVariant key. Returned when the flag is disabled or errors during evaluation. For boolean flags, must be 'on' or 'off'. For variant flags, must be one of the keys in `variants`. Auto-populated on save when omitted (boolean → 'off', variant → first variant key). */
    defaultVariant?: string;
    /** Explanation of what this flag controls */
    description?: string;
    /** Global kill switch — if false, flag is off for everyone */
    enabled?: boolean;
    /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
    key?: string;
    /** Human-readable display name */
    name?: string;
    /** For boolean flags with no matching rules: percentage of users who get true */
    rolloutPercentage?: number;
    rules?: {
      /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
      enabled?: boolean;
      /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
      field?: string;
      /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
      operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
      /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
      segment?: string;
      /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
      value?: any;
      /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
      variant?: string;
      _id?: string;
    }[];
    /** Boolean toggle or multi-variant A/B test */
    type?: "boolean" | "variant";
    variants?: {
      /** Variant identifier, e.g., 'control', 'variant-a' */
      key: string;
      /** Percentage weight for assignment (0-100, all must sum to 100) */
      weight: number;
      _id?: string;
    }[];
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteAdminFeatureFlagsByIdRes = unknown;
export type DeleteAdminFeatureFlagsByIdArgs = string;
export type PostAdminConsentFormsBulkPatchRes = /** status 200 Success */ {
  failures?: any;
  updated?: number;
};
export type PostAdminConsentFormsBulkPatchArgs = {
  /** Document ids to update */
  ids: string[];
  /** Partial document; keys must be allowlisted for this model */
  patch: object;
};
export type PostAdminConsentFormsRes = /** status 201 Successful create */ {
  /** Whether this consent form is currently active and available to users */
  active?: boolean;
  /** Label text for the agreement button */
  agreeButtonText?: string;
  /** Whether users are allowed to decline the consent form */
  allowDecline?: boolean;
  /** Whether to require a drawn or typed signature when the user agrees */
  captureSignature?: boolean;
  /** List of checkboxes the user must interact with before agreeing */
  checkboxes?: {
    /** Optional prompt shown when the user checks this checkbox */
    confirmationPrompt?: string;
    /** Display label for the checkbox */
    label: string;
    /** Whether this checkbox must be checked before the user can agree */
    required?: boolean;
    _id?: string;
  }[];
  /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
  content: {
    [key: string]: string;
  };
  /** Label text for the decline button (only shown when allowDecline is true) */
  declineButtonText?: string;
  /** Default locale to use when the requested locale is not available */
  defaultLocale?: string;
  /** Display order relative to other consent forms (lower numbers appear first) */
  order: number;
  /** Whether users must complete this form before accessing the application */
  required?: boolean;
  /** Whether users must scroll to the bottom of the form content before agreeing */
  requireScrollToBottom?: boolean;
  /** URL-safe identifier for this form, combined with version to uniquely identify a form */
  slug: string;
  /** Human-readable title of the consent form */
  title: string;
  /** Category of consent form */
  type: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
  /** Version number of this form. Incrementing the version requires users to re-consent */
  version: number;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostAdminConsentFormsArgs = {
  /** Whether this consent form is currently active and available to users */
  active?: boolean;
  /** Label text for the agreement button */
  agreeButtonText?: string;
  /** Whether users are allowed to decline the consent form */
  allowDecline?: boolean;
  /** Whether to require a drawn or typed signature when the user agrees */
  captureSignature?: boolean;
  /** List of checkboxes the user must interact with before agreeing */
  checkboxes?: {
    /** Optional prompt shown when the user checks this checkbox */
    confirmationPrompt?: string;
    /** Display label for the checkbox */
    label: string;
    /** Whether this checkbox must be checked before the user can agree */
    required?: boolean;
    _id?: string;
  }[];
  /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
  content?: {
    [key: string]: string;
  };
  /** Label text for the decline button (only shown when allowDecline is true) */
  declineButtonText?: string;
  /** Default locale to use when the requested locale is not available */
  defaultLocale?: string;
  /** Display order relative to other consent forms (lower numbers appear first) */
  order?: number;
  /** Whether users must complete this form before accessing the application */
  required?: boolean;
  /** Whether users must scroll to the bottom of the form content before agreeing */
  requireScrollToBottom?: boolean;
  /** URL-safe identifier for this form, combined with version to uniquely identify a form */
  slug?: string;
  /** Human-readable title of the consent form */
  title?: string;
  /** Category of consent form */
  type?: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
  /** Version number of this form. Incrementing the version requires users to re-consent */
  version?: number;
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminConsentFormsRes = /** status 200 Successful list */ {
  data?: {
    /** Whether this consent form is currently active and available to users */
    active?: boolean;
    /** Label text for the agreement button */
    agreeButtonText?: string;
    /** Whether users are allowed to decline the consent form */
    allowDecline?: boolean;
    /** Whether to require a drawn or typed signature when the user agrees */
    captureSignature?: boolean;
    /** List of checkboxes the user must interact with before agreeing */
    checkboxes?: {
      /** Optional prompt shown when the user checks this checkbox */
      confirmationPrompt?: string;
      /** Display label for the checkbox */
      label: string;
      /** Whether this checkbox must be checked before the user can agree */
      required?: boolean;
      _id?: string;
    }[];
    /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
    content: {
      [key: string]: string;
    };
    /** Label text for the decline button (only shown when allowDecline is true) */
    declineButtonText?: string;
    /** Default locale to use when the requested locale is not available */
    defaultLocale?: string;
    /** Display order relative to other consent forms (lower numbers appear first) */
    order: number;
    /** Whether users must complete this form before accessing the application */
    required?: boolean;
    /** Whether users must scroll to the bottom of the form content before agreeing */
    requireScrollToBottom?: boolean;
    /** URL-safe identifier for this form, combined with version to uniquely identify a form */
    slug: string;
    /** Human-readable title of the consent form */
    title: string;
    /** Category of consent form */
    type: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
    /** Version number of this form. Incrementing the version requires users to re-consent */
    version: number;
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminConsentFormsArgs = {
  _id?: {
    $in?: string[];
  };
  q?:
    | any
    | {
        $in?: any[];
      };
  title?:
    | string
    | {
        $in?: string[];
      };
  type?:
    | ("agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom")
    | {
        $in?: string[];
      };
  version?:
    | number
    | {
        /** Version number of this form. Incrementing the version requires users to re-consent */
        $gt?: number;
        /** Version number of this form. Incrementing the version requires users to re-consent */
        $gte?: number;
        /** Version number of this form. Incrementing the version requires users to re-consent */
        $lt?: number;
        /** Version number of this form. Incrementing the version requires users to re-consent */
        $lte?: number;
      };
  active?:
    | boolean
    | {
        $in?: boolean[];
      };
  order?:
    | number
    | {
        /** Display order relative to other consent forms (lower numbers appear first) */
        $gt?: number;
        /** Display order relative to other consent forms (lower numbers appear first) */
        $gte?: number;
        /** Display order relative to other consent forms (lower numbers appear first) */
        $lt?: number;
        /** Display order relative to other consent forms (lower numbers appear first) */
        $lte?: number;
      };
  slug?:
    | string
    | {
        $in?: string[];
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminConsentFormsByIdRes = /** status 200 Successful read */ {
  /** Whether this consent form is currently active and available to users */
  active?: boolean;
  /** Label text for the agreement button */
  agreeButtonText?: string;
  /** Whether users are allowed to decline the consent form */
  allowDecline?: boolean;
  /** Whether to require a drawn or typed signature when the user agrees */
  captureSignature?: boolean;
  /** List of checkboxes the user must interact with before agreeing */
  checkboxes?: {
    /** Optional prompt shown when the user checks this checkbox */
    confirmationPrompt?: string;
    /** Display label for the checkbox */
    label: string;
    /** Whether this checkbox must be checked before the user can agree */
    required?: boolean;
    _id?: string;
  }[];
  /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
  content: {
    [key: string]: string;
  };
  /** Label text for the decline button (only shown when allowDecline is true) */
  declineButtonText?: string;
  /** Default locale to use when the requested locale is not available */
  defaultLocale?: string;
  /** Display order relative to other consent forms (lower numbers appear first) */
  order: number;
  /** Whether users must complete this form before accessing the application */
  required?: boolean;
  /** Whether users must scroll to the bottom of the form content before agreeing */
  requireScrollToBottom?: boolean;
  /** URL-safe identifier for this form, combined with version to uniquely identify a form */
  slug: string;
  /** Human-readable title of the consent form */
  title: string;
  /** Category of consent form */
  type: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
  /** Version number of this form. Incrementing the version requires users to re-consent */
  version: number;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminConsentFormsByIdArgs = string;
export type PatchAdminConsentFormsByIdRes = /** status 200 Successful update */ {
  /** Whether this consent form is currently active and available to users */
  active?: boolean;
  /** Label text for the agreement button */
  agreeButtonText?: string;
  /** Whether users are allowed to decline the consent form */
  allowDecline?: boolean;
  /** Whether to require a drawn or typed signature when the user agrees */
  captureSignature?: boolean;
  /** List of checkboxes the user must interact with before agreeing */
  checkboxes?: {
    /** Optional prompt shown when the user checks this checkbox */
    confirmationPrompt?: string;
    /** Display label for the checkbox */
    label: string;
    /** Whether this checkbox must be checked before the user can agree */
    required?: boolean;
    _id?: string;
  }[];
  /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
  content: {
    [key: string]: string;
  };
  /** Label text for the decline button (only shown when allowDecline is true) */
  declineButtonText?: string;
  /** Default locale to use when the requested locale is not available */
  defaultLocale?: string;
  /** Display order relative to other consent forms (lower numbers appear first) */
  order: number;
  /** Whether users must complete this form before accessing the application */
  required?: boolean;
  /** Whether users must scroll to the bottom of the form content before agreeing */
  requireScrollToBottom?: boolean;
  /** URL-safe identifier for this form, combined with version to uniquely identify a form */
  slug: string;
  /** Human-readable title of the consent form */
  title: string;
  /** Category of consent form */
  type: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
  /** Version number of this form. Incrementing the version requires users to re-consent */
  version: number;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchAdminConsentFormsByIdArgs = {
  id: string;
  body: {
    /** Whether this consent form is currently active and available to users */
    active?: boolean;
    /** Label text for the agreement button */
    agreeButtonText?: string;
    /** Whether users are allowed to decline the consent form */
    allowDecline?: boolean;
    /** Whether to require a drawn or typed signature when the user agrees */
    captureSignature?: boolean;
    /** List of checkboxes the user must interact with before agreeing */
    checkboxes?: {
      /** Optional prompt shown when the user checks this checkbox */
      confirmationPrompt?: string;
      /** Display label for the checkbox */
      label: string;
      /** Whether this checkbox must be checked before the user can agree */
      required?: boolean;
      _id?: string;
    }[];
    /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
    content?: {
      [key: string]: string;
    };
    /** Label text for the decline button (only shown when allowDecline is true) */
    declineButtonText?: string;
    /** Default locale to use when the requested locale is not available */
    defaultLocale?: string;
    /** Display order relative to other consent forms (lower numbers appear first) */
    order?: number;
    /** Whether users must complete this form before accessing the application */
    required?: boolean;
    /** Whether users must scroll to the bottom of the form content before agreeing */
    requireScrollToBottom?: boolean;
    /** URL-safe identifier for this form, combined with version to uniquely identify a form */
    slug?: string;
    /** Human-readable title of the consent form */
    title?: string;
    /** Category of consent form */
    type?: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
    /** Version number of this form. Incrementing the version requires users to re-consent */
    version?: number;
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteAdminConsentFormsByIdRes = unknown;
export type DeleteAdminConsentFormsByIdArgs = string;
export type PostAdminConsentResponsesBulkPatchRes = /** status 200 Success */ {
  failures?: any;
  updated?: number;
};
export type PostAdminConsentResponsesBulkPatchArgs = {
  /** Document ids to update */
  ids: string[];
  /** Partial document; keys must be allowlisted for this model */
  patch: object;
};
export type GetAdminConsentResponsesRes = /** status 200 Successful list */ {
  data?: {
    /** Whether the user agreed (true) or declined (false) the consent form */
    agreed: boolean;
    /** Timestamp when the user submitted their agreement or declination */
    agreedAt: string;
    /** Map of checkbox index to boolean indicating whether each checkbox was checked */
    checkboxValues?: {
      [key: string]: boolean;
    };
    consentFormId: {
      /** Human-readable title of the consent form */
      title?: string;
      /** URL-safe identifier for this form, combined with version to uniquely identify a form */
      slug?: string;
      /** Version number of this form. Incrementing the version requires users to re-consent */
      version?: number;
      /** Category of consent form */
      type?: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
    };
    /** Snapshot of the form content in the user's locale at the time of response */
    contentSnapshot?: string;
    /** Version number of the form at the time the user responded */
    formVersionSnapshot?: number;
    /** IP address of the user at the time of response, captured for audit purposes */
    ipAddress?: string;
    /** Locale code of the content version the user viewed when responding */
    locale: string;
    /** Base64-encoded signature image or typed signature text, if captured */
    signature?: string;
    /** Timestamp when the user provided their signature */
    signedAt?: string;
    /** User-agent string of the browser or app used to submit the response */
    userAgent?: string;
    userId: {
      /** The user's display name */
      name?: string;
      /** The user's email address, used for authentication */
      email?: string;
    };
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminConsentResponsesArgs = {
  _id?: {
    $in?: string[];
  };
  q?:
    | any
    | {
        $in?: any[];
      };
  userId?:
    | any
    | {
        $in?: any[];
      };
  agreed?:
    | boolean
    | {
        $in?: boolean[];
      };
  locale?:
    | string
    | {
        $in?: string[];
      };
  agreedAt?:
    | string
    | {
        /** Timestamp when the user submitted their agreement or declination */
        $gt?: string;
        /** Timestamp when the user submitted their agreement or declination */
        $gte?: string;
        /** Timestamp when the user submitted their agreement or declination */
        $lt?: string;
        /** Timestamp when the user submitted their agreement or declination */
        $lte?: string;
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminConsentResponsesByIdRes = /** status 200 Successful read */ {
  /** Whether the user agreed (true) or declined (false) the consent form */
  agreed: boolean;
  /** Timestamp when the user submitted their agreement or declination */
  agreedAt: string;
  /** Map of checkbox index to boolean indicating whether each checkbox was checked */
  checkboxValues?: {
    [key: string]: boolean;
  };
  consentFormId: {
    /** Human-readable title of the consent form */
    title?: string;
    /** URL-safe identifier for this form, combined with version to uniquely identify a form */
    slug?: string;
    /** Version number of this form. Incrementing the version requires users to re-consent */
    version?: number;
    /** Category of consent form */
    type?: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
  };
  /** Snapshot of the form content in the user's locale at the time of response */
  contentSnapshot?: string;
  /** Version number of the form at the time the user responded */
  formVersionSnapshot?: number;
  /** IP address of the user at the time of response, captured for audit purposes */
  ipAddress?: string;
  /** Locale code of the content version the user viewed when responding */
  locale: string;
  /** Base64-encoded signature image or typed signature text, if captured */
  signature?: string;
  /** Timestamp when the user provided their signature */
  signedAt?: string;
  /** User-agent string of the browser or app used to submit the response */
  userAgent?: string;
  userId: {
    /** The user's display name */
    name?: string;
    /** The user's email address, used for authentication */
    email?: string;
  };
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminConsentResponsesByIdArgs = string;
export type PostAdminTodosBulkPatchRes = /** status 200 Success */ {
  failures?: any;
  updated?: number;
};
export type PostAdminTodosBulkPatchArgs = {
  /** Document ids to update */
  ids: string[];
  /** Partial document; keys must be allowlisted for this model */
  patch: object;
};
export type PostAdminTodosRes = /** status 201 Successful create */ {
  /** The document id (String so offline sync clients can mint ids) */
  _id: string;
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: string;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type PostAdminTodosArgs = {
  /** The document id (String so offline sync clients can mint ids) */
  _id?: string;
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId?: string;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type GetAdminTodosRes = /** status 200 Successful list */ {
  data?: {
    /** The document id (String so offline sync clients can mint ids) */
    _id: string;
    /** Whether the todo item has been completed */
    completed?: boolean;
    /** The user who owns this todo */
    ownerId: string;
    /** Priority level of the todo */
    priority?: "low" | "medium" | "high";
    /** Free-form tags for categorization */
    tags?: string[];
    /** The title of the todo item */
    title: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
    /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
    _syncPrevStream?: string;
    /** Monotonic per-stream sequence stamped on every synced write */
    _syncSeq?: number;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminTodosArgs = {
  _id?: {
    $in?: string[];
  };
  q?:
    | any
    | {
        $in?: any[];
      };
  title?:
    | string
    | {
        $in?: string[];
      };
  completed?:
    | boolean
    | {
        $in?: boolean[];
      };
  ownerId?:
    | any
    | {
        $in?: any[];
      };
  created?:
    | string
    | {
        /** When this document was created */
        $gt?: string;
        /** When this document was created */
        $gte?: string;
        /** When this document was created */
        $lt?: string;
        /** When this document was created */
        $lte?: string;
      };
  priority?:
    | ("low" | "medium" | "high")
    | {
        $in?: string[];
      };
  tags?:
    | string[]
    | {
        $in?: any[];
      };
  createdGte?:
    | any
    | {
        $in?: any[];
      };
  createdLte?:
    | any
    | {
        $in?: any[];
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminTodosByIdRes = /** status 200 Successful read */ {
  /** The document id (String so offline sync clients can mint ids) */
  _id: string;
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: string;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type GetAdminTodosByIdArgs = string;
export type PatchAdminTodosByIdRes = /** status 200 Successful update */ {
  /** The document id (String so offline sync clients can mint ids) */
  _id: string;
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: string;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
  /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
  _syncPrevStream?: string;
  /** Monotonic per-stream sequence stamped on every synced write */
  _syncSeq?: number;
};
export type PatchAdminTodosByIdArgs = {
  id: string;
  body: {
    /** The document id (String so offline sync clients can mint ids) */
    _id?: string;
    /** Whether the todo item has been completed */
    completed?: boolean;
    /** The user who owns this todo */
    ownerId?: string;
    /** Priority level of the todo */
    priority?: "low" | "medium" | "high";
    /** Free-form tags for categorization */
    tags?: string[];
    /** The title of the todo item */
    title?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
    /** The document's previous sync stream, set when a write moved it between scopes; null when the last write did not move it */
    _syncPrevStream?: string;
    /** Monotonic per-stream sequence stamped on every synced write */
    _syncSeq?: number;
  };
};
export type PostAdminUsersBulkPatchRes = /** status 200 Success */ {
  failures?: any;
  updated?: number;
};
export type PostAdminUsersBulkPatchArgs = {
  /** Document ids to update */
  ids: string[];
  /** Partial document; keys must be allowlisted for this model */
  patch: object;
};
export type PostAdminUsersRes = /** status 201 Successful create */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
  organizationIds?: string[];
  _id: string;
  hash?: string;
  salt?: string;
  /** RBAC role names assigned to this user */
  roles?: string[];
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostAdminUsersArgs = {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email?: string;
  /** The user's display name */
  name?: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
  organizationIds?: string[];
  _id?: string;
  hash?: string;
  salt?: string;
  /** RBAC role names assigned to this user */
  roles?: string[];
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminUsersRes = /** status 200 Successful list */ {
  data?: {
    /** Whether the user has admin privileges */
    admin?: boolean;
    /** Identifier linking to the Better Auth session provider */
    betterAuthId?: string;
    /** The user's email address, used for authentication */
    email: string;
    /** The user's display name */
    name: string;
    /** OAuth provider used for authentication */
    oauthProvider?: "google" | "github" | "apple" | null;
    /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
    organizationIds?: string[];
    _id: string;
    hash?: string;
    salt?: string;
    /** RBAC role names assigned to this user */
    roles?: string[];
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminUsersArgs = {
  _id?: {
    $in?: string[];
  };
  q?:
    | any
    | {
        $in?: any[];
      };
  email?:
    | string
    | {
        $in?: string[];
      };
  name?:
    | string
    | {
        $in?: string[];
      };
  admin?:
    | boolean
    | {
        $in?: boolean[];
      };
  created?:
    | string
    | {
        /** When this document was created */
        $gt?: string;
        /** When this document was created */
        $gte?: string;
        /** When this document was created */
        $lt?: string;
        /** When this document was created */
        $lte?: string;
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminUsersByIdRes = /** status 200 Successful read */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
  organizationIds?: string[];
  _id: string;
  hash?: string;
  salt?: string;
  /** RBAC role names assigned to this user */
  roles?: string[];
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminUsersByIdArgs = string;
export type PatchAdminUsersByIdRes = /** status 200 Successful update */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
  organizationIds?: string[];
  _id: string;
  hash?: string;
  salt?: string;
  /** RBAC role names assigned to this user */
  roles?: string[];
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchAdminUsersByIdArgs = {
  id: string;
  body: {
    /** Whether the user has admin privileges */
    admin?: boolean;
    /** Identifier linking to the Better Auth session provider */
    betterAuthId?: string;
    /** The user's email address, used for authentication */
    email?: string;
    /** The user's display name */
    name?: string;
    /** OAuth provider used for authentication */
    oauthProvider?: "google" | "github" | "apple" | null;
    /** Organizations (tenants) the user belongs to, used for tenant-scoped sync */
    organizationIds?: string[];
    _id?: string;
    hash?: string;
    salt?: string;
    /** RBAC role names assigned to this user */
    roles?: string[];
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteAdminUsersByIdRes = unknown;
export type DeleteAdminUsersByIdArgs = string;
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
  useGetAiModelsQuery,
  usePostAiExampleSummarizeMutation,
  usePostGptHistoriesMutation,
  useGetGptHistoriesQuery,
  useGetGptHistoriesByIdQuery,
  usePatchGptHistoriesByIdMutation,
  useDeleteGptHistoriesByIdMutation,
  usePostGptPromptMutation,
  usePatchGptHistoriesByIdRatingMutation,
  usePostGptRemixMutation,
  useGetGptToolsQuery,
  usePostAdminUsersByIdPasswordMutation,
  useGetSettingsGcsQuery,
  usePostSettingsGcsMutation,
  useDeleteSettingsGcsMutation,
  usePostLoadtestTodosGenerateMutation,
  usePostLoadtestTodosChurnMutation,
  usePostLoadtestTodosClearMutation,
  usePostCommsDevTestPushMutation,
  useTodosMarkCompleteMutation,
  useTodosBulkCompleteMutation,
  usePostTodosMutation,
  useGetTodosQuery,
  useGetTodosByIdQuery,
  usePatchTodosByIdMutation,
  useDeleteTodosByIdMutation,
  usePostProjectsMutation,
  useGetProjectsQuery,
  useGetProjectsByIdQuery,
  usePatchProjectsByIdMutation,
  useDeleteProjectsByIdMutation,
  usePostUsersMutation,
  useGetUsersQuery,
  useGetUsersByIdQuery,
  usePatchUsersByIdMutation,
  useDeleteUsersByIdMutation,
  usePostCommsPushTokensMutation,
  useGetCommsPushTokensQuery,
  useDeleteCommsPushTokensByIdMutation,
  useGetCommsPushTokensByIdQuery,
  useGetCommsMessagesQuery,
  usePostCommsMessagesRetryManyMutation,
  useGetCommsMessagesByIdQuery,
  usePostCommsMessagesByIdRetryMutation,
  useGetCommsStatsQuery,
  usePostFeatureFlagsFlagsMutation,
  useGetFeatureFlagsFlagsQuery,
  useGetFeatureFlagsFlagsByIdQuery,
  usePatchFeatureFlagsFlagsByIdMutation,
  useDeleteFeatureFlagsFlagsByIdMutation,
  useGetAiObservabilityStatusQuery,
  useGetAiObservabilityPromptsQuery,
  usePostAiObservabilityPromptsMutation,
  useGetAiObservabilityPromptsByNameQuery,
  usePostAiObservabilityPromptsByNameVersionsMutation,
  usePostAiObservabilityPromptsByNameLabelsMutation,
  usePostAiObservabilityPromptsByNamePlaygroundMutation,
  useGetAiObservabilityTracesQuery,
  useGetAiObservabilityTracesByIdQuery,
  usePostAiObservabilityTracesByIdScoresMutation,
  useGetAiObservabilityEvaluatorsTemplatesQuery,
  usePostAiObservabilityEvaluatorsTemplatesByNameMutation,
  useGetAiObservabilityEvaluatorsQuery,
  usePostAiObservabilityEvaluatorsMutation,
  useGetAiObservabilityEvaluatorsByIdQuery,
  usePatchAiObservabilityEvaluatorsByIdMutation,
  useDeleteAiObservabilityEvaluatorsByIdMutation,
  usePostAiObservabilityTracesReviewMutation,
  useGetAiObservabilityReviewQuery,
  useGetAiObservabilityReviewByIdQuery,
  usePostAiObservabilityReviewByIdMutation,
  useGetAdminConfigQuery,
  usePostAdminBackgroundTasksMutation,
  usePostAdminAuditLogsBulkPatchMutation,
  useGetAdminAuditLogsQuery,
  useGetAdminAuditLogsByIdQuery,
  usePostAdminFeatureFlagsBulkPatchMutation,
  usePostAdminFeatureFlagsMutation,
  useGetAdminFeatureFlagsQuery,
  useGetAdminFeatureFlagsByIdQuery,
  usePatchAdminFeatureFlagsByIdMutation,
  useDeleteAdminFeatureFlagsByIdMutation,
  usePostAdminConsentFormsBulkPatchMutation,
  usePostAdminConsentFormsMutation,
  useGetAdminConsentFormsQuery,
  useGetAdminConsentFormsByIdQuery,
  usePatchAdminConsentFormsByIdMutation,
  useDeleteAdminConsentFormsByIdMutation,
  usePostAdminConsentResponsesBulkPatchMutation,
  useGetAdminConsentResponsesQuery,
  useGetAdminConsentResponsesByIdQuery,
  usePostAdminTodosBulkPatchMutation,
  usePostAdminTodosMutation,
  useGetAdminTodosQuery,
  useGetAdminTodosByIdQuery,
  usePatchAdminTodosByIdMutation,
  usePostAdminUsersBulkPatchMutation,
  usePostAdminUsersMutation,
  useGetAdminUsersQuery,
  useGetAdminUsersByIdQuery,
  usePatchAdminUsersByIdMutation,
  useDeleteAdminUsersByIdMutation,
} = injectedRtkApi;
