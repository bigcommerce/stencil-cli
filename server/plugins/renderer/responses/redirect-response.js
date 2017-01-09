var _ = require('lodash');

module.exports = function (location, headers, statusCode) {

    this.respond = function (request, reply) {
        var response = reply.redirect(location);

        response.statusCode = statusCode;

        _.each(headers, (value, name) => {
            switch (name) {
            case 'transfer-encoding':
                break;

            case 'set-cookie':
                response.header('set-cookie', value.map(cookie => {
                    // remove domain & secure attributes
                    return cookie
                        .replace(/; Secure$/, '')
                        .replace(/; domain=(.+)$/, '');
                }));
                break;

            default:
                response.header(name, value);
            }
        });

        return response;
    };
};
