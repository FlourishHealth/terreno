import mongoose from "mongoose";
import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "../plugins";
import type {ConsentFormDocument, ConsentFormModel} from "../types/consentForm";

const consentFormTypeMap = {
  agreement: "agreement",
  custom: "custom",
  hipaa: "hipaa",
  privacy: "privacy",
  research: "research",
  terms: "terms",
} as const;

const consentFormTypeValues = Object.values(consentFormTypeMap);

const consentFormSchema = new mongoose.Schema<ConsentFormDocument, ConsentFormModel>(
  {
    active: {
      default: false,
      description: "Whether this consent form is currently active and available to users",
      type: Boolean,
    },
    agreeButtonText: {
      default: "I Agree",
      description: "Label text for the agreement button",
      type: String,
    },
    allowDecline: {
      default: false,
      description: "Whether users are allowed to decline the consent form",
      type: Boolean,
    },
    captureSignature: {
      default: false,
      description: "Whether to require a drawn or typed signature when the user agrees",
      type: Boolean,
    },
    checkboxes: {
      default: [],
      description: "List of checkboxes the user must interact with before agreeing",
      type: [
        {
          confirmationPrompt: {
            description: "Optional prompt shown when the user checks this checkbox",
            type: String,
          },
          label: {
            description: "Display label for the checkbox",
            required: true,
            type: String,
          },
          required: {
            default: false,
            description: "Whether this checkbox must be checked before the user can agree",
            type: Boolean,
          },
        },
      ],
    },
    content: {
      description:
        'Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\\n..."})',
      of: String,
      required: true,
      type: Map,
    },
    declineButtonText: {
      default: "Decline",
      description: "Label text for the decline button (only shown when allowDecline is true)",
      type: String,
    },
    defaultLocale: {
      default: "en",
      description: "Default locale to use when the requested locale is not available",
      type: String,
    },
    order: {
      default: 0,
      description: "Display order relative to other consent forms (lower numbers appear first)",
      required: true,
      type: Number,
    },
    required: {
      default: true,
      description: "Whether users must complete this form before accessing the application",
      type: Boolean,
    },
    requireScrollToBottom: {
      default: false,
      description: "Whether users must scroll to the bottom of the form content before agreeing",
      type: Boolean,
    },
    slug: {
      description:
        "URL-safe identifier for this form, combined with version to uniquely identify a form",
      index: true,
      required: true,
      trim: true,
      type: String,
    },
    title: {
      description: "Human-readable title of the consent form",
      required: true,
      trim: true,
      type: String,
    },
    type: {
      description: "Category of consent form",
      enum: consentFormTypeValues,
      required: true,
      type: String,
    },
    version: {
      default: 1,
      description:
        "Version number of this form. Incrementing the version requires users to re-consent",
      required: true,
      type: Number,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

consentFormSchema.index({slug: 1, version: 1}, {unique: true});

consentFormSchema.plugin(createdUpdatedPlugin);
consentFormSchema.plugin(isDeletedPlugin);
consentFormSchema.plugin(findOneOrNone);
consentFormSchema.plugin(findExactlyOne);

export const ConsentForm = mongoose.model<ConsentFormDocument, ConsentFormModel>(
  "ConsentForm",
  consentFormSchema
);
