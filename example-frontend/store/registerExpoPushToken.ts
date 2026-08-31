export interface RegisterExpoPushTokenInput {
  getToken: () => Promise<{data: string}>;
  platform: string;
  postToken: (body: {platform: "android" | "ios"; token: string}) => Promise<unknown>;
}

export const registerExpoPushToken = async ({
  getToken,
  platform,
  postToken,
}: RegisterExpoPushTokenInput): Promise<"registered" | "skipped"> => {
  if (platform === "web") {
    return "skipped";
  }
  const token = await getToken();
  if (!token.data) {
    return "skipped";
  }
  const mappedPlatform = platform === "android" ? "android" : "ios";
  await postToken({platform: mappedPlatform, token: token.data});
  return "registered";
};

export const registerExpoPushTokenSafely = async (
  input: RegisterExpoPushTokenInput
): Promise<"registered" | "skipped"> => {
  try {
    return await registerExpoPushToken(input);
  } catch (error: unknown) {
    console.warn("[comms] Failed to register Expo push token", error);
    return "skipped";
  }
};
