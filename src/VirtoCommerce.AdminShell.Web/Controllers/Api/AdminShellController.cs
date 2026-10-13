using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Permissions = VirtoCommerce.AdminShell.Core.ModuleConstants.Security.Permissions;

namespace VirtoCommerce.AdminShell.Web.Controllers.Api;

[Authorize]
[Route("api/admin-shell")]
public class AdminShellController : Controller
{
    // GET: api/admin-shell
    /// <summary>
    /// Get message
    /// </summary>
    /// <remarks>Return "Hello world!" message</remarks>
    [HttpGet]
    [Route("")]
    [Authorize(Permissions.Read)]
    public ActionResult<string> Get()
    {
        return Ok(new { result = "Hello world!" });
    }
}
