using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Newtonsoft.Json;
using VirtoCommerce.AdminShell.Core;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.Platform.Core.DistributedLock;
using VirtoCommerce.Platform.Core.Security;
using VirtoCommerce.Platform.Core.Settings;
using Settings = VirtoCommerce.AdminShell.Core.ModuleConstants.Settings;

namespace VirtoCommerce.AdminShell.Web.Services;

/// <summary>Reads and writes the menu layers (platform settings) and composes the effective menu for a user</summary>
public class AdminMenuService(
    DefaultMenuBuilder defaultMenuBuilder,
    ISettingsManager settingsManager,
    UserManager<ApplicationUser> userManager,
    IDistributedLock distributedLock)
{
    public MenuDocument GetDefaultMenu() => defaultMenuBuilder.Build();

    public async Task<EffectiveMenu> GetEffectiveMenuAsync(ClaimsPrincipal principal)
    {
        var userId = principal.GetUserId();
        var user = await userManager.FindByIdAsync(userId);
        var roles = (user?.Roles ?? []).OrderBy(x => x.Name).ToList();

        // every role counts, with or without a patch: a role that hides nothing keeps an item another role hides
        var rolePatches = Task.WhenAll(roles.Select(role => GetRolePatchAsync(role.Id)));
        var globalPatch = GetGlobalPatchAsync();
        var userPrefs = GetUserPrefsAsync(userId);

        // administrators pass too, as for the endpoints' [Authorize]
        return MenuComposer.Compose(
            GetDefaultMenu(),
            await globalPatch,
            await rolePatches,
            await userPrefs,
            principal.HasGlobalPermission);
    }

    public Task<MenuPatch> GetGlobalPatchAsync() => ReadAsync<MenuPatch>(Settings.GlobalMenu, null, null);

    public Task SaveGlobalPatchAsync(MenuPatch patch) => WriteAsync(Settings.GlobalMenu, null, null, patch);

    public Task<MenuPatch> GetRolePatchAsync(string roleId) => ReadAsync<MenuPatch>(Settings.RoleMenu, ModuleConstants.RoleTenant, roleId);

    public Task SaveRolePatchAsync(string roleId, MenuPatch patch) => WriteAsync(Settings.RoleMenu, ModuleConstants.RoleTenant, roleId, patch);

    public Task<UserMenuPrefs> GetUserPrefsAsync(string userId) => ReadAsync<UserMenuPrefs>(Settings.UserMenu, ModuleConstants.UserProfileTenant, userId);

    // one write at a time per user: two first saves would each insert a settings row
    public Task SaveUserPrefsAsync(string userId, UserMenuPrefs prefs) =>
        distributedLock.ExecuteAsync($"admin-shell:prefs:{userId}",
            _ => WriteAsync(Settings.UserMenu, ModuleConstants.UserProfileTenant, userId, prefs),
            TimeSpan.FromSeconds(10));

    private async Task<T> ReadAsync<T>(SettingDescriptor descriptor, string objectType, string objectId) where T : new()
    {
        var setting = await settingsManager.GetObjectSettingAsync(descriptor.Name, objectType, objectId);
        var json = setting?.Value as string;
        // a stored null ({"items":null}) keeps the model's empty default
        return string.IsNullOrWhiteSpace(json)
            ? new T()
            : JsonConvert.DeserializeObject<T>(json, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore }) ?? new T();
    }

    private async Task WriteAsync(SettingDescriptor descriptor, string objectType, string objectId, object value)
    {
        var setting = await settingsManager.GetObjectSettingAsync(descriptor.Name, objectType, objectId);
        setting.ObjectType = objectType;
        setting.ObjectId = objectId;
        setting.Value = JsonConvert.SerializeObject(value);
        await settingsManager.SaveObjectSettingsAsync([setting]);
    }
}
