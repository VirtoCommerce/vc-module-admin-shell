using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;
using VirtoCommerce.AdminShell.Web.Middlewares;
using Xunit;

namespace VirtoCommerce.AdminShell.Tests;

/// <summary>
/// The host page is marked no-cache wherever it is served from: /apps/admin-shell/, or "/" when the platform rewrites the
/// site root to the shell after the filter's middleware has run.
/// </summary>
public class AppIndexNoCacheStartupFilterTests
{
    [Theory]
    [InlineData("/apps/admin-shell/", "/apps/admin-shell/index.html", "no-cache")]
    [InlineData("/apps/admin-shell", "/apps/admin-shell/index.html", "no-cache")]
    [InlineData("/apps/admin-shell/index.html", "/apps/admin-shell/index.html", "no-cache")]
    // the shell owns the site root: the platform rewrites "/" to the shell's page later in the pipeline
    [InlineData("/", "/apps/admin-shell/index.html", "no-cache")]
    // another admin UI owns the site root
    [InlineData("/", "/", null)]
    // the build's other files keep their caching
    [InlineData("/apps/admin-shell/index59423.js", "/apps/admin-shell/index59423.js", null)]
    [InlineData("/api/platform/apps", "/api/platform/apps", null)]
    public async Task Response_CacheControl_FollowsThePageServed(string requestPath, string servedPath, string expected)
    {
        var context = new DefaultHttpContext();
        var response = new RecordingResponseFeature();
        context.Features.Set<IHttpResponseFeature>(response);
        context.Request.Path = requestPath;

        var app = new ApplicationBuilder(new ServiceCollection().BuildServiceProvider());
        new AppIndexNoCacheStartupFilter().Configure(next => next.Run(ctx =>
        {
            // what the platform does after the filter: rewrite "/" and the app's folder to the file it serves
            ctx.Request.Path = servedPath;
            return Task.CompletedTask;
        }))(app);

        await app.Build()(context);
        await response.StartAsync();

        Assert.Equal(expected, context.Response.Headers.CacheControl.ToString() is { Length: > 0 } value ? value : null);
    }

    private sealed class RecordingResponseFeature : HttpResponseFeature
    {
        private readonly List<(Func<object, Task> Callback, object State)> _onStarting = [];

        public override void OnStarting(Func<object, Task> callback, object state) => _onStarting.Add((callback, state));

        public async Task StartAsync()
        {
            // ASP.NET runs them in reverse registration order
            for (var i = _onStarting.Count - 1; i >= 0; i--)
            {
                await _onStarting[i].Callback(_onStarting[i].State);
            }
        }
    }
}
