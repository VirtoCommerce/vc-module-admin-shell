using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using PlatformPermissions = VirtoCommerce.Platform.Core.PlatformConstants.Security.Permissions;

namespace VirtoCommerce.AdminShell.Web.Controllers.Api;

/// <summary>
/// Which dashboard widgets each role's users see. A role's setting is part of the role, so reading and changing it takes
/// the permissions that read and change roles. The widgets themselves still check their own permissions.
/// </summary>
[Route("api/admin-shell/dashboard")]
public class AdminShellDashboardController(IAdminDashboardService dashboardService) : Controller
{
    /// <summary>The widgets the current user's dashboard leaves out</summary>
    [HttpGet("")]
    [Authorize]
    public Task<EffectiveDashboard> GetDashboard() => dashboardService.GetEffectiveDashboardAsync(User);

    [HttpGet("roles/{roleId}")]
    [Authorize(PlatformPermissions.SecurityQuery)]
    public Task<RoleDashboard> GetRole([FromRoute] string roleId) => dashboardService.GetRoleDashboardAsync(roleId);

    [HttpPut("roles/{roleId}")]
    [Authorize(PlatformPermissions.SecurityUpdate)]
    public async Task<ActionResult> SaveRole([FromRoute] string roleId, [FromBody] RoleDashboard dashboard)
    {
        // a body that didn't bind (none, broken JSON, the wrong shape) would clear the role's list: refused, as for the menu
        if (dashboard == null || !ModelState.IsValid)
        {
            if (ModelState.IsValid)
            {
                ModelState.AddModelError("body", "A JSON object is required; send {} to show every widget.");
            }

            return ValidationProblem(ModelState);
        }

        await dashboardService.SaveRoleDashboardAsync(roleId, dashboard);
        return NoContent();
    }
}
