using System;
using System.Collections.Generic;
using System.Linq;
using VirtoCommerce.AdminShell.Core.Models;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>Which dashboard widgets a user doesn't see, from the user's roles</summary>
public static class DashboardComposer
{
    /// <summary>
    /// A widget is left out only when every one of the user's roles hides it, as for menu items: a role that shows a
    /// widget keeps it for the user. Administrators and users without roles see every widget they have permissions for.
    /// </summary>
    public static EffectiveDashboard Compose(IReadOnlyCollection<RoleDashboard> roles, bool isAdministrator)
    {
        if (isAdministrator || roles == null || roles.Count == 0)
        {
            return new EffectiveDashboard();
        }

        var hidden = roles
            .Select(role => Normalize(role?.HiddenWidgets))
            .Aggregate((all, next) => all.Intersect(next, StringComparer.Ordinal).ToList());

        return new EffectiveDashboard { HiddenWidgets = hidden };
    }

    /// <summary>A role's list as stored: trimmed ids, without blanks and repeats, in the order given</summary>
    public static List<string> Normalize(IEnumerable<string> widgetIds) =>
        (widgetIds ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
}
