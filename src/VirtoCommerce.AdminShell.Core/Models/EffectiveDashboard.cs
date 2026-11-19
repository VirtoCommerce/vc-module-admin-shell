using System;
using System.Collections.Generic;

namespace VirtoCommerce.AdminShell.Core.Models;

/// <summary>The current user's dashboard: the layers composed, for Home</summary>
public class EffectiveDashboard
{
    /// <summary>Places and sizes for everyone (the global layer), over the modules' own</summary>
    public Dictionary<string, WidgetLayout> Defaults { get; set; } = new(StringComparer.Ordinal);

    /// <summary>Hidden for this user by the global layer or by every one of the user's roles; the user can't show them</summary>
    public List<string> Hidden { get; set; } = [];

    /// <summary>The user's own places and sizes (as far as users may move and resize), under the current layout version</summary>
    public Dictionary<string, WidgetLayout> Layout { get; set; } = new(StringComparer.Ordinal);

    public DashboardPersonalization Personalization { get; set; } = new();

    public int LayoutVersion { get; set; }

    /// <summary>The user may change the dashboard for everyone (admin-shell:dashboard:manage)</summary>
    public bool CanManage { get; set; }
}
