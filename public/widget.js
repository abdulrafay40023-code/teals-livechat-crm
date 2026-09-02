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

  var propertySlug = (scriptEl && scriptEl.getAttribute('data-property-slug')) || 'teals-crm';
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

  function sendTracking(isNew) {
    if (isAdmin) return;
    try {
      var currentPath = window.location.pathname || '/';
      var referrer = document.referrer || 'Direct';

      fetch(serverOrigin + '/api/visitor/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: tabSessionId,
          visitorToken: visitorToken,
          propertySlug: propertySlug,
          currentPage: currentPath,
          referrer: referrer,
          isNewPageView: isNew
        })
      }).catch(function () {});
    } catch (e) {}
  }

  // Initial track on page load
  sendTracking(true);

  // 3.5-Second Active Heartbeat Ping
  setInterval(function () {
    if (isAdmin) return;
    try {
      var currentPath = window.location.pathname || '/';
      fetch(serverOrigin + '/api/visitor/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: tabSessionId,
          visitorToken: visitorToken,
          propertySlug: propertySlug,
          currentPage: currentPath
        })
      }).catch(function () {});
    } catch (e) {}
  }, 3500);

  // Instant departure notification via navigator.sendBeacon on tab close
  function handleOffline() {
    if (isAdmin) return;
    try {
      var payload = JSON.stringify({
        sessionId: tabSessionId,
        propertySlug: propertySlug
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(serverOrigin + '/api/visitor/offline', payload);
      } else {
        fetch(serverOrigin + '/api/visitor/offline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {}
  }

  window.addEventListener('beforeunload', handleOffline);
  window.addEventListener('pagehide', handleOffline);

  // Embed Live Chat Iframe
  if (!isAdmin) {
    var iframe = document.createElement('iframe');
    iframe.id = 'teals-livechat-iframe';
    iframe.src = serverOrigin + '/widget?property=' + encodeURIComponent(propertySlug) + '&session=' + encodeURIComponent(tabSessionId) + '&token=' + encodeURIComponent(visitorToken);
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
