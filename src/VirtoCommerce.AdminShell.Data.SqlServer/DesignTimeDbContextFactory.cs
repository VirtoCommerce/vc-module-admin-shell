using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using VirtoCommerce.AdminShell.Data.Repositories;

namespace VirtoCommerce.AdminShell.Data.SqlServer;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AdminShellDbContext>
{
    public AdminShellDbContext CreateDbContext(string[] args)
    {
        var builder = new DbContextOptionsBuilder<AdminShellDbContext>();
        var connectionString = args.Length != 0 ? args[0] : "Server=(local);User=virto;Password=virto;Database=VirtoCommerce3;";

        builder.UseSqlServer(
            connectionString,
            options => options.MigrationsAssembly(typeof(SqlServerDataAssemblyMarker).Assembly.GetName().Name));

        return new AdminShellDbContext(builder.Options);
    }
}
