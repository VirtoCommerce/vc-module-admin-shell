// Call this to register your module to main application
var moduleName = 'VirtoCommerce.AdminShell';

if (AppDependencies !== undefined) {
    AppDependencies.push(moduleName);
}

angular.module(moduleName, [])
    .config(['$stateProvider',
        function ($stateProvider) {
            $stateProvider
                .state('workspace.AdminShellState', {
                    url: '/admin-shell',
                    templateUrl: '$(Platform)/Scripts/common/templates/home.tpl.html',
                    controller: [
                        'platformWebApp.bladeNavigationService',
                        function (bladeNavigationService) {
                            var newBlade = {
                                id: 'blade1',
                                controller: 'VirtoCommerce.AdminShell.helloWorldController',
                                template: 'Modules/$(VirtoCommerce.AdminShell)/Scripts/blades/hello-world.html',
                                isClosingDisabled: true,
                            };
                            bladeNavigationService.showBlade(newBlade);
                        }
                    ]
                });
        }
    ])
    .run(['platformWebApp.mainMenuService', '$state',
        function (mainMenuService, $state) {
            //Register module in main menu
            var menuItem = {
                path: 'browse/admin-shell',
                icon: 'fa fa-cube',
                title: 'Admin Shell',
                priority: 100,
                action: function () { $state.go('workspace.AdminShellState'); },
                permission: 'admin-shell:access',
            };
            mainMenuService.addMenuItem(menuItem);
        }
    ]);
