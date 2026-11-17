using System.Security.Claims;
using System.Threading.Tasks;
using VirtoCommerce.AdminShell.Core.Models;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>Reads and writes the roles' dashboard settings and composes the current user's dashboard</summary>
public interface IAdminDashboardService
{
    /// <summary>The widgets the user's dashboard leaves out (see DashboardComposer.Compose)</summary>
    Task<EffectiveDashboard> GetEffectiveDashboardAsync(ClaimsPrincipal principal);

    Task<RoleDashboard> GetRoleDashboardAsync(string roleId);

    Task SaveRoleDashboardAsync(string roleId, RoleDashboard dashboard);
}
