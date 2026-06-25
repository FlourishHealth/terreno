/** Shared test id surface for @terreno/ui components. */
export interface WithTestId {
  /** Root test id for the primary interactive element or container. */
  testId?: string;
  /**
   * @deprecated Use `testId` instead. Kept for backward compatibility.
   */
  testID?: string;
}

/** Sub-element test ids for compound form fields. */
export interface FieldTestIds {
  label?: string;
  input?: string;
  error?: string;
  helper?: string;
}

/** Sub-element test ids for Modal. */
export interface ModalTestIds {
  root?: string;
  title?: string;
  primaryButton?: string;
  secondaryButton?: string;
  dismiss?: string;
}

/** Sub-element test ids for DataTable. */
export interface DataTableTestIds {
  root?: string;
  header?: string;
  body?: string;
  row?: string;
  pagination?: string;
}

export interface ResolvedFieldTestIds {
  label?: string;
  input?: string;
  error?: string;
  helper?: string;
}

export interface ResolvedModalTestIds {
  root?: string;
  title?: string;
  primaryButton?: string;
  secondaryButton?: string;
  dismiss?: string;
}

export interface ResolvedDataTableTestIds {
  root?: string;
  header?: string;
  body?: string;
  row?: string;
  pagination?: string;
}
