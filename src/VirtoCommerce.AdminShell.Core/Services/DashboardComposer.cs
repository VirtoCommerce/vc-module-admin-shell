using System;
using System.Collections.Generic;
using System.Linq;
using VirtoCommerce.AdminShell.Core.Models;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>
/// The dashboard layers, as for the menu: the widgets the modules register (each shown only to users with its
/// permissions, checked by the client) → the global layer (for everyone) → the role layers → the user's own.
/// </summary>
public static class DashboardComposer
{
    public static EffectiveDashboard Compose(
        DashboardPatch global,
        IReadOnlyCollection<DashboardPatch> roles,
        UserDashboardPrefs user,
        DashboardPersonalization personalization,
        bool isAdministrator,
        bool canManage)
    {
        global ??= new DashboardPatch();
        user ??= new UserDashboardPrefs();
        personalization ??= new DashboardPersonalization();

        var hidden = HiddenIds(global).ToHashSet(StringComparer.Ordinal);
        hidden.UnionWith(HiddenByRoles(roles, isAdministrator));

        var result = new EffectiveDashboard
        {
            Hidden = [.. hidden.Order(StringComparer.Ordinal)],
            Personalization = personalization,
            LayoutVersion = global.LayoutVersion,
            CanManage = canManage,
        };

        foreach (var (id, patch) in Widgets(global))
        {
            if (patch.X != null || patch.Y != null || patch.Width != null || patch.Height != null)
            {
                result.Defaults[id] = new WidgetLayout { X = patch.X, Y = patch.Y, Width = patch.Width, Height = patch.Height };
            }
        }

        // the user's places count only under the layout version they were made in: a reset by an administrator raises it
        if (user.LayoutVersion == global.LayoutVersion && (personalization.AllowMove || personalization.AllowResize))
        {
            foreach (var (id, patch) in Widgets(user))
            {
                var layout = new WidgetLayout
                {
                    X = personalization.AllowMove ? patch.X : null,
                    Y = personalization.AllowMove ? patch.Y : null,
                    Width = personalization.AllowResize ? patch.Width : null,
                    Height = personalization.AllowResize ? patch.Height : null,
                };
                if (layout.X != null || layout.Y != null || layout.Width != null || layout.Height != null)
                {
                    result.Layout[id] = layout;
                }
            }
        }

        return result;
    }

    /// <summary>
    /// A widget is hidden by the roles only when every one of the user's roles hides it, as for menu items: a role that
    /// shows it keeps it. Administrators and users without roles get nothing hidden by roles.
    /// </summary>
    public static IEnumerable<string> HiddenByRoles(IReadOnlyCollection<DashboardPatch> roles, bool isAdministrator)
    {
        if (isAdministrator || roles == null || roles.Count == 0)
        {
            return [];
        }

        return roles
            .Select(role => HiddenIds(role).ToHashSet(StringComparer.Ordinal))
            .Aggregate((all, next) =>
            {
                all.IntersectWith(next);
                return all;
            });
    }

    /// <summary>The ids a layer hides: its widgets marked hidden, and a role's list in the earlier format</summary>
    public static IEnumerable<string> HiddenIds(DashboardPatch patch) =>
        Widgets(patch).Where(x => x.Value.Hidden == true).Select(x => x.Key)
            .Concat(Normalize(patch?.HiddenWidgets))
            .Distinct(StringComparer.Ordinal);

    /// <summary>
    /// A layer as stored: trimmed ids, without blanks or empty entries, and a role's earlier list folded into its widgets.
    /// Ids of widgets that aren't installed are kept: they do nothing, and work again if the module comes back.
    /// </summary>
    public static DashboardPatch Normalize(DashboardPatch patch)
    {
        var result = new DashboardPatch { LayoutVersion = Math.Max(0, patch?.LayoutVersion ?? 0) };
        foreach (var (id, widget) in Widgets(patch))
        {
            result.Widgets[id] = Clean(widget);
        }

        foreach (var id in Normalize(patch?.HiddenWidgets))
        {
            result.Widgets.TryGetValue(id, out var widget);
            result.Widgets[id] = Clean(widget, hidden: true);
        }

        foreach (var id in result.Widgets.Where(x => IsEmpty(x.Value)).Select(x => x.Key).ToList())
        {
            result.Widgets.Remove(id);
        }

        return result;
    }

    public static UserDashboardPrefs Normalize(UserDashboardPrefs prefs)
    {
        var result = new UserDashboardPrefs { LayoutVersion = Math.Max(0, prefs?.LayoutVersion ?? 0) };
        foreach (var (id, widget) in Widgets(prefs?.Widgets))
        {
            // users place and size widgets; hiding is for everyone and for roles
            var clean = Clean(widget);
            clean.Hidden = null;
            if (!IsEmpty(clean))
            {
                result.Widgets[id] = clean;
            }
        }

        return result;
    }

    public static List<string> Normalize(IEnumerable<string> widgetIds) =>
        (widgetIds ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

    private static IEnumerable<KeyValuePair<string, WidgetPatch>> Widgets(DashboardPatch patch) => Widgets(patch?.Widgets);

    private static IEnumerable<KeyValuePair<string, WidgetPatch>> Widgets(UserDashboardPrefs prefs) => Widgets(prefs?.Widgets);

    private static IEnumerable<KeyValuePair<string, WidgetPatch>> Widgets(Dictionary<string, WidgetPatch> widgets) =>
        (widgets ?? [])
            .Where(x => !string.IsNullOrWhiteSpace(x.Key) && x.Value != null)
            .Select(x => new KeyValuePair<string, WidgetPatch>(x.Key.Trim(), x.Value));

    // a place can't be negative and a size is at least a cell; hidden false is the same as not saying
    private static WidgetPatch Clean(WidgetPatch widget, bool hidden = false) => new()
    {
        Hidden = hidden || widget?.Hidden == true ? true : null,
        X = widget?.X is { } x ? Math.Max(0, x) : null,
        Y = widget?.Y is { } y ? Math.Max(0, y) : null,
        Width = widget?.Width is { } w ? Math.Clamp(w, 1, 12) : null,
        Height = widget?.Height is { } h ? Math.Max(1, h) : null,
    };

    private static bool IsEmpty(WidgetPatch widget) =>
        widget.Hidden == null && widget.X == null && widget.Y == null && widget.Width == null && widget.Height == null;
}
