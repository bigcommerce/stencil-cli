var Hoek = require('hoek'),
    Url = require('url'),
    Wreck = require('wreck');

module.exports.fetch = fetch;

/**
 * Fetches data from Stapler
 *
 * @param request
 * @param config
 * @param callback
 */
function fetch(request, config, callback) {
    var url = Url.resolve(request.app.storeUrl, request.url),
        httpOpts = {
            rejectUnauthorized: false,
            headers: {
                'SFP-THEME-ENGINE': '2.0',
                'SFP-THEME-CONFIG': JSON.stringify(config)
            }
        };

    if (request.headers.cookie) {
        httpOpts.headers.cookie = request.headers.cookie;
    }

    callback = Hoek.nextTick(callback);

    Wreck.request('GET', url, httpOpts, function (err, response) {
        if (err) {
            return callback(err);
        }

        if (response.statusCode == 301 || response.statusCode == 302 || response.statusCode == 303) {
            return callback(null, {
                redirect: response.headers.location,
                statusCode: response.statusCode
            });
        }

        Wreck.read(response, {json: true}, function (err, data) {
            if (err) {
                return callback(err);
            }

            if (! data.template_file) {
                return callback(null, {
                    rawData: data,
                    headers: response.headers
                })
            }

            callback(null, {
                template_file: data.template_file,
                headers: response.headers,
                context: data.context
            });
        });
    });
}
