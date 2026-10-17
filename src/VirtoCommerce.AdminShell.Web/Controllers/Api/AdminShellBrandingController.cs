using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtoCommerce.AdminShell.Core.Models;
using VirtoCommerce.AdminShell.Web.Services;

namespace VirtoCommerce.AdminShell.Web.Controllers.Api;

[Route("api/admin-shell/branding")]
public class AdminShellBrandingController(BrandingService brandingService) : Controller
{
    /// <summary>
    /// The installation's white-labeling: brand, links, the sign-in page's showcase, Home's welcome card and the themes.
    /// Anonymous: the sign-in page shows the brand before anyone signs in.
    /// </summary>
    [HttpGet("")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true)]
    public Task<Branding> GetBranding() => brandingService.GetBrandingAsync();
}
