angular.module('VirtoCommerce.AdminShell')
    .controller('VirtoCommerce.AdminShell.helloWorldController', ['$scope', 'VirtoCommerce.AdminShell.webApi', function ($scope, api) {
        var blade = $scope.blade;
        blade.title = 'Admin Shell';

        blade.refresh = function () {
            api.get(function (data) {
                blade.title = 'admin-shell.blades.hello-world.title';
                blade.data = data.result;
                blade.isLoading = false;
            });
        };

        blade.refresh();
    }]);
