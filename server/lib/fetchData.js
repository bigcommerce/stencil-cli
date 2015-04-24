var Hoek = require('hoek'),
    Url = require('url'),
    Utils = require('./utils'),
    Wreck = require('wreck');

module.exports.fetch = fetch;

/**
 * Fetches data from Stapler
 *
 * @param request
 * @param params
 * @param callback
 */
function fetch(request, params, callback) {
    var options = {get_data_only: true},
        url = Url.resolve(request.app.staplerUrl, request.url),
        httpOpts = {
            rejectUnauthorized: false,
            headers: {}
        };

    if (typeof params === 'function') {
        callback = params;
        params = {
            config: {},
            options: options
        };
    } else {
        params = Hoek.applyToDefaults({options: options, config: {}}, params);
    }

    httpOpts.headers = {
        'stencil-version': '2.0',
        'stencil-config': JSON.stringify(params.config),
        'stencil-options': JSON.stringify(params.options),
        'stencil-store-url': request.app.storeUrl
    };

    if (request.headers.cookie) {
        httpOpts.headers.cookie = request.headers.cookie;
    }

    callback = Hoek.nextTick(callback);

    Wreck.request('GET', url, httpOpts, function (err, response) {
        if (err) {
            return callback(err);
        }

        if (response.statusCode >= 500) {
            return callback(new Error('bc-app responded with a 500 error'));
        }
        
        if (response.headers['set-cookie']) {
            response.headers['set-cookie'] = Utils.stripDomainFromCookies(response.headers['set-cookie']);
        }

        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303) {

            if (! response.headers.location) {
                return callback('StatusCode is set to 30x but there is no location header to redirect to.');
            }

            response.headers.location = Utils.normalizeRedirectUrl(request, response.headers.location);

            return callback(null, {
                headers: response.headers,
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
                    headers: response.headers,
                    statusCode: response.statusCode
                });
            }

            callback(null, {
                template_file: data.template_file,
                context: data.context,
                headers: response.headers,
                statusCode: response.statusCode
            });
        });
    });
}
