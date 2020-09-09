class MockDB {
    constructor () {
        this._data = {};
    }

    get data () {
        return this._data;
    }

    set data (data) {
        this._data = data;
    }
}

module.exports = {
    MockDB,
};
