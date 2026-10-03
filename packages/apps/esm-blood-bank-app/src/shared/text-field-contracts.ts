/** Existing mock policy, not a verified contract for a deployed OMOD. */
export const bagLotTextContract = { maxUtf16Units: 50 } as const;

// Keep the existing String.length policy; supplementary symbols use two units.
export const countUtf16Units = (value: string) => value.length;
export const bagLotExceedsLimit = (value: string) => countUtf16Units(value) > bagLotTextContract.maxUtf16Units;
