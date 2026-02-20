export const validate{{Name}} = (values: {{Name}}FormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

{{validationRules}}

  return errors;
};

export const isValid{{Name}} = (values: {{Name}}FormValues): boolean => {
  const errors = validate{{Name}}(values);
  return Object.keys(errors).length === 0;
};
