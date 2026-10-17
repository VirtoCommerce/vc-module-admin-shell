using System;
using System.Collections.Generic;
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
        // the reads that don't need the user's roles run while the user loads
        var globalPatch = GetGlobalPatchAsync();
        var userPrefs = GetUserPrefsAsync(userId);
        var recent = ReadUsesAsync(userId);
        var user = await userManager.FindByIdAsync(userId);
        var roles = (user?.Roles ?? []).OrderBy(x => x.Name).ToList();

        // every role counts, with or without a patch: a role that hides nothing keeps an item another role hides
        var rolePatches = Task.WhenAll(roles.Select(role => GetRolePatchAsync(role.Id)));

        // administrators pass too, as for the endpoints' [Authorize]
        return MenuComposer.Compose(
            GetDefaultMenu(),
            await globalPatch,
            await rolePatches,
            await userPrefs,
            principal.HasGlobalPermission,
            (await recent).Select(x => x.Id).ToList());
    }

    // the uses as stored, which is best first: RecordUse ranks them, and the shared half-life keeps that order over time.
    // A value that doesn't read as uses (edited by hand) empties Recent (ReadAsync); the next use rewrites it.
    private async Task<List<RecentUse>> ReadUsesAsync(string userId)
    {
        var uses = await ReadAsync<List<RecentUse>>(Settings.UserRecent, ModuleConstants.UserProfileTenant, userId);
        return uses.Where(x => !string.IsNullOrEmpty(x?.Id)).ToList();
    }

    // one write at a time per user: two quick clicks would each read the same uses, and the later write would drop one
    public Task AddRecentAsync(string userId, string itemId) =>
        distributedLock.ExecuteAsync($"admin-shell:recent:{userId}",
            async _ =>
            {
                var now = DateTime.UtcNow;
                var uses = await ReadUsesAsync(userId);
                var updated = MenuComposer.RecordUse(uses, itemId, now, ModuleConstants.RecentHalfLifeDays, ModuleConstants.MaxRecentTracked);
                await WriteAsync(Settings.UserRecent, ModuleConstants.UserProfileTenant, userId, updated);
            },
            TimeSpan.FromSeconds(10));

    public Task<MenuPatch> GetGlobalPatchAsync() => ReadAsync<MenuPatch>(Settings.GlobalMenu, null, null);

    public Task SaveGlobalPatchAsync(MenuPatch patch) => WriteAsync(Settings.GlobalMenu, null, null, patch);

    public Task<MenuPatch> GetRolePatchAsync(string roleId) => ReadAsync<MenuPatch>(Settings.RoleMenu, ModuleConstants.RoleTenant, roleId);

    public Task SaveRolePatchAsync(string roleId, MenuPatch patch) => WriteAsync(Settings.RoleMenu, ModuleConstants.RoleTenant, roleId, patch);

    public Task<UserMenuPrefs> GetUserPrefsAsync(string userId) => ReadAsync<UserMenuPrefs>(Settings.UserMenu, ModuleConstants.UserProfileTenant, userId);

    /// <summary>The prefs as the client edits them: with the ids the menu shows (see MenuComposer.WithCurrentIds)</summary>
    public async Task<UserMenuPrefs> GetUserPrefsForEditAsync(string userId) =>
        MenuComposer.WithCurrentIds(GetDefaultMenu(), await GetUserPrefsAsync(userId));

    // one write at a time per user: two first saves would each insert a settings row
    public Task SaveUserPrefsAsync(string userId, UserMenuPrefs prefs) =>
        distributedLock.ExecuteAsync($"admin-shell:prefs:{userId}",
            _ => WriteAsync(Settings.UserMenu, ModuleConstants.UserProfileTenant, userId, prefs),
            TimeSpan.FromSeconds(10));

    private async Task<string> ReadJsonAsync(SettingDescriptor descriptor, string objectType, string objectId) =>
        (await settingsManager.GetObjectSettingAsync(descriptor.Name, objectType, objectId))?.Value as string;

    // A value that doesn't read as T (a menu patch or prefs edited by hand, with a typo) reads as empty: one bad setting
    // must not take the menu down for everyone, or for everyone in a role
    private async Task<T> ReadAsync<T>(SettingDescriptor descriptor, string objectType, string objectId) where T : new()
    {
        var json = await ReadJsonAsync(descriptor, objectType, objectId);
        if (string.IsNullOrWhiteSpace(json))
        {
            return new T();
        }

        try
        {
            // a stored null ({"items":null}) keeps the model's empty default
            return JsonConvert.DeserializeObject<T>(json, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore }) ?? new T();
        }
        catch (JsonException)
        {
            return new T();
        }
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
