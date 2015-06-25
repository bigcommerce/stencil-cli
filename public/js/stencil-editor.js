var chan = Channel.build({window: window.parent, origin: '*', scope: 'stencilEditor'});

setInterval(function(){
    document.body.focus();
}, 250);

chan.bind('reload-stylesheets', function(trans, stylesheets) {
    var i = -1,
        length,
        stylesheetHref;

    stylesheets = JSON.parse(stylesheets);

    length = stylesheets.length;

    while (++i < length) {
        stylesheetHref = stylesheets[i];
        document.getElementById(stylesheetHref).setAttribute('href', stylesheetHref + '?' + Date.now());
    }

    return true;
});

chan.bind('reload-page', function() {
    document.location.reload(true);

    return true;
});
