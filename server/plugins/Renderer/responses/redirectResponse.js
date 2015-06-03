var _ = require('lodash');

module.exports = function (location, headers, statusCode) {

    this.respond = function (request, reply) {
        var response = reply.redirect(location);

        response.statusCode = statusCode;

        _.each(headers, function (value, name) {
            response.header(name, value);
        });

        return response;
    };
};
