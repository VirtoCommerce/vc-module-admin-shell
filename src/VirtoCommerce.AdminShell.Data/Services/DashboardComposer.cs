using System;
using System.Collections.Generic;
using System.Linq;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;

namespace VirtoCommerce.AdminShell.Data.Services;

/// <summary>
/// The dashboard layers, as for the menu: the widgets the modules register (each shown only to users with its
/// permissions, checked by the client) → the global layer (for everyone) → the role layers → the user's own.
/// Registered as <see cref="IDashboardComposer"/>: override a method to change a rule (e.g. how roles combine).
/// </summary>
public class DashboardComposer : IDashboardComposer
{
    /// <summary>The grid's columns: no widget is wider</summary>
    public const int GridColumns = 12;

    public virtual EffectiveDashboard Compose(
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

        result.Defaults = LayoutOf(global.Widgets, move: true, resize: true);

        // the user's places count only under the layout version they were made in: a reset by an administrator raises it
        if (user.LayoutVersion == global.LayoutVersion)
        {
            result.Layout = LayoutOf(user.Widgets, personalization.AllowMove, personalization.AllowResize);
        }

        return result;
    }

    /// <summary>The places (when <paramref name="move"/>) and sizes (when <paramref name="resize"/>) a layer sets</summary>
    protected virtual Dictionary<string, WidgetLayout> LayoutOf(Dictionary<string, WidgetPatch> widgets, bool move, bool resize)
    {
        var result = new Dictionary<string, WidgetLayout>(StringComparer.Ordinal);
        foreach (var (id, patch) in Widgets(widgets))
        {
            var layout = new WidgetLayout
            {
                X = move ? patch.X : null,
                Y = move ? patch.Y : null,
                Width = resize ? patch.Width : null,
                Height = resize ? patch.Height : null,
            };
            if (HasAny(layout.X, layout.Y, layout.Width, layout.Height))
            {
                result[id] = layout;
            }
        }

        return result;
    }

    /// <summary>
    /// A widget is hidden by the roles only when every one of the user's roles hides it, as for menu items: a role that
    /// shows it keeps it. Administrators and users without roles get nothing hidden by roles.
    /// </summary>
    public virtual IEnumerable<string> HiddenByRoles(IReadOnlyCollection<DashboardPatch> roles, bool isAdministrator)
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

    /// <summary>The ids a layer hides: its widgets marked hidden</summary>
    public virtual IEnumerable<string> HiddenIds(DashboardPatch patch) =>
        Widgets(patch).Where(x => x.Value.Hidden == true).Select(x => x.Key)
            .Distinct(StringComparer.Ordinal);

    /// <summary>
    /// A layer as stored: trimmed ids, valid places and sizes, without blanks or empty entries.
    /// Ids of widgets that aren't installed are kept: they do nothing, and work again if the module comes back.
    /// </summary>
    public virtual DashboardPatch Normalize(DashboardPatch patch)
    {
        var result = new DashboardPatch { LayoutVersion = Math.Max(0, patch?.LayoutVersion ?? 0) };
        foreach (var (id, widget) in Widgets(patch))
        {
            result.Widgets[id] = Clean(widget);
        }

        foreach (var id in result.Widgets.Where(x => IsEmpty(x.Value)).Select(x => x.Key).ToList())
        {
            result.Widgets.Remove(id);
        }

        return result;
    }

    public virtual UserDashboardPrefs Normalize(UserDashboardPrefs prefs)
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

    public virtual List<string> Normalize(IEnumerable<string> widgetIds) =>
        (widgetIds ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

    private static IEnumerable<KeyValuePair<string, WidgetPatch>> Widgets(DashboardPatch patch) => Widgets(patch?.Widgets);

    private static IEnumerable<KeyValuePair<string, WidgetPatch>> Widgets(Dictionary<string, WidgetPatch> widgets) =>
        (widgets ?? [])
            .Where(x => !string.IsNullOrWhiteSpace(x.Key) && x.Value != null)
            .Select(x => new KeyValuePair<string, WidgetPatch>(x.Key.Trim(), x.Value));

    // a place can't be negative and a size is at least a cell; hidden false is the same as not saying
    protected virtual WidgetPatch Clean(WidgetPatch widget) => new()
    {
        Hidden = widget?.Hidden == true ? true : null,
        X = AtLeast(widget?.X, 0),
        Y = AtLeast(widget?.Y, 0),
        Width = Within(widget?.Width, 1, GridColumns),
        Height = AtLeast(widget?.Height, 1),
    };

    private static int? AtLeast(int? value, int min) => value is { } v ? Math.Max(min, v) : null;

    private static int? Within(int? value, int min, int max) => value is { } v ? Math.Clamp(v, min, max) : null;

    private static bool HasAny(params int?[] values) => values.Any(x => x != null);

    private static bool IsEmpty(WidgetPatch widget) =>
        widget.Hidden == null && !HasAny(widget.X, widget.Y, widget.Width, widget.Height);
}
