/**
 * Which broadcast notifications the shell shows. The platform sends every notification that has a creator both to that
 * user and to every signed-in client (the scale-out synchronizer and the vendor-portal need the broadcast), so the host
 * keeps only the broadcasts the current user created, as the AngularJS admin does; the user's own notifications also
 * arrive unfiltered on the per-user channel. A notification no user created (a recurring job, a module install) is shown
 * to nobody. Case is ignored: user names are unique by their normalized form, so two users never differ by case alone.
 * Until the user name is known every broadcast is dropped: a missing filter would show them all.
 */
export const isOwnBroadcast = (notification: { creator?: string }, userName?: string): boolean => {
  if (!userName || !notification.creator) {
    return false;
  }

  return notification.creator.toLowerCase() === userName.toLowerCase();
};
