/**
 * Which broadcast notifications the shell shows. The platform sends a background job's progress to every signed-in
 * admin (the scale-out synchronizer and the vendor-portal need it to), so the host keeps only the broadcasts the current
 * user created, as the AngularJS admin does. The creator of a job's notification is the name of the user who enqueued
 * it, "system" for a job nobody enqueued. Case is ignored: the platform treats user names that way, so two users never
 * differ by case alone. Until the user name is known every broadcast is dropped: a missing filter would show them all.
 */
export const isOwnBroadcast = (notification: { creator?: string }, userName?: string): boolean => {
  if (!userName || !notification.creator) {
    return false;
  }

  return notification.creator.toLowerCase() === userName.toLowerCase();
};
