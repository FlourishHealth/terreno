/**
 * ConsentApp plugin for @terreno/api.
 *
 * Registers consent form management and user consent response routes as a TerrenoPlugin.
 * Provides admin CRUD for consent forms, read-only access to responses, and user-facing
 * endpoints for fetching pending consents and submitting responses.
 */

import {type Application, Router} from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import ms, {type StringValue} from "ms";
import type {CollectionActionConfig} from "./actions";
import {asyncHandler, modelRouter} from "./api";
import type {User} from "./auth";
import {authenticateMiddleware} from "./auth";
import {getPendingFormsForUser, recordConsentResponse, resolveConsentLink} from "./consentHelpers";
import {generateConsentLinkToken, hashConsentLinkToken} from "./consentLinkTokens";
import {APIError} from "./errors";
import {logger} from "./logger";
import {ConsentForm} from "./models/consentForm";
import {ConsentLink} from "./models/consentLink";
import {ConsentResponse} from "./models/consentResponse";
import {Permissions} from "./permissions";
import type {TerrenoPlugin} from "./terrenoPlugin";
import type {ConsentFormDocument} from "./types/consentForm";
import type {ConsentLinkDocument} from "./types/consentLink";

const DEFAULT_LINK_EXPIRES_IN = "14d";

export interface SignedLinksConfig {
  enabled: boolean;
  // Base URL the generated link points at. The raw token is appended as ?token=...
  linkBaseUrl: string;
  // Default link lifetime, parsed with `ms` (e.g. "14d", "48h"). Defaults to 14 days.
  defaultExpiresIn?: string;
}

const serializeConsentLink = (link: ConsentLinkDocument): Record<string, unknown> => {
  const obj = link.toObject() as Record<string, unknown>;
  // Never expose the token hash to clients.
  obj.tokenHash = undefined;
  return obj;
};

export interface ConsentAppOptions {
  auditTrail?: boolean;
  aiConfig?: {
    generateContent: (params: {
      type: string;
      description: string;
      locale: string;
    }) => Promise<string>;
    translateContent: (params: {
      content: string;
      fromLocale: string;
      toLocale: string;
    }) => Promise<string>;
  };
  resolveConsentForms?: (
    user: User,
    forms: ConsentFormDocument[]
  ) => ConsentFormDocument[] | Promise<ConsentFormDocument[]>;
  supportedLocales?: string[];
  // Enables per-user signed links so users can complete consents without logging in.
  signedLinks?: SignedLinksConfig;
}

const requireAdmin = (user: User | undefined): void => {
  if (!user?.admin) {
    throw new APIError({status: 403, title: "Admin access required"});
  }
};

export class ConsentApp implements TerrenoPlugin {
  private options: ConsentAppOptions;

  constructor(options: ConsentAppOptions = {}) {
    this.options = options;
  }

  register(app: Application): void {
    const {auditTrail, resolveConsentForms, aiConfig, signedLinks} = this.options;

    const collectionActions: Record<string, CollectionActionConfig<unknown, unknown, unknown>> = {};

    if (aiConfig) {
      collectionActions.generate = {
        handler: async ({body, user}) => {
          requireAdmin(user);
          const typedBody = body as {type?: string; description?: string; locale?: string};
          if (!typedBody.type) {
            throw new APIError({status: 400, title: "type is required"});
          }
          if (!typedBody.description) {
            throw new APIError({status: 400, title: "description is required"});
          }
          const locale = typedBody.locale ?? "en";
          const content = await aiConfig.generateContent({
            description: typedBody.description,
            locale,
            type: typedBody.type,
          });
          logger.info("ConsentForm content generated", {locale, type: typedBody.type});
          return {content};
        },
        method: "POST",
        permissions: [Permissions.IsAuthenticated],
        summary: "Generate consent form content with AI",
      };

      collectionActions.translate = {
        handler: async ({body, user}) => {
          requireAdmin(user);
          const typedBody = body as {
            content?: string;
            fromLocale?: string;
            toLocale?: string;
          };
          if (!typedBody.content) {
            throw new APIError({status: 400, title: "content is required"});
          }
          if (!typedBody.fromLocale) {
            throw new APIError({status: 400, title: "fromLocale is required"});
          }
          if (!typedBody.toLocale) {
            throw new APIError({status: 400, title: "toLocale is required"});
          }
          const translated = await aiConfig.translateContent({
            content: typedBody.content,
            fromLocale: typedBody.fromLocale,
            toLocale: typedBody.toLocale,
          });
          logger.info("ConsentForm content translated", {
            fromLocale: typedBody.fromLocale,
            toLocale: typedBody.toLocale,
          });
          return {content: translated};
        },
        method: "POST",
        permissions: [Permissions.IsAuthenticated],
        summary: "Translate consent form content with AI",
      };
    }

    app.use(
      "/consent-forms",
      modelRouter(ConsentForm, {
        collectionActions,
        instanceActions: {
          publish: {
            handler: async ({doc, user}) => {
              requireAdmin(user);
              const form = doc as ConsentFormDocument;

              const newFormData = {
                active: true,
                agreeButtonText: form.agreeButtonText,
                allowDecline: form.allowDecline,
                captureSignature: form.captureSignature,
                checkboxes: form.checkboxes,
                content: form.content,
                declineButtonText: form.declineButtonText,
                defaultLocale: form.defaultLocale,
                order: form.order,
                required: form.required,
                requireScrollToBottom: form.requireScrollToBottom,
                slug: form.slug,
                title: form.title,
                type: form.type,
                version: form.version + 1,
              };

              const newForm = await ConsentForm.create(newFormData);

              await ConsentForm.updateMany(
                {_id: {$ne: newForm._id}, slug: form.slug},
                {active: false}
              );

              logger.info("ConsentForm published", {
                newVersion: newForm.version,
                slug: newForm.slug,
              });

              return newForm;
            },
            method: "POST",
            permissions: [Permissions.IsAuthenticated],
            summary: "Publish a new version of a consent form",
          },
        },
        permissions: {
          create: [Permissions.IsAdmin],
          delete: [Permissions.IsAdmin],
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: [Permissions.IsAdmin],
        },
        queryFields: ["slug", "type", "active", "version"],
        sort: "order",
      })
    );

    // Admin read-only access to consent responses
    app.use(
      "/consent-responses",
      modelRouter(ConsentResponse, {
        permissions: {
          create: [],
          delete: [],
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: [],
        },
        populatePaths: [
          {
            fields: ["title", "slug", "version", "type"],
            path: "consentFormId",
          },
        ],
      })
    );

    // User-facing consent endpoints
    const router = Router();

    // GET /consents/pending - fetch pending consent forms for the current user
    router.get(
      "/pending",
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        const user = req.user as User | undefined;
        if (!user) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        logger.debug("Fetching pending consent forms", {userId: user.id});

        const pendingForms = await getPendingFormsForUser({resolveConsentForms, user});

        logger.info("Pending consent forms fetched", {
          pendingFormCount: pendingForms.length,
          userAdmin: Boolean(user.admin),
          userId: user.id,
        });

        return res.json({data: pendingForms});
      })
    );

    // POST /consents/respond - submit a consent response
    router.post(
      "/respond",
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        const user = req.user as User | undefined;
        if (!user) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const response = await recordConsentResponse({
          auditInfo: {ipAddress: req.ip, userAgent: req.headers["user-agent"]},
          auditTrail,
          body: req.body,
          userId: user.id,
        });

        logger.info("Consent response recorded", {
          agreed: response.agreed,
          consentFormId: response.consentFormId.toString(),
          locale: response.locale,
          userId: user.id,
        });

        return res.json({data: response});
      })
    );

    // GET /consents/my - fetch the current user's consent responses with form data
    router.get(
      "/my",
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        const user = req.user as User | undefined;
        if (!user) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const responses = await ConsentResponse.find({userId: user.id}).sort({agreedAt: -1});

        const formIds = responses.map((r) => r.consentFormId);
        const forms = await ConsentForm.find({_id: {$in: formIds}});
        const formMap = new Map(forms.map((f) => [f._id.toString(), f]));

        const data = responses.map((response) => {
          const form = formMap.get(response.consentFormId.toString());
          return {
            _id: response._id,
            agreed: response.agreed,
            agreedAt: response.agreedAt,
            checkboxValues: response.checkboxValues,
            contentSnapshot: response.contentSnapshot,
            form: form
              ? {
                  captureSignature: form.captureSignature,
                  checkboxes: form.checkboxes,
                  slug: form.slug,
                  title: form.title,
                  type: form.type,
                  version: form.version,
                }
              : null,
            formVersionSnapshot: response.formVersionSnapshot,
            ipAddress: response.ipAddress,
            locale: response.locale,
            signature: response.signature,
            signedAt: response.signedAt,
            userAgent: response.userAgent,
          };
        });

        return res.json({data});
      })
    );

    if (auditTrail) {
      router.get(
        "/audit/:userId",
        authenticateMiddleware(),
        asyncHandler(async (req, res) => {
          const user = req.user as User | undefined;
          if (!user?.admin) {
            throw new APIError({status: 403, title: "Admin access required"});
          }

          const responses = await ConsentResponse.find({userId: req.params.userId}).sort({
            agreedAt: -1,
          });

          const formIds = responses.map((r) => r.consentFormId);
          const forms = await ConsentForm.find({_id: {$in: formIds}});
          const formMap = new Map(forms.map((f) => [f._id.toString(), f]));

          const auditEntries = responses.map((response) => {
            const form = formMap.get(response.consentFormId.toString());
            return {
              agreed: response.agreed,
              agreedAt: response.agreedAt,
              contentSnapshot: response.contentSnapshot,
              form: form
                ? {
                    slug: form.slug,
                    title: form.title,
                    type: form.type,
                    version: form.version,
                  }
                : null,
              formVersionSnapshot: response.formVersionSnapshot,
              ipAddress: response.ipAddress,
              locale: response.locale,
              responseId: response._id,
              signedAt: response.signedAt,
              userAgent: response.userAgent,
            };
          });

          return res.json({data: auditEntries});
        })
      );
    }

    if (signedLinks?.enabled) {
      this.registerSignedLinkRoutes(router, signedLinks, {auditTrail, resolveConsentForms});
    }

    app.use("/consents", router);

    logger.info("ConsentApp registered", {
      auditTrail: Boolean(auditTrail),
      signedLinks: Boolean(signedLinks?.enabled),
    });
  }

  private registerSignedLinkRoutes(
    router: Router,
    signedLinks: SignedLinksConfig,
    deps: {
      auditTrail?: boolean;
      resolveConsentForms?: ConsentAppOptions["resolveConsentForms"];
    }
  ): void {
    const {auditTrail, resolveConsentForms} = deps;

    const resolveExpiresAt = (expiresIn?: string): Date => {
      const ttl = expiresIn ?? signedLinks.defaultExpiresIn ?? DEFAULT_LINK_EXPIRES_IN;
      let durationMs: number;
      try {
        const parsed = ms(ttl as StringValue);
        durationMs =
          typeof parsed === "number" && Number.isFinite(parsed)
            ? parsed
            : (ms(DEFAULT_LINK_EXPIRES_IN) as number);
      } catch {
        durationMs = ms(DEFAULT_LINK_EXPIRES_IN) as number;
      }
      return DateTime.now().plus({milliseconds: durationMs}).toJSDate();
    };

    const loadTargetUser = async (userId: unknown): Promise<User | null> => {
      const userModel = mongoose.models.User;
      if (!userModel) {
        return null;
      }
      try {
        return (await userModel.findById(userId as string)) as unknown as User | null;
      } catch {
        return null;
      }
    };

    // POST /consents/links - admin generates a signed link for a user
    router.post(
      "/links",
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        requireAdmin(req.user as User | undefined);

        const {consentFormIds, expiresIn, maxUses, note, userId} = req.body;
        if (!userId) {
          throw new APIError({status: 400, title: "userId is required"});
        }

        const targetUser = await loadTargetUser(userId);
        if (!targetUser) {
          throw new APIError({status: 404, title: "User not found"});
        }

        const token = generateConsentLinkToken();
        const tokenHash = hashConsentLinkToken(token);

        const link = await ConsentLink.create({
          consentFormIds,
          createdByUserId: (req.user as User | undefined)?.id,
          expiresAt: resolveExpiresAt(expiresIn),
          maxUses: maxUses ?? 1,
          note,
          tokenHash,
          userId,
        });

        logger.info("Consent link generated", {
          consentLinkId: link._id.toString(),
          createdBy: (req.user as User | undefined)?.id,
          userId: String(userId),
        });

        const separator = signedLinks.linkBaseUrl.includes("?") ? "&" : "?";
        const url = `${signedLinks.linkBaseUrl}${separator}token=${token}`;

        // The raw token is returned exactly once and never persisted.
        return res.json({
          data: {_id: link._id, expiresAt: link.expiresAt, token, url},
        });
      })
    );

    // GET /consents/links - admin lists generated links (no token exposed)
    router.get(
      "/links",
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        requireAdmin(req.user as User | undefined);

        const query: Record<string, unknown> = {};
        if (req.query.userId) {
          query.userId = req.query.userId;
        }

        const links = await ConsentLink.find(query).sort({created: -1}).limit(200);
        return res.json({data: links.map(serializeConsentLink)});
      })
    );

    // POST /consents/links/:id/revoke - admin revokes a link
    router.post(
      "/links/:id/revoke",
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        requireAdmin(req.user as User | undefined);

        const link = await ConsentLink.findExactlyOne(
          {_id: req.params.id},
          {status: 404, title: "Consent link not found"}
        );
        link.revoked = true;
        await link.save();

        logger.info("Consent link revoked", {consentLinkId: link._id.toString()});
        return res.json({data: serializeConsentLink(link)});
      })
    );

    // GET /consents/link/:token - public: resolve a link to the user's pending forms
    router.get(
      "/link/:token",
      asyncHandler(async (req, res) => {
        const link = await resolveConsentLink(req.params.token);

        const targetUser = await loadTargetUser(link.userId);
        if (!targetUser) {
          throw new APIError({
            disableExternalErrorTracking: true,
            status: 404,
            title: "User not found",
          });
        }

        const forms = await getPendingFormsForUser({
          formIds: link.consentFormIds,
          resolveConsentForms,
          user: targetUser,
        });

        const context = {
          expiresAt: link.expiresAt,
          formCount: forms.length,
          name: (targetUser as unknown as {name?: string}).name,
        };

        return res.json({data: {context, forms}});
      })
    );

    // POST /consents/link/:token/respond - public: submit a response via the link
    router.post(
      "/link/:token/respond",
      asyncHandler(async (req, res) => {
        const link = await resolveConsentLink(req.params.token);

        const response = await recordConsentResponse({
          allowedFormIds:
            link.consentFormIds && link.consentFormIds.length > 0 ? link.consentFormIds : undefined,
          auditInfo: {ipAddress: req.ip, userAgent: req.headers["user-agent"]},
          auditTrail,
          body: req.body,
          submittedViaLinkId: link._id,
          userId: link.userId,
        });

        link.useCount += 1;
        link.usedAt = DateTime.now().toJSDate();
        link.lastUsedIp = req.ip;
        await link.save();

        logger.info("Consent response recorded via signed link", {
          consentFormId: response.consentFormId.toString(),
          consentLinkId: link._id.toString(),
          userId: link.userId.toString(),
        });

        return res.json({data: response});
      })
    );
  }
}
