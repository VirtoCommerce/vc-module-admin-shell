using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.Platform.Core.Security;
using Permissions = VirtoCommerce.AdminShell.Core.ModuleConstants.Security.Permissions;

namespace VirtoCommerce.AdminShell.Web.Controllers.Api;

/// <summary>
/// The dashboard layers, as for the menu: for everyone, for each role, and each user's own. The layers for everyone and
/// for roles take admin-shell:dashboard:manage; a user's own dashboard, only a signed-in user. Hiding a widget is not
/// security: its data stays protected by its endpoints' permissions.
/// </summary>
[Route("api/admin-shell/dashboard")]
public class AdminShellDashboardController(IAdminDashboardService dashboardService) : Controller
{
    /// <summary>The current user's dashboard: global → roles → the user's own</summary>
    [HttpGet("")]
    [Authorize]
    public Task<EffectiveDashboard> GetDashboard() => dashboardService.GetEffectiveDashboardAsync(User);

    [HttpGet("me")]
    [Authorize]
    public Task<UserDashboardPrefs> GetMine() => dashboardService.GetUserPrefsAsync(User.GetUserId());

    [HttpPut("me")]
    [Authorize]
    public async Task<ActionResult> SaveMine([FromBody] UserDashboardPrefs prefs)
    {
        if (NotBound(prefs))
        {
            return ValidationProblem(ModelState);
        }

        await dashboardService.SaveUserPrefsAsync(User.GetUserId(), prefs);
        return NoContent();
    }

    [HttpGet("global")]
    [Authorize(Permissions.DashboardManage)]
    public Task<DashboardPatch> GetGlobal() => dashboardService.GetGlobalAsync();

    /// <summary>Saves the dashboard for everyone; resetUserLayouts=true drops every user's own places and sizes</summary>
    [HttpPut("global")]
    [Authorize(Permissions.DashboardManage)]
    public async Task<ActionResult> SaveGlobal([FromBody] DashboardPatch patch, [FromQuery] bool resetUserLayouts = false)
    {
        if (NotBound(patch))
        {
            return ValidationProblem(ModelState);
        }

        await dashboardService.SaveGlobalAsync(patch, resetUserLayouts);
        return NoContent();
    }

    [HttpGet("roles/{roleId}")]
    [Authorize(Permissions.DashboardManage)]
    public async Task<ActionResult<DashboardPatch>> GetRole([FromRoute] string roleId)
    {
        if (!await dashboardService.RoleExistsAsync(roleId))
        {
            return NotFound();
        }

        return await dashboardService.GetRoleAsync(roleId);
    }

    [HttpPut("roles/{roleId}")]
    [Authorize(Permissions.DashboardManage)]
    public async Task<ActionResult> SaveRole([FromRoute] string roleId, [FromBody] DashboardPatch patch)
    {
        if (NotBound(patch))
        {
            return ValidationProblem(ModelState);
        }

        if (!await dashboardService.RoleExistsAsync(roleId))
        {
            return NotFound();
        }

        await dashboardService.SaveRoleAsync(roleId, patch);
        return NoContent();
    }

    [HttpGet("personalization")]
    [Authorize(Permissions.DashboardManage)]
    public Task<DashboardPersonalization> GetPersonalization() => dashboardService.GetPersonalizationAsync();

    [HttpPut("personalization")]
    [Authorize(Permissions.DashboardManage)]
    public async Task<ActionResult> SavePersonalization([FromBody] DashboardPersonalization personalization)
    {
        if (NotBound(personalization))
        {
            return ValidationProblem(ModelState);
        }

        await dashboardService.SavePersonalizationAsync(personalization);
        return NoContent();
    }

    /// <summary>
    /// A body that didn't bind (none, broken JSON, the wrong shape) arrives as null; saved, it would wipe the layer. It is
    /// refused with 400, and nothing is written. To clear a layer, send an empty object: {}.
    /// </summary>
    private bool NotBound(object body)
    {
        if (body != null && ModelState.IsValid)
        {
            return false;
        }

        if (ModelState.IsValid)
        {
            ModelState.AddModelError("body", "A JSON object is required; send {} to clear.");
        }

        return true;
    }
}
