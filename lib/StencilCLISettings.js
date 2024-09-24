class StencilCLISettings {
    constructor() {
        // The setting enables/disables verbose network requests logging
        this.versboseNetworkLogging = false;
        // Enables usage of node sass fork for testing purposes
        this.oldNodeSassFork = false;
    }

    setVerbose(flag) {
        this.versboseNetworkLogging = flag;
    }

    isVerbose() {
        return this.versboseNetworkLogging;
    }
}
const settings = new StencilCLISettings();
export default settings;
