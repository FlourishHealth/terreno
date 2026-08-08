export const SIGNATURE_PAD_HEIGHT_PX = 180;
export const IOS_SIGNATURE_PAD_HEIGHT_PX = 120;

export const getSignaturePadHeight = (platformOS: string): number => {
  if (platformOS === "ios") {
    return IOS_SIGNATURE_PAD_HEIGHT_PX;
  }

  return SIGNATURE_PAD_HEIGHT_PX;
};
