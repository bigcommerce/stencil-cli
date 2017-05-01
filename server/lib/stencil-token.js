var wreck = require('wreck');

module.exports = {
    /**
     * Simple function to create the needed base64 token for Stencil Authorization
     * @param {string} username
     * @param {string} token
     */
    generate: function (username, token) {
        if (!username || !token) {
            throw new Error('Username/token required!');
        }

        return new Buffer(username + ':' + token).toString('base64');
    },

    /**
     * Request Authorization from the V2 Api
     * @param {object} options
     * @param {function} callback
     */
    getAuth: function (options, callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        options = options || {};

        var self = this;
        var apiUrl = options.host + '/api/v2/time';

        try {
            var httpsOpts = {
                rejectUnauthorized: false,
                headers: {
                    'Authorization': 'Basic ' + self.generate(options.username, options.token),

                },
            };

        } catch (e) {
            return console.error(
                e.message.red +
                ' Please re-run stencil init to enter a valid username and token'.cyan
            );
        }
        wreck.request('get', apiUrl, httpsOpts, function (err, authRepsonse) {
            if (err) {
                return callback(err);
            }

            if (authRepsonse.statusCode !== 401) {
                return callback(null, {authorized: true, statusCode: authRepsonse.statusCode})
            } else {
                return callback(null, {authorized: false,  statusCode: authRepsonse.statusCode})
            }
        })
    },
};
