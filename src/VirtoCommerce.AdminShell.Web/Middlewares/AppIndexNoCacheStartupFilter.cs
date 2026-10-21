using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;
using VirtoCommerce.AdminShell.Core;

namespace VirtoCommerce.AdminShell.Web.Middlewares;

/// <summary>
/// The host page (/apps/admin-shell/, index.html) is served without caching headers, so a browser could keep using an old
/// one, and with it the old build, after the module is updated. It is marked no-cache here: the browser revalidates it
/// (a 304 when it hasn't changed). The build's other files have the build number in their names and stay cacheable.
/// A startup filter, because the platform registers the apps' static files before modules' PostInitialize.
/// </summary>
public class AppIndexNoCacheStartupFilter : IStartupFilter
{
    private static readonly PathString AppPath = new($"/apps/{ModuleConstants.AppId}");

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) =>
        app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                if (IsIndex(context.Request.Path))
                {
                    context.Response.OnStarting(() =>
                    {
                        context.Response.Headers[HeaderNames.CacheControl] = "no-cache";
                        return System.Threading.Tasks.Task.CompletedTask;
                    });
                }
                return nextMiddleware(context);
            });
            next(app);
        };

    // /apps/admin-shell, /apps/admin-shell/ and /apps/admin-shell/index.html
    public static bool IsIndex(PathString path) =>
        path.StartsWithSegments(AppPath, StringComparison.OrdinalIgnoreCase, out var rest) &&
        (!rest.HasValue || rest.Value == "/" || rest.Value.Equals("/index.html", StringComparison.OrdinalIgnoreCase));
}
