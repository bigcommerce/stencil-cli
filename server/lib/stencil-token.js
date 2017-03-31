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
};
