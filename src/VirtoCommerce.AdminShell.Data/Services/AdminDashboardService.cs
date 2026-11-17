using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Newtonsoft.Json;
using VirtoCommerce.AdminShell.Core;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Core.Services;
using VirtoCommerce.Platform.Core.Security;
using VirtoCommerce.Platform.Core.Settings;
using Settings = VirtoCommerce.AdminShell.Core.ModuleConstants.Settings;

namespace VirtoCommerce.AdminShell.Data.Services;

/// <summary>The roles' dashboard settings (platform settings of the role tenant, like the role menu patches)</summary>
public class AdminDashboardService(
    ISettingsManager settingsManager,
    UserManager<ApplicationUser> userManager) : IAdminDashboardService
{
    public async Task<EffectiveDashboard> GetEffectiveDashboardAsync(ClaimsPrincipal principal)
    {
        var user = await userManager.FindByIdAsync(principal.GetUserId());
        if (user == null)
        {
            return new EffectiveDashboard();
        }

        var roles = await Task.WhenAll((user.Roles ?? []).Select(role => GetRoleDashboardAsync(role.Id)));
        return DashboardComposer.Compose(roles, user.IsAdministrator);
    }

    // A value that doesn't read as a role dashboard (edited by hand, with a typo) reads as empty: the role's users then
    // see every widget instead of losing their dashboard
    public async Task<RoleDashboard> GetRoleDashboardAsync(string roleId)
    {
        var setting = await settingsManager.GetObjectSettingAsync(Settings.RoleDashboard.Name, ModuleConstants.RoleTenant, roleId);
        if (setting?.Value is not string json || string.IsNullOrWhiteSpace(json))
        {
            return new RoleDashboard();
        }

        try
        {
            var dashboard = JsonConvert.DeserializeObject<RoleDashboard>(json, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore });
            return new RoleDashboard { HiddenWidgets = DashboardComposer.Normalize(dashboard?.HiddenWidgets) };
        }
        catch (JsonException)
        {
            return new RoleDashboard();
        }
    }

    public async Task SaveRoleDashboardAsync(string roleId, RoleDashboard dashboard)
    {
        var setting = await settingsManager.GetObjectSettingAsync(Settings.RoleDashboard.Name, ModuleConstants.RoleTenant, roleId);
        setting.ObjectType = ModuleConstants.RoleTenant;
        setting.ObjectId = roleId;
        setting.Value = JsonConvert.SerializeObject(new RoleDashboard { HiddenWidgets = DashboardComposer.Normalize(dashboard?.HiddenWidgets) });
        await settingsManager.SaveObjectSettingsAsync([setting]);
    }
}
