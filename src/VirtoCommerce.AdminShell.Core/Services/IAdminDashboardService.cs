using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using VirtoCommerce.AdminShell.Core.Models;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>Reads and writes the dashboard layers (platform settings) and composes the current user's dashboard</summary>
public interface IAdminDashboardService
{
    /// <summary>The user's dashboard: global → roles → the user's own (see DashboardComposer.Compose)</summary>
    Task<EffectiveDashboard> GetEffectiveDashboardAsync(ClaimsPrincipal principal);

    Task<DashboardPatch> GetGlobalAsync();

    /// <summary>Saves the layer for everyone; <paramref name="resetUserLayouts"/> drops every user's own places and sizes</summary>
    Task SaveGlobalAsync(DashboardPatch patch, bool resetUserLayouts);

    /// <summary>Whether the platform has the role: a setting for a role id that doesn't exist would never apply</summary>
    Task<bool> RoleExistsAsync(string roleId);

    Task<DashboardPatch> GetRoleAsync(string roleId);

    /// <summary>Every role with its permissions and its dashboard layer, by name: the editor's one request</summary>
    Task<IList<RoleDashboard>> GetRolesAsync();

    Task SaveRoleAsync(string roleId, DashboardPatch patch);

    Task<UserDashboardPrefs> GetUserPrefsAsync(string userId);

    Task SaveUserPrefsAsync(string userId, UserDashboardPrefs prefs);

    Task<DashboardPersonalization> GetPersonalizationAsync();

    Task SavePersonalizationAsync(DashboardPersonalization personalization);
}
