using System.Collections.Generic;
using VirtoCommerce.AdminShell.Core.Models;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>
/// The rules of the dashboard layers, as for the menu: the widgets the modules register (each shown only to users with
/// its permissions) → the layer for everyone → the role layers → the user's own. Replace or extend the implementation
/// to change a rule, e.g. how a user's roles combine.
/// </summary>
public interface IDashboardComposer
{
    /// <summary>The user's dashboard from the layers</summary>
    EffectiveDashboard Compose(
        DashboardPatch global,
        IReadOnlyCollection<DashboardPatch> roles,
        UserDashboardPrefs user,
        DashboardPersonalization personalization,
        bool isAdministrator,
        bool canManage);

    /// <summary>
    /// The widgets the user's roles hide: by default only those every role hides, and none for administrators or users
    /// without roles
    /// </summary>
    IEnumerable<string> HiddenByRoles(IReadOnlyCollection<DashboardPatch> roles, bool isAdministrator);

    /// <summary>The ids a layer hides, the earlier role format (<c>hiddenWidgets</c>) included</summary>
    IEnumerable<string> HiddenIds(DashboardPatch patch);

    /// <summary>A layer as stored: trimmed ids, valid places and sizes, no empty entries</summary>
    DashboardPatch Normalize(DashboardPatch patch);

    /// <summary>A user's layer as stored: places and sizes only</summary>
    UserDashboardPrefs Normalize(UserDashboardPrefs prefs);

    /// <summary>Widget ids trimmed, without blanks or repeats</summary>
    List<string> Normalize(IEnumerable<string> widgetIds);
}
