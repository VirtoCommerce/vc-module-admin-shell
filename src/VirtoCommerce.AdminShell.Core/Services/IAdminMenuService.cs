using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using VirtoCommerce.AdminShell.Core.Models;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>Reads and writes the menu layers (platform settings) and composes the effective menu for a user</summary>
public interface IAdminMenuService
{
    /// <summary>The default menu; <paramref name="discovered"/> (workspace blades the client found) go to More where nothing opens them</summary>
    MenuDocument GetDefaultMenu(IEnumerable<MenuItem> discovered = null);

    /// <summary>The editor's menu: the default menu with the patch being edited (else the stored global patch), nothing filtered</summary>
    Task<MenuDocument> GetEditorMenuAsync(MenuEditorRequest request);

    /// <summary>The user's menu: default → global patch → role patches → personal changes (as allowed) → permissions</summary>
    Task<EffectiveMenu> GetEffectiveMenuAsync(ClaimsPrincipal principal, IEnumerable<MenuItem> discovered = null);

    /// <summary>What users may change in their menu (platform settings, so they can also be set per environment)</summary>
    Task<MenuPersonalization> GetPersonalizationAsync();

    Task SavePersonalizationAsync(MenuPersonalization personalization);

    /// <summary>Counts a use of a menu item toward the user's Recent</summary>
    Task AddRecentAsync(string userId, string itemId);

    Task<MenuPatch> GetGlobalPatchAsync();

    Task SaveGlobalPatchAsync(MenuPatch patch);

    Task<MenuPatch> GetRolePatchAsync(string roleId);

    Task SaveRolePatchAsync(string roleId, MenuPatch patch);

    Task<UserMenuPrefs> GetUserPrefsAsync(string userId);

    /// <summary>The prefs as the client edits them: with the ids the menu shows (see MenuComposer.WithCurrentIds)</summary>
    Task<UserMenuPrefs> GetUserPrefsForEditAsync(string userId);

    Task SaveUserPrefsAsync(string userId, UserMenuPrefs prefs);
}
