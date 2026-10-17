using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using VirtoCommerce.AdminShell.Core;
using VirtoCommerce.AdminShell.Web.Middlewares;
using VirtoCommerce.AdminShell.Web.Services;
using VirtoCommerce.Platform.Core.Modularity;
using VirtoCommerce.Platform.Core.Security;
using VirtoCommerce.Platform.Core.Settings;

namespace VirtoCommerce.AdminShell.Web;

public class Module : IModule
{
    public ManifestModuleInfo ModuleInfo { get; set; }

    public void Initialize(IServiceCollection serviceCollection)
    {
        serviceCollection.AddTransient<DefaultMenuBuilder>();
        serviceCollection.AddTransient<AdminMenuService>();
        serviceCollection.AddTransient<BrandingService>();
        // the host page is revalidated, so an updated module's build reaches browsers at once
        serviceCollection.AddTransient<IStartupFilter, AppIndexNoCacheStartupFilter>();
    }

    public void PostInitialize(IApplicationBuilder appBuilder)
    {
        var serviceProvider = appBuilder.ApplicationServices;

        var settingsRegistrar = serviceProvider.GetRequiredService<ISettingsRegistrar>();
        settingsRegistrar.RegisterSettings(ModuleConstants.Settings.ModuleSettings, ModuleInfo.Id);
        settingsRegistrar.RegisterSettings(ModuleConstants.Settings.RoleSettings, ModuleInfo.Id);
        settingsRegistrar.RegisterSettings(ModuleConstants.Settings.UserSettings, ModuleInfo.Id);
        settingsRegistrar.RegisterSettingsForType(ModuleConstants.Settings.RoleSettings, ModuleConstants.RoleTenant);
        settingsRegistrar.RegisterSettingsForType(ModuleConstants.Settings.UserSettings, ModuleConstants.UserProfileTenant);

        var permissionsRegistrar = serviceProvider.GetRequiredService<IPermissionsRegistrar>();
        permissionsRegistrar.RegisterPermissions(ModuleInfo.Id, "Admin Shell", ModuleConstants.Security.Permissions.AllPermissions);
    }

    public void Uninstall()
    {
        // Nothing to do here
    }
}
