// The license rules the avatar's menu and the License screen share.
import { regionalSettings } from "./regionalSettings";

/** Expired: an expiration date that has passed (a license without one doesn't expire) */
export const isLicenseExpired = (license?: { expirationDate?: Date | string } | null) =>
  !!license?.expirationDate && new Date(license.expirationDate).getTime() < Date.now();

/** A license date in the user's regional format: its calendar date (UTC), not the day it is in the user's zone */
export const formatLicenseDate = (value?: Date | string, month: "short" | "long" = "long") =>
  regionalSettings.formatDate(value, { year: "numeric", month, day: "numeric", timeZone: "UTC" });
