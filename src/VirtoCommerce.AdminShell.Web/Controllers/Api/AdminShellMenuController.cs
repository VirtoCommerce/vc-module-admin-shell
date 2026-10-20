using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.Platform.Core.Security;
using Permissions = VirtoCommerce.AdminShell.Core.ModuleConstants.Security.Permissions;

namespace VirtoCommerce.AdminShell.Web.Controllers.Api;

[Route("api/admin-shell/menu")]
public class AdminShellMenuController(IAdminMenuService menuService) : Controller
{
    /// <summary>Effective menu for the current user: default → global → roles → personal, filtered by permissions</summary>
    [HttpGet("")]
    [Authorize(Permissions.Access)]
    public Task<EffectiveMenu> GetMenu() => menuService.GetEffectiveMenuAsync(User);

    /// <summary>The same, with the workspace blades the client found that no menu entry opens (they go to More)</summary>
    [HttpPost("")]
    [Authorize(Permissions.Access)]
    public Task<EffectiveMenu> GetMenu([FromBody] MenuRequest request) => menuService.GetEffectiveMenuAsync(User, request?.Discovered);

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

    /// <summary>The default menu with the client's discovered blades in More</summary>
    [HttpPost("default")]
    [Authorize(Permissions.MenuManage)]
    public ActionResult<MenuDocument> GetDefault([FromBody] MenuRequest request) => menuService.GetDefaultMenu(request?.Discovered);

    /// <summary>The menu editor's view: the default menu with the given patch (else the stored global one), hidden items marked</summary>
    [HttpPost("editor")]
    [Authorize(Permissions.MenuManage)]
    public Task<MenuDocument> GetEditorMenu([FromBody] MenuEditorRequest request) => menuService.GetEditorMenuAsync(request);

    [HttpGet("personalization")]
    [Authorize(Permissions.MenuManage)]
    public Task<MenuPersonalization> GetPersonalization() => menuService.GetPersonalizationAsync();

    [HttpPut("personalization")]
    [Authorize(Permissions.MenuManage)]
    public async Task<ActionResult> SavePersonalization([FromBody] MenuPersonalization personalization)
    {
        await menuService.SavePersonalizationAsync(personalization ?? new MenuPersonalization());
        return NoContent();
    }

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
