// With `output: 'export'`, Next.js loads page data from `<route>.txt`. If that
// fails (most often after a deploy, when an old page reads the new build's
// data), Next falls back to a full page load of the response URL — the raw
// `.txt` file — so the user ends up on e.g. /dashboard/home.txt.
//
// This script runs before Next and makes those fallbacks load the real page:
// 1. RSC fetch responses report the page URL instead of the `.txt` URL, and a
//    failed RSC fetch becomes an error response for the page URL.
// 2. Where the Navigation API exists, any navigation to a same-origin `.txt`
//    URL that was just fetched as page data (e.g. after a network error) is
//    redirected to the page.
export function getRscNavigationGuardScript() {
  return `(function () {
  function isRscData(u) {
    return u.origin === location.origin && /\\.txt$/.test(u.pathname);
  }
  function toPageUrl(u) {
    var x = new URL(u, location.href);
    x.searchParams.delete('_rsc');
    x.pathname = x.pathname.replace(/\\/index\\.txt$/, '/').replace(/\\.txt$/, '');
    return x.href;
  }

  var fetchedData = {};
  var nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var p = nativeFetch.apply(this, arguments);
      var u;
      try {
        u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
      } catch (e) { return p; }
      if (!isRscData(u) || !u.searchParams.has('_rsc')) return p;
      fetchedData[u.pathname] = true;
      return p.then(function (res) {
        try {
          var pageUrl = toPageUrl(res.url || u.href);
          Object.defineProperty(res, 'url', { value: pageUrl, configurable: true });
        } catch (e) {}
        return res;
      }, function (err) {
        // A failed request makes Next fall back to the raw .txt URL. Hand it an
        // error response for the page instead, so it reloads the page itself.
        if (err && err.name === 'AbortError') throw err;
        var res = new Response('', { status: 503 });
        Object.defineProperty(res, 'url', { value: toPageUrl(u.href), configurable: true });
        return res;
      });
    };
  }

  if (window.navigation && window.navigation.addEventListener) {
    window.navigation.addEventListener('navigate', function (e) {
      try {
        var u = new URL(e.destination.url);
        if (!isRscData(u) || !fetchedData[u.pathname] || !e.cancelable || e.navigationType === 'traverse') return;
        e.preventDefault();
        location.assign(toPageUrl(u.href));
      } catch (err) {}
    });
  }
})();`;
}
