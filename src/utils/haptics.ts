/**
 * Haptic and vibration feedback is completely disabled throughout the application
 * per user requirements. All triggers resolve silently without vibrating.
 */
export const triggerImpact = async (): Promise<void> => {
  return Promise.resolve();
};

export const triggerSuccessHaptic = async (): Promise<void> => {
  return Promise.resolve();
};

export const triggerSelectionHaptic = async (): Promise<void> => {
  return Promise.resolve();
};
