export interface MessageTemplate {
  html?: string;
  subject: string;
  text?: string;
}

export interface RenderTemplateOptions {
  data: Record<string, unknown>;
  template: MessageTemplate;
}

export type AuthMailTemplateId = "resetPassword" | "verifyEmail";

export interface RenderAuthMailOptions {
  publicAppUrl: string;
  templateId: AuthMailTemplateId;
  token: string;
  templates?: Partial<Record<AuthMailTemplateId, MessageTemplate>>;
}

export const DEFAULT_AUTH_MAIL_TEMPLATES: Record<AuthMailTemplateId, MessageTemplate> = {
  resetPassword: {
    html: '<p><a href="{{resetUrl}}">Reset your password</a></p>',
    subject: "Reset your password",
    text: "Reset your password using this link: {{resetUrl}}",
  },
  verifyEmail: {
    html: '<p><a href="{{verifyUrl}}">Verify your email</a></p>',
    subject: "Verify your email",
    text: "Verify your email using this link: {{verifyUrl}}",
  },
};

const TEMPLATE_VARIABLE_PATTERN = /{{\s*([A-Za-z0-9_]+)\s*}}/g;

const interpolate = (value: string, data: Record<string, unknown>): string =>
  value.replace(TEMPLATE_VARIABLE_PATTERN, (_match: string, key: string): string => {
    if (Object.getOwnPropertyDescriptor(data, key) === undefined) {
      return "";
    }

    const replacement = data[key];
    if (replacement === null || replacement === undefined) {
      return "";
    }
    return String(replacement);
  });

export const renderTemplate = ({data, template}: RenderTemplateOptions): MessageTemplate => ({
  ...(template.html === undefined ? {} : {html: interpolate(template.html, data)}),
  subject: interpolate(template.subject, data),
  ...(template.text === undefined ? {} : {text: interpolate(template.text, data)}),
});

const authMailUrl = (publicAppUrl: string, path: string, token: string): string => {
  const base = publicAppUrl.replace(/\/$/, "");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
};

export const renderAuthMail = ({
  publicAppUrl,
  templateId,
  token,
  templates,
}: RenderAuthMailOptions): MessageTemplate => {
  const template = templates?.[templateId] ?? DEFAULT_AUTH_MAIL_TEMPLATES[templateId];
  const resetUrl = authMailUrl(publicAppUrl, "/resetPassword", token);
  const verifyUrl = authMailUrl(publicAppUrl, "/verifyEmail", token);
  return renderTemplate({
    data: {
      publicAppUrl: publicAppUrl.replace(/\/$/, ""),
      resetUrl,
      token,
      verifyUrl,
    },
    template,
  });
};
