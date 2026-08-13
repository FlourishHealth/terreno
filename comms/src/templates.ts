export interface MessageTemplate {
  html?: string;
  subject: string;
  text?: string;
}

export interface RenderTemplateOptions {
  data: Record<string, unknown>;
  template: MessageTemplate;
}

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
