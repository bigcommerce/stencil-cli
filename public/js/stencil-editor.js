var chan = Channel.build({window: window.parent, origin: '*', scope: 'stencilEditor'});

setInterval(function focusBody(){
    document.body.focus();
}, 250);

chan.bind('reload-stylesheets', function reloadStylesheets(trans, stylesheets) {
    var linkElements = Array.prototype.slice.call(document.getElementsByTagName('link'));

    stylesheets = JSON.parse(stylesheets);

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
});

chan.bind('reload-page', function reloadPage() {
    document.location.reload(true);

    return true;
});
