class StencilCLISettings {
    constructor() {
        // The setting enables/disables verbose network requests logging
        this.versboseNetworkLogging = true;
        // Enables usage of node sass fork for testing purposes
        this.oldNodeSassFork = false;
    }

    setVerbose(flag) {
        this.versboseNetworkLogging = flag;
    }

    isVerbose() {
        return this.versboseNetworkLogging === true;
    }

    useOldNodeSassFork(flag) {
        this.oldNodeSassFork = flag;
    }

    isOldNodeSassForkEnabled() {
        return this.oldNodeSassFork;
    }
}

const settings = new StencilCLISettings();

module.exports = settings;
