using System;
using System.Collections.Generic;

namespace VirtoCommerce.AdminShell.Core.Models;

/// <summary>
/// A user's own dashboard (setting AdminShell.Dashboard.User): where the user put the widgets and how big the user made
/// them. Kept on the server, so it is the same in every browser. Users don't hide widgets: a "hidden" here is ignored.
/// LayoutVersion is the global one the places were made under: an older one means an administrator reset the users'
/// layouts.
/// </summary>
public class UserDashboardPrefs
{
    public Dictionary<string, WidgetPatch> Widgets { get; set; } = new(StringComparer.Ordinal);

    public int LayoutVersion { get; set; }
}
