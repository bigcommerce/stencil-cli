var _ = require('lodash');

module.exports = function (data, headers, statusCode) {

    this.respond = function (request, reply) {
        var response = reply(data);

        response.statusCode = statusCode;

        _.each(headers, function (value, name) {
            response.header(name, value);
        });

        return response;
    };
};
