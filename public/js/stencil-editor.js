'use strict';

(function stencilEditorSDK(window, Channel) {
    var _cookieName = 'stencil_editor_enabled',
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
     * Adds a link element with the passed font url
     * @param trans - jsChannel transaction
     * @param data - object containing the font collection string
     */
    function addFont(trans, data) {
        var link = document.createElement('link'),
            linkLoadHandler;

        try {
            data = JSON.parse(data);
        } catch (e) {
            return false;
        }

        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', data.fontUrl);

        linkLoadHandler = link.addEventListener('load', function newFontLoaded() {
            link.removeEventListener('load', linkLoadHandler);

            focusBody();
        });

        document.head.appendChild(link);

        return true;
    }

    /**
     * Removes the cookie and reloads the page
     */
    function closePreview(event) {
        event.preventDefault();

        window.Cookies.remove(_cookieName);
        reloadPage();
    }

    /**
     * Force the browser to repaint the page after a stylesheet update
     */
    function focusBody() {
        document.body.focus();
    }

    /**
     * Getter for editorToken
     * This token value is used for the cookie
     * @returns {string}
     */
    function getEditorToken() {
        return _editorToken;
    }

    function getStylesheet(href) {
        return document.head.querySelector('link[id="' + href + '"]');
    }

    function isStylesheet(element) {
        return element !== null && element !== undefined;
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

        chan.bind('add-font', addFont);
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
        try {
            stylesheets = JSON.parse(stylesheets);
        } catch(e) {
            stylesheets = [];
        }

        stylesheets.map(getStylesheet).filter(isStylesheet).forEach(function updateStylesheets(currentLink) {
            var href = currentLink.getAttribute('href'),
                hrefBase = currentLink.getAttribute('href'),
                queryIndex = href.indexOf('?'),
                newLink = currentLink.cloneNode(false),
                newLinkErrorHandler,
                newLinkLoadHandler,
                newHref;

            if (!href) {
                return;
            }

            if (queryIndex !== -1) {
                hrefBase = href.substring(0, queryIndex);
            }

            newHref = hrefBase + '?' + Date.now();
            newLink.setAttribute('href', newHref);

            newLinkLoadHandler = newLink.addEventListener('load', function stylesheetLoad() {
                // Destroy any existing handlers to save memory on subsequent stylesheet changes
                newLink.removeEventListener('error', newLinkErrorHandler);
                newLink.removeEventListener('load', newLinkLoadHandler);

                // Remove the old stylesheet to allow the new one to take over
                currentLink.remove();

                focusBody();
            });

            newLinkErrorHandler = newLink.addEventListener('error', function stylesheetError() {
                // Something went wrong with our new stylesheet, so destroy it and keep the old one
                newLink.removeEventListener('error', newLinkErrorHandler);
                newLink.removeEventListener('load', newLinkLoadHandler);
                newLink.remove();
            });

            // Insert the new stylesheet before the old one to avoid any flash of un-styled content. The load
            // and error events only work for the initial load, which is why we replace the link on each update.
            document.head.insertBefore(newLink, currentLink);
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
        window.Cookies.set(_cookieName, getEditorToken());
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
