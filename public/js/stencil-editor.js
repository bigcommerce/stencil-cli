'use strict';

(function stencilEditorSDK(window, Channel) {
    var cookieName= 'stencil_editor_enabled',
        _editorToken;

    function init() {
        if (runningInIframe()) {
            registerJsChannelEvents();
        } else {
            insertBanner();
        }
    }

    init();

    /**
     * Removes the cookie and reloads the page
     */
    function closePreview(event) {
        event.preventDefault();

        Cookies.remove(cookieName);
        reloadPage();
    }

    /**
     * Getter for editorToken
     * This token value is used for the cookie
     * @returns {string}
     */
    function getEditorToken() {
        return _editorToken;
    }

    /**
     * Creates and prepends the Preview banner to the document body.
     */
    function insertBanner() {
        var banner = document.createElement('div'),
            bannerHeight,
            bodyMarginTop;

        banner.className = 'stencilEditorPreview-banner';
        banner.innerHTML =
            '<style>' +
                '.stencilEditorPreview-banner { ' +
                    'background-color: #556273;' +
                    'display: table;' +
                    'height: 62px;' +
                    'padding: 0 20px;' +
                    'position: absolute;' +
                    'top: -63px;' +
                    'width: 100%;' +
                '}' +
                '.stencilEditorPreview-close {' +
                    'color: #FFFFFF;' +
                    'display: table-cell;' +
                    'text-align: right;' +
                    'text-decoration: none;' +
                    'vertical-align: middle;' +
                '}' +
                '.stencilEditorPreview-logo {' +
                    'display: table-cell;' +
                    'height: 55px;' +
                    'vertical-align: middle;' +
                    'width: 55px;' +
                '}' +
                '.stencilEditorPreview-text {' +
                    'color: #FFFFFF;' +
                    'display: table-cell;' +
                    'vertical-align: middle' +
                '}' +
            '</style>' +

            '<div class="stencilEditorPreview-logo">' +
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -8 65 65">' +
                    '<g opacity=".6" fill="#00A9C7">' +
                        '<path d="M16 21.1c5 0 9.5 1.4 13 3.6 1.5-1.9 2.4-4.2 2.4-6.6 0-7.1-7.7-12.9-17.1-12.9C4.8 5.2 3.5 11 3.5 18.1c0 3.3.3 6.2 1.5 8.5 1.6-3.3 4.8-5.5 11-5.5z"/>' +
                        '<path d="M29 24.7c-3 3.8-8.4 6.3-14.7 6.3-5.1 0-7.8-1.7-9.3-4.4-1.2 2.6-1.5 5.9-1.5 9.4C3.5 44.3 5 51 16 51s19.9-6.7 19.9-15c0-4.5-2.7-8.5-6.9-11.3z"/>' +
                    '</g>' +
                    '<path fill="#00A9C7" d="M5 26.7c1.4 2.7 4.1 4.4 9.3 4.4 6.3 0 11.7-2.5 14.7-6.3-3.5-2.3-8-3.6-13-3.6-6.2-.1-9.4 2.1-11 5.5z"/>' +
                '</svg>' +
            '</div>' +
            '<h1 class="stencilEditorPreview-text">Theme Preview</h1>' +
            '<a id="editor-close-preview" class="stencilEditorPreview-close" href="#">Close</a>';

        document.body.appendChild(banner);

        bannerHeight = banner.offsetHeight;
        bodyMarginTop = window.parseInt(document.body.style.marginTop, 10);

        if (window.isNaN(bodyMarginTop)) {
            bodyMarginTop = 0;
        }

        document.body.style.marginTop = (bannerHeight + bodyMarginTop) + 'px';
        document.getElementById('editor-close-preview').onclick = closePreview;
    }

    /**
     * Ran when the jsChannel channel is ready and sets the editorToken cookie
     * @param trans - jsChannel transaction
     * @param data
     */
    function onReady(trans, data) {
        data = JSON.parse(data);

        setEditorToken(data.token);
        setCookie();
    }

    /*
     * Registers JsChannel subscriptions
     */
    function registerJsChannelEvents() {
        var chan = Channel.build({window: window.parent, origin: '*', scope: 'stencilEditor'});

        chan.bind('on-ready', onReady);
        chan.bind('reload-stylesheets', reloadStylesheets);
        chan.bind('reload-page', reloadPage);
        chan.bind('window-active', setCookie);
    }

    /**
     * Reloads the current page
     * @returns {boolean}
     */
    function reloadPage() {
        document.location.reload(true);

        return true;
    }

    /**
     * Reloads stylesheets by appending Date.now() to their href
     * @param trans - jsChannel transaction
     * @param stylesheets - stringified array of stylesheet names
     * @returns {boolean}
     */
    function reloadStylesheets(trans, stylesheets) {
        var linkElements = Array.prototype.slice.call(document.getElementsByTagName('link'));

        try {
            stylesheets = JSON.parse(stylesheets);
        } catch(e) {
            stylesheets = [];
        }

        linkElements.forEach(function iterateLinkElements(element) {
            var href = element.getAttribute('href'),
                queryIndex = href.indexOf('?');

            if (queryIndex !== -1) {
                href = href.substring(0, queryIndex);
            }

            if(stylesheets.indexOf(href) !== -1) {
                element.setAttribute('href', href + '?' + Date.now());
            }
        });

        return true;
    }

    /**
     * Checks if the current window is being run inside an iframe
     * @returns {boolean}
     */
    function runningInIframe() {
        try {
            return window.self !== window.top;
        } catch(e) {
            return true;
        }
    }

    /**
     * Sets the cookie with the current value of _editorToken
     */
    function setCookie() {
        Cookies.set(cookieName, getEditorToken());
    }

    /**
     * Setter for editorToken
     * This token value is used for the cookie
     * @param token
     */
    function setEditorToken(token) {
        _editorToken = token;
    }
})(window, Channel);
