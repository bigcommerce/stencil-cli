class RedirectResponse {
    /**
     * @param {string} location
     * @param {{[string]: string[]}} headers
     * @param {number} statusCode
     */
    constructor(location, headers, statusCode) {
        this.location = location;
        this.headers = headers;
        this.statusCode = statusCode;
    }

    respond(request, h) {
        const response = h.redirect(this.location).code(this.statusCode);

        for (const [name, values] of Object.entries(this.headers)) {
            switch (name) {
                case 'transfer-encoding':
                    break;
                case 'set-cookie':
                    // Cookies should be an array
                    response.header(
                        'set-cookie',
                        values.map((val) =>
                            val
                                .replace(/; Secure/gi, '')
                                .replace(/(?:;\s)?domain=(?:.+?)(;|$)/gi, ''),
                        ),
                    );
                    break;
                default:
                    // Other headers should be strings
                    response.header(name, values.toString());
            }
        }

        return response;
    }
}

module.exports = RedirectResponse;
