import Confidence from 'confidence';

const config = {
    $meta: 'Config file',
    server: {
        host: 'localhost',
        port: 3000,
    },
};
const criteria = {
    env: process.env.NODE_ENV || 'development',
};
const store = new Confidence.Store(config);
export const get = (key) => store.get(key, criteria);
export const meta = (key) => store.meta(key, criteria);
