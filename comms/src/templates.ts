export interface CommsTemplate {
  html?: string;
  subject: string;
  text?: string;
}

export interface RenderTemplateOptions {
  data: Record<string, unknown>;
  template: CommsTemplate;
}

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

const interpolate = ({data, value}: {data: Record<string, unknown>; value: string}): string =>
  value.replace(TEMPLATE_VARIABLE_PATTERN, (placeholder, key: string): string => {
    const replacement = data[key];
    return replacement === undefined ? placeholder : String(replacement);
  });

export const renderTemplate = ({data, template}: RenderTemplateOptions): CommsTemplate => ({
  html: template.html === undefined ? undefined : interpolate({data, value: template.html}),
  subject: interpolate({data, value: template.subject}),
  text: template.text === undefined ? undefined : interpolate({data, value: template.text}),
});
