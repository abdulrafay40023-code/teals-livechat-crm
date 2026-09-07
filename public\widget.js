(function () {
  'use strict';

  // Prevent multiple executions
  if (window.__TEALS_WIDGET_LOADED__) return;
  window.__TEALS_WIDGET_LOADED__ = true;

  var scriptEl = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var serverOrigin = 'https://teals-livechat-saas.vercel.app';
  if (scriptEl && scriptEl.src) {
    try {
      var url = new URL(scriptEl.src);
      serverOrigin = url.origin;
    } catch (e) {}
  }

  var currentHost = (window.location.hostname || '').toLowerCase();
  // Disable widget and tracking on CRM / salesflow-ai / teals portal sites
  if (currentHost.indexOf('salesflow-ai') !== -1 || currentHost.indexOf('teals-livechat') !== -1) {
    return;
  }

  function detectSlugFromHostname(hostname) {
    var h = (hostname || '').toLowerCase();
    if (h.indexOf('amzsolutionshub.com') !== -1) return 'amz-solutions-hub';
    if (h.indexOf('amzinnovators.com') !== -1) return 'amz-innovators';
    if (h.indexOf('authorsbreeze.com') !== -1) return 'authors-breeze';
    if (h.indexOf('probookpublishing.com') !== -1) return 'pro-book-publishing';
    if (h.indexOf('amzwritershub.com') !== -1) return 'amz-writers-hub';
    return null;
  }

  var explicitSlug = scriptEl && scriptEl.getAttribute('data-property-slug');
  var detectedSlug = detectSlugFromHostname(window.location.hostname);
  var propertySlug = explicitSlug || detectedSlug || 'teals-crm';
  var isAdmin = window.location.pathname.startsWith('/dashboard') || window.location.pathname.startsWith('/admin');

  // PER-TAB SESSION ID GENERATED STRICTLY ONCE PER TAB
  var tabSessionId;
  try {
    tabSessionId = sessionStorage.getItem('teals_tab_session_id');
  } catch (e) {}

  if (!tabSessionId) {
    tabSessionId = 'tab_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    try {
      sessionStorage.setItem('teals_tab_session_id', tabSessionId);
    } catch (e) {}
  }

  // TAB START TIME: Locked once per tab in sessionStorage so duration never resets on refresh/nav
  var tabStartTime;
  try {
    tabStartTime = sessionStorage.getItem('teals_tab_start_time');
  } catch (e) {}

  if (!tabStartTime) {
    tabStartTime = new Date().toISOString();
    try {
      sessionStorage.setItem('teals_tab_start_time', tabStartTime);
    } catch (e) {}
  }

  // Persistent visitor token across reloads
  var visitorToken;
  try {
    visitorToken = localStorage.getItem('teals_visitor_token');
  } catch (e) {}

  if (!visitorToken) {
    visitorToken = 'vis_' + Math.random().toString(36).substring(2, 10);
    try {
      localStorage.setItem('teals_visitor_token', visitorToken);
    } catch (e) {}
  }

  function getCurrentPageInfo() {
    var path = window.location.pathname || '/';
    var title = document.title || '';
    return {
      path: path,
      fullUrl: window.location.href || '',
      title: title
    };
  }

  function sendTracking(isNew) {
    if (isAdmin) return;
    try {
      var pageInfo = getCurrentPageInfo();
      var referrer = document.referrer || 'Direct';

      fetch(serverOrigin + '/api/visitor/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: tabSessionId,
          visitorToken: visitorToken,
          propertySlug: propertySlug,
          currentPage: pageInfo.path,
          fullUrl: pageInfo.fullUrl,
          pageTitle: pageInfo.title,
          referrer: referrer,
          isNewPageView: isNew,
          sessionStartTime: tabStartTime
        })
      }).catch(function () {});
    } catch (e) {}
  }

  // Initial track on page load
  sendTracking(true);

  function sendPing() {
    if (isAdmin) return;
    try {
      var pageInfo = getCurrentPageInfo();
      fetch(serverOrigin + '/api/visitor/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: tabSessionId,
          visitorToken: visitorToken,
          propertySlug: propertySlug,
          currentPage: pageInfo.path,
          fullUrl: pageInfo.fullUrl,
          pageTitle: pageInfo.title,
          sessionStartTime: tabStartTime
        })
      }).then(function (res) {
        return res.json();
      }).then(function (data) {
        if (data && data.retrackNeeded) {
          sendTracking(false);
        }
      }).catch(function () {});
    } catch (e) {}
  }

  // SPA navigation listener to immediately update active page
  function onPageNavigated() {
    setTimeout(function () {
      sendPing();
    }, 150);
  }
  window.addEventListener('popstate', onPageNavigated);
  window.addEventListener('hashchange', onPageNavigated);
  if (window.history && window.history.pushState) {
    var _origPush = window.history.pushState;
    window.history.pushState = function () {
      var ret = _origPush.apply(this, arguments);
      onPageNavigated();
      return ret;
    };
  }
  if (window.history && window.history.replaceState) {
    var _origReplace = window.history.replaceState;
    window.history.replaceState = function () {
      var ret = _origReplace.apply(this, arguments);
      onPageNavigated();
      return ret;
    };
  }

  // 5-Second Active Heartbeat Ping
  setInterval(sendPing, 5000);

  // Background Web Worker: Continues pinging every 10s even when Chrome on mobile is minimized/backgrounded
  try {
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
      var workerBlob = new Blob([
        'setInterval(function() { postMessage("ping"); }, 10000);'
      ], { type: 'application/javascript' });
      var workerUrl = URL.createObjectURL(workerBlob);
      var bgWorker = new Worker(workerUrl);
      bgWorker.onmessage = function () {
        sendPing();
      };
    }
  } catch (workerErr) {}

  // Immediate ping and session re-verify when visitor switches back to the tab or unlocks phone
  if (typeof document.addEventListener !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        offlineSent = false;
        sendPing();
        sendTracking(false);
      }
    });
  }
  window.addEventListener('focus', function () {
    sendPing();
  });
  window.addEventListener('pageshow', function () {
    sendTracking(false);
  });

  // Throttled user interaction ping (max once per 8 seconds)
  var lastInteractionPing = 0;
  function onUserActive() {
    var now = Date.now();
    if (now - lastInteractionPing > 8000) {
      lastInteractionPing = now;
      sendPing();
    }
  }
  window.addEventListener('mousemove', onUserActive, { passive: true });
  window.addEventListener('scroll', onUserActive, { passive: true });
  window.addEventListener('touchstart', onUserActive, { passive: true });
  window.addEventListener('keydown', onUserActive, { passive: true });

  // Guard: Do not disconnect visitor if they click an internal link or submit a form on the same site
  var isNavigatingInternally = false;
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a && a.href) {
      try {
        var linkUrl = new URL(a.href, window.location.href);
        if (linkUrl.origin === window.location.origin) {
          isNavigatingInternally = true;
          setTimeout(function () {
            isNavigatingInternally = false;
          }, 4000);
        }
      } catch (err) {}
    }
  }, { capture: true, passive: true });

  document.addEventListener('submit', function () {
    isNavigatingInternally = true;
    setTimeout(function () {
      isNavigatingInternally = false;
    }, 4000);
  }, { capture: true, passive: true });

  // Instant departure notification on actual tab close / window unload / pagehide
  var offlineSent = false;
  function handleOffline(e) {
    if (isAdmin || isNavigatingInternally || offlineSent) return;
    offlineSent = true;
    try {
      var url = serverOrigin + '/api/visitor/offline?sessionId=' + encodeURIComponent(tabSessionId) + '&_t=' + Date.now();

      // 1. Synchronous Image GET Beacon (zero CORS preflight, guaranteed transmission on Android Chrome, iOS Safari & Desktop)
      try {
        var img = new Image();
        img.src = url;
      } catch (imgErr) {}

      // 2. Standard navigator.sendBeacon
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, 'offline');
        }
      } catch (beaconErr) {}

      // 3. fetch with keepalive
      try {
        if (typeof fetch !== 'undefined') {
          fetch(url, { method: 'POST', keepalive: true, mode: 'no-cors' }).catch(function () {});
        }
      } catch (fetchErr) {}
    } catch (e) {}
  }

  // Trigger offline when tab or window is closed on desktop or mobile
  window.addEventListener('beforeunload', handleOffline);
  window.addEventListener('pagehide', handleOffline);
  window.addEventListener('unload', handleOffline);

  // Embed Live Chat Iframe
  if (!isAdmin) {
    var iframe = document.createElement('iframe');
    iframe.id = 'teals-livechat-iframe';
    iframe.src = serverOrigin + '/widget?property=' + encodeURIComponent(propertySlug) + '&page=' + encodeURIComponent(window.location.href || window.location.pathname || '/') + '&ref=' + encodeURIComponent(document.referrer || 'Direct') + '&session=' + encodeURIComponent(tabSessionId) + '&token=' + encodeURIComponent(visitorToken) + '&_v=20260904_2';
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    iframe.style.right = '20px';
    iframe.style.width = '80px';
    iframe.style.height = '80px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '9999999';
    iframe.style.colorScheme = 'none';
    iframe.style.background = 'transparent';
    iframe.allow = 'autoplay';

    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'TEALS_WIDGET_RESIZE') {
        if (e.data.isOpen === true) {
          iframe.style.width = '400px';
          iframe.style.height = '580px';
        } else if (e.data.isOpen === 'bubble') {
          // Show greeting bubble - expand enough to not clip
          iframe.style.width = '340px';
          iframe.style.height = '130px';
        } else {
          iframe.style.width = '80px';
          iframe.style.height = '80px';
        }
      }
    });

    if (document.body) {
      document.body.appendChild(iframe);
    } else {
      window.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(iframe);
      });
    }
  }
})();
