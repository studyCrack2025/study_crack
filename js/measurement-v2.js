/* DRAFT: integrate with server-validated authentication and payment responses.
 * This file does not authenticate a user or verify a payment by itself.
 * Never pass checkoutData, query-string amounts, or success-page visits to purchase().
 * Release together with the V2 GTM workspace and GA4 history-pageview setting.
 */
(function (root) {
  'use strict';
  if (root.SCMeasurementV2) return;
  var initialized = false, identity = null, lastPage = null;
  var purchases = Object.create(null), first = null;
  var allowed = /^(cta_click|sign_up|login|score_input_start|score_input_complete|analysis_view|university_recommendation_view|score_impact_view|learning_profile_start|learning_profile_complete|target_university_set|plan_view|begin_checkout|download_report_click|tutorial_begin|tutorial_complete|tutorial_skip)$/;
  function cleanId(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(value) || /^(undefined|null|guest|anonymous)$/i.test(value)) throw new Error('Expected an opaque internal user ID or null');
    return value;
  }
  function token(value) { return typeof value === 'string' && /^[A-Za-z0-9_. /-]{1,100}$/.test(value) ? value : null; }
  function read(key) { try { return root.localStorage.getItem(key); } catch (_) { return null; } }
  function write(key, value) { try { root.localStorage.setItem(key, value); return true; } catch (_) { return false; } }
  function firstTouch() {
    if (first) return first;
    try { first = JSON.parse(read('sc_first_touch_v2')); } catch (_) { first = null; }
    if (first && first.version === '2') return first;
    var q = new URL(root.location.href).searchParams;
    first = {version:'2', source:token(q.get('utm_source')), medium:token(q.get('utm_medium')), campaign:token(q.get('utm_campaign'))};
    // Store an atomic first-observed snapshot; never reuse legacy per-field UTM values.
    if (!first.source && !first.medium && !first.campaign) {
      var referringHost = null;
      try { referringHost = new URL(root.document.referrer).hostname; } catch (_) {}
      first.source = referringHost || '(direct)'; first.medium = referringHost ? 'referral' : '(none)';
    }
    write('sc_first_touch_v2', JSON.stringify(first));
    return first;
  }
  function safeUrl(value) {
    if (!value) return '';
    var u = new URL(value, root.location.href), query = new URLSearchParams();
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','dclid','gbraid','wbraid'].forEach(function(k) {
      var value = u.searchParams.get(k);
      if (value && /^[A-Za-z0-9_. /-]{1,200}$/.test(value)) query.set(k,value);
    });
    return u.origin + u.pathname + (query.toString() ? '?' + query.toString() : '');
  }
  function envelope(name, extra) {
    var ft = firstTouch();
    var value = {version:'2',ready:initialized,user_id:identity,event_name:name,entry:null,method:null,plan_type:null,analysis_type:null,
      page_location:safeUrl(root.location.href),page_referrer:safeUrl(root.document.referrer),page_title:root.document.title,
      sc_first_source:ft.source,sc_first_medium:ft.medium,sc_first_campaign:ft.campaign,ecommerce:null,purchase_verified:false};
    Object.keys(extra || {}).forEach(function(k) { value[k] = extra[k]; });
    return value;
  }
  function push(event, value) { root.dataLayer = root.dataLayer || []; root.dataLayer.push({event:event,sc:value}); }
  function requireReady() { if (!initialized) throw new Error('Call ready() after resolving the server-validated session'); }
  function ready(userId) {
    if (initialized) return;
    identity = cleanId(userId); initialized = true;
    push('sc_measurement_ready',envelope(null));
    pageView();
  }
  function setIdentity(userId) {
    requireReady(); var next = cleanId(userId);
    if (next === identity) return;
    identity = next;
    push('sc_identity_changed',envelope(null));
  }
  function pageView() {
    requireReady();
    var url = safeUrl(root.location.href);
    if (url === lastPage) return false;
    var previous = lastPage; lastPage = url;
    push('sc_measurement_event',envelope('page_view',{page_referrer:previous || safeUrl(root.document.referrer)}));
    return true;
  }
  function event(name, fields) {
    requireReady();
    if (!allowed.test(name)) throw new Error('Unsupported event');
    var clean = {}, data = fields || {};
    ['entry','method','plan_type','analysis_type'].forEach(function(k) { if (data[k] !== undefined) clean[k] = token(data[k]); });
    if (name === 'begin_checkout' && data.ecommerce) clean.ecommerce = ecommerce(data.ecommerce, false);
    push('sc_measurement_event',envelope(name,clean));
  }
  function ecommerce(order, requireTransaction) {
    if (typeof order.value !== 'number' || !Number.isFinite(order.value) || order.value < 0 || order.currency !== 'KRW') throw new Error('Invalid authoritative order amount');
    if (!/^(basic|starter|standard|pro)$/.test(order.plan_type)) throw new Error('Unknown plan');
    if (requireTransaction && (typeof order.transaction_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(order.transaction_id) || /^(undefined|null)$/i.test(order.transaction_id))) throw new Error('Missing transaction_id');
    return {transaction_id:requireTransaction ? order.transaction_id : null,value:order.value,currency:'KRW',items:[{item_id:order.plan_type,item_name:order.plan_type,price:order.value,quantity:1}]};
  }
  async function purchase(serverVerifiedOrder) {
    requireReady();
    if (!serverVerifiedOrder || serverVerifiedOrder.status !== 'paid') throw new Error('A server-confirmed paid order is required');
    var ec = ecommerce(serverVerifiedOrder, true), key = 'sc_purchase_v2:' + ec.transaction_id;
    function dispatch() {
      if (purchases[key] || read(key)) return false;
      // At-most-once browser dispatch; this is not an acknowledgement from GA4.
      purchases[key] = true; write(key,'dispatched');
      push('sc_verified_purchase',envelope('purchase',{purchase_verified:true,plan_type:serverVerifiedOrder.plan_type,ecommerce:ec}));
      return true;
    }
    if (root.navigator && root.navigator.locks) return root.navigator.locks.request(key,dispatch);
    return dispatch();
  }
  root.SCMeasurementV2 = Object.freeze({ready:ready,setIdentity:setIdentity,pageView:pageView,event:event,purchase:purchase});
})(window);


(function (root) {
  'use strict';
  var api = root.SCMeasurementV2, resolved = false, queue = [], once = Object.create(null);
  function identify(id) {
    try {
      if (!resolved) { api.ready(id); resolved = true; }
      else api.setIdentity(id);
      var pending = queue; queue = [];
      pending.forEach(function (item) { emit(item[0], item[1]); });
    } catch (_) { /* Measurement must not interrupt the application. */ }
  }
  function emit(name, fields) {
    if (!resolved) { if (queue.length < 50) queue.push([name, fields]); return; }
    try { api.event(name, fields); } catch (_) {}
  }
  function emitOnce(key, name, fields) {
    if (once[key]) return;
    once[key] = true; emit(name, fields);
  }
  root.SCTrack = Object.freeze({identify:identify, event:emit, once:emitOnce});
  root.document.addEventListener('DOMContentLoaded', function () {
    var hasIdentity = false;
    try { hasIdentity = !!root.localStorage.getItem('userId'); } catch (_) {}
    if (!hasIdentity) identify(null);
    else if (typeof root.resolveUserIdentity !== 'function') {
      if (typeof root.resolveMeasurementIdentity === 'function') {
        root.resolveMeasurementIdentity().then(identify).catch(function () { identify(null); });
      } else identify(null);
    }
    // Never use an unverified cached ID when session resolution is unavailable.
    root.setTimeout(function () { if (!resolved) identify(null); }, 5000);
  });
  root.addEventListener('popstate', function () {
    if (resolved) { try { api.pageView(); } catch (_) {} }
  });
  root.addEventListener('storage', function (event) {
    if (event.key === 'userId' || event.key === null) identify(null);
  });
})(window);
