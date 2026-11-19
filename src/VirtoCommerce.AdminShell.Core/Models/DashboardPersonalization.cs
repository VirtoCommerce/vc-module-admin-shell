namespace VirtoCommerce.AdminShell.Core.Models;

/// <summary>What users may change on their own dashboard</summary>
public class DashboardPersonalization
{
    public bool AllowMove { get; set; } = true;
    public bool AllowResize { get; set; } = true;
}
