using System;
using System.Linq;
using System.Security.Claims;
using VirtoCommerce.Platform.Core;
using VirtoCommerce.Platform.Core.Security;

namespace VirtoCommerce.AdminShell.Core.Services;

/// <summary>Who sees a menu entry</summary>
public static class MenuAccess
{
    // a permission granted in a scope is the claim "name|[scopes as JSON]" (Permission.ToClaim)
    private const char ScopeSeparator = '|';

    /// <summary>
    /// A menu entry is navigation: it shows when the user holds its permission globally (administrators hold them all) or
    /// in some scope, e.g. customer:read limited to the user's own organizations. The screen and its API still apply the
    /// scope.
    /// </summary>
    public static bool HasPermission(ClaimsPrincipal principal, string permission)
    {
        if (principal == null || string.IsNullOrEmpty(permission))
        {
            return false;
        }

        if (principal.HasGlobalPermission(permission))
        {
            return true;
        }

        var scoped = permission + ScopeSeparator;
        return principal.Claims.Any(x =>
            x.Type == PlatformConstants.Security.Claims.PermissionClaimType &&
            x.Value.StartsWith(scoped, StringComparison.Ordinal));
    }
}
