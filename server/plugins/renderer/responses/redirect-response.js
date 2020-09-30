class RedirectResponse {
    /**
     * @param {string} location
     * @param {Object} headers
     * @param {number} statusCode
     */
    constructor(location, headers, statusCode) {
        this.location = location;
        this.headers = headers;
        this.statusCode = statusCode;
    }

    respond(request, h) {
        const response = h.redirect(this.location).code(this.statusCode);

        for (const [name, value] of Object.entries(this.headers)) {
            switch (name) {
                case 'transfer-encoding':
                    break;
                case 'set-cookie':
                    response.header(
                        'set-cookie',
                        value.replace(/; Secure$/, '').replace(/; domain=(.+)$/, ''),
                    );
                    break;
                default:
                    response.header(name, value);
            }
        }

        return response;
    }
}

module.exports = RedirectResponse;
