angular.module('VirtoCommerce.AdminShell')
    .factory('VirtoCommerce.AdminShell.webApi', ['$resource', function ($resource) {
        return $resource('api/admin-shell');
    }]);
