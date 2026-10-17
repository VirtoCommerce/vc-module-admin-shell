using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Web.Services;
using VirtoCommerce.Platform.Core.Security;
using Permissions = VirtoCommerce.AdminShell.Core.ModuleConstants.Security.Permissions;

namespace VirtoCommerce.AdminShell.Web.Controllers.Api;

[Route("api/admin-shell/menu")]
public class AdminShellMenuController(AdminMenuService menuService) : Controller
{
    /// <summary>Effective menu for the current user: default → global → roles → personal, filtered by permissions</summary>
    [HttpGet("")]
    [Authorize(Permissions.Access)]
    public Task<EffectiveMenu> GetMenu() => menuService.GetEffectiveMenuAsync(User);

    [HttpGet("me/prefs")]
    [Authorize(Permissions.Access)]
    public Task<UserMenuPrefs> GetMyPrefs() => menuService.GetUserPrefsForEditAsync(User.GetUserId());

    [HttpPut("me/prefs")]
    [Authorize(Permissions.Access)]
    public async Task<ActionResult> SaveMyPrefs([FromBody] UserMenuPrefs prefs)
    {
        await menuService.SaveUserPrefsAsync(User.GetUserId(), prefs ?? new UserMenuPrefs());
        return NoContent();
    }

    /// <summary>Counts a use of a menu item toward the user's Recent</summary>
    [HttpPost("me/recent/{itemId}")]
    [Authorize(Permissions.Access)]
    public async Task<ActionResult> AddRecent([FromRoute] string itemId)
    {
        await menuService.AddRecentAsync(User.GetUserId(), itemId);
        return NoContent();
    }

    /// <summary>Menu built from installed modules, before any customization: the base the global and role patches below edit</summary>
    [HttpGet("default")]
    [Authorize(Permissions.MenuManage)]
    public ActionResult<MenuDocument> GetDefault() => menuService.GetDefaultMenu();

    [HttpGet("global")]
    [Authorize(Permissions.MenuManage)]
    public Task<MenuPatch> GetGlobal() => menuService.GetGlobalPatchAsync();

    [HttpPut("global")]
    [Authorize(Permissions.MenuManage)]
    public async Task<ActionResult> SaveGlobal([FromBody] MenuPatch patch)
    {
        await menuService.SaveGlobalPatchAsync(patch ?? new MenuPatch());
        return NoContent();
    }

    [HttpGet("roles/{roleId}")]
    [Authorize(Permissions.MenuManage)]
    public Task<MenuPatch> GetRole([FromRoute] string roleId) => menuService.GetRolePatchAsync(roleId);

    [HttpPut("roles/{roleId}")]
    [Authorize(Permissions.MenuManage)]
    public async Task<ActionResult> SaveRole([FromRoute] string roleId, [FromBody] MenuPatch patch)
    {
        await menuService.SaveRolePatchAsync(roleId, patch ?? new MenuPatch());
        return NoContent();
    }
}
