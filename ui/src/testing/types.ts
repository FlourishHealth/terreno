/** Shared test id surface for @terreno/ui components. */
export interface WithTestID {
  /** Root test id for the primary interactive element or container. */
  testID?: string;
}

/** Sub-element test ids for compound form fields. */
export interface FieldTestIDs {
  label?: string;
  input?: string;
  error?: string;
  helper?: string;
}

/** Sub-element test ids for Modal. */
export interface ModalTestIDs {
  root?: string;
  title?: string;
  primaryButton?: string;
  secondaryButton?: string;
  dismiss?: string;
}

/** Sub-element test ids for DataTable. */
export interface DataTableTestIDs {
  root?: string;
  header?: string;
  body?: string;
  row?: string;
  pagination?: string;
}

/** Sub-element test ids for SegmentedControl. */
export interface SegmentedControlTestIDs {
  root?: string;
  previousButton?: string;
  nextButton?: string;
}

export interface ResolvedFieldTestIDs {
  label?: string;
  input?: string;
  error?: string;
  helper?: string;
}

export interface ResolvedModalTestIDs {
  root?: string;
  title?: string;
  primaryButton?: string;
  secondaryButton?: string;
  dismiss?: string;
}

export interface ResolvedDataTableTestIDs {
  root?: string;
  header?: string;
  body?: string;
  row?: string;
  pagination?: string;
}

export interface ResolvedSegmentedControlTestIDs {
  root?: string;
  previousButton?: string;
  nextButton?: string;
}
