/**
 * Shared consent business logic used by both the authenticated in-app routes
 * and the public signed-link routes, so behavior stays identical.
 */
import {DateTime} from "luxon";
import type mongoose from "mongoose";
import type {User} from "./auth";
import {hashConsentLinkToken} from "./consentLinkTokens";
import {APIError} from "./errors";
import {ConsentForm} from "./models/consentForm";
import {ConsentLink} from "./models/consentLink";
import {ConsentResponse} from "./models/consentResponse";
import type {ConsentFormDocument} from "./types/consentForm";
import type {ConsentLinkDocument} from "./types/consentLink";
import type {ConsentResponseDocument} from "./types/consentResponse";

export type ResolveConsentForms = (
  user: User,
  forms: ConsentFormDocument[]
) => ConsentFormDocument[] | Promise<ConsentFormDocument[]>;

interface GetPendingFormsParams {
  user: User;
  resolveConsentForms?: ResolveConsentForms;
  // When provided (and non-empty), only forms whose id is in this list are considered.
  formIds?: (mongoose.Types.ObjectId | string)[];
}

/**
 * Returns the consent forms a user still needs to complete: active forms,
 * optionally restricted to `formIds`, filtered through `resolveConsentForms`,
 * minus those the user has already responded to at the current form version.
 */
export const getPendingFormsForUser = async ({
  user,
  resolveConsentForms,
  formIds,
}: GetPendingFormsParams): Promise<ConsentFormDocument[]> => {
  const activeForms = await ConsentForm.find({active: true}).sort({order: 1});

  let resolvedForms: ConsentFormDocument[] = resolveConsentForms
    ? await resolveConsentForms(user, activeForms)
    : activeForms;

  if (formIds && formIds.length > 0) {
    const allowed = new Set(formIds.map((id) => id.toString()));
    resolvedForms = resolvedForms.filter((form) => allowed.has(form._id.toString()));
  }

  const existingResponses = await ConsentResponse.find({userId: user.id});

  const pendingForms = resolvedForms.filter((form) => {
    const formId = form._id.toString();
    const matchingResponses = existingResponses.filter(
      (r) => r.consentFormId.toString() === formId
    );
    if (matchingResponses.length === 0) {
      return true;
    }
    return !matchingResponses.some((r) => r.formVersionSnapshot === form.version);
  });

  return pendingForms;
};

export interface ConsentResponseBody {
  agreed?: unknown;
  checkboxValues?: Record<string, boolean>;
  consentFormId?: string;
  locale?: string;
  signature?: string;
}

interface RecordConsentResponseParams {
  userId: mongoose.Types.ObjectId | string;
  body: ConsentResponseBody;
  auditTrail?: boolean;
  auditInfo?: {ipAddress?: string; userAgent?: string};
  submittedViaLinkId?: mongoose.Types.ObjectId;
  // When provided, the submitted consentFormId must be one of these (link scoping).
  allowedFormIds?: (mongoose.Types.ObjectId | string)[];
}

/**
 * Validates and persists a consent response for the given user. Encapsulates
 * all validation (form active, required signature, required checkboxes) and
 * audit-field capture shared by the in-app and link flows.
 */
export const recordConsentResponse = async ({
  userId,
  body,
  auditTrail,
  auditInfo,
  submittedViaLinkId,
  allowedFormIds,
}: RecordConsentResponseParams): Promise<ConsentResponseDocument> => {
  const {agreed, checkboxValues, consentFormId, locale, signature} = body;

  if (!consentFormId) {
    throw new APIError({status: 400, title: "consentFormId is required"});
  }
  if (agreed === undefined || agreed === null) {
    throw new APIError({status: 400, title: "agreed field is required"});
  }
  if (!locale) {
    throw new APIError({status: 400, title: "locale is required"});
  }

  if (allowedFormIds && allowedFormIds.length > 0) {
    const allowed = new Set(allowedFormIds.map((id) => id.toString()));
    if (!allowed.has(consentFormId.toString())) {
      throw new APIError({
        status: 403,
        title: "This consent link does not grant access to that form",
      });
    }
  }

  const form = await ConsentForm.findExactlyOne(
    {_id: consentFormId},
    {status: 404, title: "Consent form not found"}
  );

  if (!form.active) {
    throw new APIError({status: 400, title: "Consent form is not active"});
  }

  if (form.captureSignature && agreed && !signature) {
    throw new APIError({
      status: 400,
      title: "Signature is required for this consent form",
    });
  }

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
    formVersionSnapshot: form.version,
    locale,
    userId,
  };

  if (checkboxValues !== undefined) {
    responseData.checkboxValues = checkboxValues;
  }

  if (signature) {
    responseData.signature = signature;
    responseData.signedAt = DateTime.now().toJSDate();
  }

  if (submittedViaLinkId) {
    responseData.submittedViaLinkId = submittedViaLinkId;
  }

  if (auditTrail) {
    responseData.ipAddress = auditInfo?.ipAddress;
    responseData.userAgent = auditInfo?.userAgent;
    responseData.contentSnapshot = form.content.get(locale) ?? form.content.get(form.defaultLocale);
  }

  return ConsentResponse.create(responseData);
};

/**
 * Looks up and validates a signed consent link by its raw token. Throws an
 * APIError (404 if unknown, 410 if revoked/expired/exhausted) otherwise returns
 * the link document. External error tracking is disabled to avoid noise from
 * link scanners.
 */
export const resolveConsentLink = async (token: string): Promise<ConsentLinkDocument> => {
  const notFound = new APIError({
    disableExternalErrorTracking: true,
    status: 404,
    title: "Consent link not found",
  });

  if (!token) {
    throw notFound;
  }

  const tokenHash = hashConsentLinkToken(token);
  const link = await ConsentLink.findOneOrNone({tokenHash});

  if (!link) {
    throw notFound;
  }

  if (link.revoked) {
    throw new APIError({
      disableExternalErrorTracking: true,
      status: 410,
      title: "This consent link has been revoked",
    });
  }

  if (DateTime.fromJSDate(link.expiresAt) < DateTime.now()) {
    throw new APIError({
      disableExternalErrorTracking: true,
      status: 410,
      title: "This consent link has expired",
    });
  }

  if (link.maxUses > 0 && link.useCount >= link.maxUses) {
    throw new APIError({
      disableExternalErrorTracking: true,
      status: 410,
      title: "This consent link has already been used",
    });
  }

  return link;
};
