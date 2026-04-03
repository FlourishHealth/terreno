const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export const createConsentForm = async (
  request: {
    post: (
      url: string,
      options?: Record<string, unknown>
    ) => Promise<{ok: () => boolean; json: () => Promise<Record<string, unknown>>}>;
  },
  token: string,
  options?: {checkboxes?: Array<{label: string; required: boolean}>}
): Promise<string> => {
  const slug = `e2e-test-consent-${Date.now()}`;
  const res = await request.post(`${API_URL}/consent-forms`, {
    data: {
      active: true,
      agreeButtonText: "I Agree",
      allowDecline: true,
      captureSignature: false,
      content: {en: "This is an E2E test consent form. Please agree to continue."},
      declineButtonText: "I Decline",
      defaultLocale: "en",
      order: 999,
      required: true,
      slug,
      title: "E2E Test Consent",
      type: "custom",
      ...(options?.checkboxes ? {checkboxes: options.checkboxes} : {}),
    },
    headers: {authorization: `Bearer ${token}`},
  });
  if (!res.ok()) {
    throw new Error(`Failed to create consent form: ${(await res.json()) as string}`);
  }
  const body = (await res.json()) as {data?: {_id?: string}};
  return body?.data?._id ?? "";
};

export const deleteConsentForm = async (
  request: {
    delete: (url: string, options?: Record<string, unknown>) => Promise<{ok: () => boolean}>;
  },
  token: string,
  formId: string
): Promise<void> => {
  await request.delete(`${API_URL}/consent-forms/${formId}`, {
    headers: {authorization: `Bearer ${token}`},
  });
};
