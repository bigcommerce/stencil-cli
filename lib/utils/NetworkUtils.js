import https from 'https';
import fsModule from 'fs';
import axios from 'axios';
import { PACKAGE_INFO } from '../../constants.js';
import stencilCLISettings from '../StencilCLISettings.js';

const defaultHttpsAgent = new https.Agent({ rejectUnauthorized: false });
class NetworkUtils {
    constructor({
        fs = fsModule,
        httpsAgent = defaultHttpsAgent,
        reqLibrary = axios,
        packageInfo = PACKAGE_INFO,
        logger = console,
    } = {}) {
        this._fs = fs;
        this._httpsAgent = httpsAgent;
        this._reqLibrary = reqLibrary;
        this._packageInfo = packageInfo;
        this._logger = logger;
    }

    /** Used to send request to our (Bigcommerce) servers only.
     *  Shouldn't be used to send requests to third party servers because we disable https checks
     *
     * @param {object} options
     * @param {string} options.url
     * @param {object} [options.headers]
     * @param {string} [options.accessToken]
     * @returns {Promise<object>}
     */
    async sendApiRequest(options) {
        const { accessToken, ...restOpts } = options;
        const reqConfig = {
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            httpsAgent: this._httpsAgent,
            ...restOpts,
            headers: {
                'x-auth-client': 'stencil-cli',
                'stencil-cli': this._packageInfo.version,
                'stencil-version': this._packageInfo.config.stencil_version,
                ...(restOpts.headers || {}),
            },
        };
        if (accessToken) {
            reqConfig.headers['x-auth-token'] = accessToken;
        }
        if (stencilCLISettings.isVerbose()) {
            this.log(reqConfig);
        }
        return this._reqLibrary(reqConfig);
    }

    /**
     * @param {string} url
     * @param {string} outputPath
     * @returns {Promise<any>}
     */
    async fetchFile(url, outputPath) {
        const response = await this.sendApiRequest({
            url,
            responseType: 'stream',
        });
        return new Promise((resolve, reject) => {
            response.data
                .pipe(this._fs.createWriteStream(outputPath))
                .on('finish', resolve)
                .on('error', reject);
        });
    }

    log(config) {
        const method = config.method || 'GET';
        this._logger.info(`Upcoming request ${method.green}: ${config.url.green}`);
    }
}
export default NetworkUtils;
