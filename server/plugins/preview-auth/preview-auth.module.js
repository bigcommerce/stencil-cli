import { createHash, timingSafeEqual } from 'node:crypto';
import Boom from '@hapi/boom';

const PREVIEW_SECRET_HEADER = 'x-stencil-preview-secret';

// Hash both values so the comparison takes the same time for any input length.
function secretsMatch(expected, supplied) {
    const digest = (value) => createHash('sha256').update(value).digest();
    return timingSafeEqual(digest(expected), digest(supplied));
}

/**
 * Loaded only in Makeswift preview mode.
 */
function register(server, { secret }) {
    if (typeof secret !== 'string' || !secret) {
        throw new Error('PreviewAuth requires a non-empty secret');
    }
    server.ext('onRequest', (request, h) => {
        const supplied = request.headers[PREVIEW_SECRET_HEADER];
        if (typeof supplied !== 'string') {
            return Boom.unauthorized();
        }
        if (!secretsMatch(secret, supplied)) {
            return Boom.forbidden();
        }
        delete request.headers[PREVIEW_SECRET_HEADER];
        return h.continue;
    });
}
export const name = 'PreviewAuth';
export const version = '0.0.1';
export { register };
export default {
    register,
    name,
    version,
};
