/**
 * ConsentApp plugin for @terreno/api.
 *
 * Registers consent form management and user consent response routes as a TerrenoPlugin.
 * Provides admin CRUD for consent forms, read-only access to responses, and user-facing
 * endpoints for fetching pending consents and submitting responses.
 */

import type express from "express";
import {DateTime} from "luxon";
import {asyncHandler, modelRouter} from "./api";
import type {User} from "./auth";
import {authenticateMiddleware} from "./auth";
import {APIError} from "./errors";
import {logger} from "./logger";
import {ConsentForm} from "./models/consentForm";
import {ConsentResponse} from "./models/consentResponse";
import {Permissions} from "./permissions";
import type {TerrenoPlugin} from "./terrenoPlugin";
import type {ConsentFormDocument} from "./types/consentForm";

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
}

export class ConsentApp implements TerrenoPlugin {
  private options: ConsentAppOptions;

  constructor(options: ConsentAppOptions = {}) {
    this.options = options;
  }

  register(app: express.Application): void {
    const {auditTrail, resolveConsentForms, aiConfig} = this.options;

    // Admin CRUD for consent forms
    app.use(
      "/consent-forms",
      modelRouter(ConsentForm, {
        endpoints: (router) => {
          if (aiConfig) {
            // POST /consent-forms/generate - generate consent form content with AI
            router.post(
              "/generate",
              authenticateMiddleware(),
              asyncHandler(async (req, res) => {
                const user = req.user as User | undefined;
                if (!user?.admin) {
                  throw new APIError({status: 403, title: "Admin access required"});
                }

                const {type, description, locale = "en"} = req.body;
                if (!type) {
                  throw new APIError({status: 400, title: "type is required"});
                }
                if (!description) {
                  throw new APIError({status: 400, title: "description is required"});
                }

                const content = await aiConfig.generateContent({description, locale, type});

                logger.info("ConsentForm content generated", {locale, type});

                return res.json({data: {content}});
              })
            );

            // POST /consent-forms/translate - translate consent form content with AI
            router.post(
              "/translate",
              authenticateMiddleware(),
              asyncHandler(async (req, res) => {
                const user = req.user as User | undefined;
                if (!user?.admin) {
                  throw new APIError({status: 403, title: "Admin access required"});
                }

                const {content, fromLocale, toLocale} = req.body;
                if (!content) {
                  throw new APIError({status: 400, title: "content is required"});
                }
                if (!fromLocale) {
                  throw new APIError({status: 400, title: "fromLocale is required"});
                }
                if (!toLocale) {
                  throw new APIError({status: 400, title: "toLocale is required"});
                }

                const translated = await aiConfig.translateContent({content, fromLocale, toLocale});

                logger.info("ConsentForm content translated", {fromLocale, toLocale});

                return res.json({data: {content: translated}});
              })
            );
          }

          // POST /consent-forms/:id/publish - clone form with incremented version and activate
          router.post(
            "/:id/publish",
            authenticateMiddleware(),
            asyncHandler(async (req, res) => {
              const user = req.user as User | undefined;
              if (!user?.admin) {
                throw new APIError({status: 403, title: "Admin access required"});
              }

              const form = await ConsentForm.findExactlyOne({_id: req.params.id});

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

              // Deactivate all other versions of the same slug
              await ConsentForm.updateMany(
                {_id: {$ne: newForm._id}, slug: form.slug},
                {active: false}
              );

              logger.info("ConsentForm published", {
                newVersion: newForm.version,
                slug: newForm.slug,
              });

              return res.json({data: newForm});
            })
          );
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
    const router = require("express").Router() as express.Router;

    // GET /consents/pending - fetch pending consent forms for the current user
    router.get(
      "/pending",
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        const user = req.user as User | undefined;
        if (!user) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const activeForms = await ConsentForm.find({active: true}).sort({order: 1});

        let resolvedForms: ConsentFormDocument[];
        if (resolveConsentForms) {
          resolvedForms = await resolveConsentForms(user, activeForms);
        } else {
          resolvedForms = activeForms;
        }

        const existingResponses = await ConsentResponse.find({userId: user.id});

        const respondedFormVersions = new Map<string, number>();
        for (const response of existingResponses) {
          const formId = response.consentFormId.toString();
          respondedFormVersions.set(formId, response.formVersionSnapshot ?? 0);
        }

        // Fetch the forms corresponding to existing responses to check version matches
        const respondedFormIds = existingResponses.map((r) => r.consentFormId);
        const respondedForms = await ConsentForm.find({_id: {$in: respondedFormIds}});
        const formVersionByFormId = new Map<string, number>();
        for (const form of respondedForms) {
          formVersionByFormId.set(form._id.toString(), form.version);
        }

        // Filter out forms where the user already has a response matching the current version
        const pendingForms = resolvedForms.filter((form) => {
          const formId = form._id.toString();
          // Find responses for this form
          const matchingResponses = existingResponses.filter(
            (r) => r.consentFormId.toString() === formId
          );
          if (matchingResponses.length === 0) {
            return true;
          }
          // Check if any response matches the current form version
          return !matchingResponses.some((r) => r.formVersionSnapshot === form.version);
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

        const {agreed, checkboxValues, consentFormId, locale, signature} = req.body;

        if (!consentFormId) {
          throw new APIError({status: 400, title: "consentFormId is required"});
        }
        if (agreed === undefined || agreed === null) {
          throw new APIError({status: 400, title: "agreed field is required"});
        }
        if (!locale) {
          throw new APIError({status: 400, title: "locale is required"});
        }

        const form = await ConsentForm.findExactlyOne(
          {_id: consentFormId},
          {status: 404, title: "Consent form not found"}
        );

        if (!form.active) {
          throw new APIError({status: 400, title: "Consent form is not active"});
        }

        // Validate signature requirement
        if (form.captureSignature && agreed && !signature) {
          throw new APIError({
            status: 400,
            title: "Signature is required for this consent form",
          });
        }

        // Validate required checkboxes
        if (agreed && form.checkboxes.length > 0) {
          const values = checkboxValues ?? {};
          for (let i = 0; i < form.checkboxes.length; i++) {
            const checkbox = form.checkboxes[i];
            if (checkbox.required && !values[i.toString()]) {
              throw new APIError({
                status: 400,
                title: `Required checkbox "${checkbox.label}" must be checked`,
              });
            }
          }
        }

        const responseData: Record<string, unknown> = {
          agreed,
          agreedAt: DateTime.now().toJSDate(),
          consentFormId: form._id,
          locale,
          userId: user.id,
        };

        if (checkboxValues !== undefined) {
          responseData.checkboxValues = checkboxValues;
        }

        if (signature) {
          responseData.signature = signature;
          responseData.signedAt = DateTime.now().toJSDate();
        }

        if (auditTrail) {
          responseData.ipAddress = req.ip;
          responseData.userAgent = req.headers["user-agent"];
          responseData.contentSnapshot =
            form.content.get(locale) ?? form.content.get(form.defaultLocale);
          responseData.formVersionSnapshot = form.version;
        } else {
          responseData.formVersionSnapshot = form.version;
        }

        const response = await ConsentResponse.create(responseData);

        logger.info("Consent response recorded", {
          agreed,
          consentFormId: form._id.toString(),
          locale,
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

    // GET /consents/audit/:userId - admin audit trail for a specific user
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

    app.use("/consents", router);

    logger.info("ConsentApp registered", {auditTrail: Boolean(auditTrail)});
  }
}
