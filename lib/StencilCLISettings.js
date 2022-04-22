class StencilCLISettings {
    constructor() {
        // The setting enables/disables verbose network requests logging
        this.versboseNetworkLogging = true;
    }

    setVerbose(flag) {
        this.versboseNetworkLogging = flag;
    }

    isVerbose() {
        return this.versboseNetworkLogging === true;
    }
}

const settings = new StencilCLISettings();

module.exports = settings;
