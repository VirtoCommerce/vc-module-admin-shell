// The license rules the avatar's menu and the License screen share.

/** Expired: an expiration date that has passed (a license without one doesn't expire) */
export const isLicenseExpired = (license?: { expirationDate?: Date | string } | null) =>
  !!license?.expirationDate && new Date(license.expirationDate).getTime() < Date.now();

/** A license date: its calendar date (UTC), not the day it is in this browser's zone */
export const formatLicenseDate = (value?: Date | string, month: "short" | "long" = "long") =>
  value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month, day: "numeric", timeZone: "UTC" }) : "";
