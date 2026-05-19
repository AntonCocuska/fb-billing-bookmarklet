/*
 * BOOKMARKLET: FB Billing — Set Address + Attach Card
 *
 * UI инжектится в текущую страницу как Shadow DOM overlay (правый верхний угол),
 * не закрывается при переключении вкладок/окон, живёт пока открыта вкладка.
 *
 * Запуск: https://adsmanager.facebook.com/adsmanager/manage/campaigns
 *
 * Сборка: python build_bookmarklet.py set_address.js
 */

(function () {
  'use strict';

  // === Re-open guard: если уже инжектировано — фокусируем и выходим =========
  var EXISTING = document.getElementById('fb-bm-host');
  if (EXISTING) {
    EXISTING.style.display = 'block';
    var existingBackdrop = document.getElementById('fb-bm-backdrop');
    if (existingBackdrop) existingBackdrop.style.display = 'block';
    return;
  }

  // === Утилиты выборки токенов ==============================================
  function tryRequire(name) {
    try { return require(name); } catch (e) { return null; }
  }
  function readDtsg() {
    var d = tryRequire('DTSGInitData') || tryRequire('DTSGInitialData');
    if (d && d.token) return d.token;
    var el = document.querySelector('input[name="fb_dtsg"]');
    if (el && el.value) return el.value;
    var html = document.documentElement.innerHTML;
    var m = html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/);
    if (m) return m[1];
    m = html.match(/name="fb_dtsg" value="([^"]+)"/);
    return m ? m[1] : null;
  }
  function readLsd() {
    var l = tryRequire('LSD');
    if (l && l.token) return l.token;
    var html = document.documentElement.innerHTML;
    var m = html.match(/"LSD",\[\],\{"token":"([^"]+)"/);
    return m ? m[1] : null;
  }
  function readSite() { return tryRequire('SiteData') || {}; }
  function readUserId() {
    var u = tryRequire('CurrentUserInitialData');
    if (u && u.USER_ID) return u.USER_ID;
    var m = document.cookie.match(/c_user=(\d+)/);
    return m ? m[1] : null;
  }
  function readUserName() {
    var u = tryRequire('CurrentUserInitialData');
    if (u && u.NAME) return u.NAME;
    if (u && u.SHORT_NAME) return u.SHORT_NAME;
    return '';
  }
  function calcJazoest(dtsg) {
    var s = 0;
    for (var i = 0; i < dtsg.length; i++) s += dtsg.charCodeAt(i);
    return '2' + s;
  }

  var DTSG      = readDtsg();
  var LSD       = readLsd();
  var SITE      = readSite();
  var USER_ID   = readUserId();
  var USER_NAME = readUserName();

  if (!DTSG || !USER_ID) {
    alert('Не нашёл fb_dtsg / __user.\n' +
          'fb_dtsg = ' + (DTSG ? 'OK' : 'NO') + '\n' +
          '__user  = ' + (USER_ID ? 'OK' : 'NO'));
    return;
  }

  // === Константы ============================================================
  var ADDRESS = {
    country_code: 'US', state: 'DE',
    city: 'Wilmington', zip: '91105',
    street1: '', street2: ''
  };
  var DOC_UPDATE_ACCOUNT      = '33020210320959428';
  var DOC_PAYMENT_METHODS_LIST = '26414517794887295';
  var DOC_MAKE_PRIMARY        = '24268156329457050';

  // === Backdrop + iframe overlay по центру (изолирован от FB-кейбординга) ===
  var backdrop = document.createElement('div');
  backdrop.id = 'fb-bm-backdrop';
  backdrop.style.cssText = [
    'position: fixed',
    'inset: 0',
    'background: rgba(0,0,0,.35)',
    'z-index: 2147483646',
    'pointer-events: none'
  ].join(';');
  document.documentElement.appendChild(backdrop);

  var host = document.createElement('iframe');
  host.id = 'fb-bm-host';
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'top: 50%',
    'left: 50%',
    'transform: translate(-50%, -50%)',
    'z-index: 2147483647',
    'width: 620px',
    'max-width: 95vw',
    'height: 820px',
    'max-height: 92vh',
    'border: 0',
    'border-radius: 8px',
    'box-shadow: 0 12px 40px rgba(0,0,0,.45)',
    'background: #f0f2f5'
  ].join(';');
  document.documentElement.appendChild(host);

  var idoc = host.contentDocument;
  idoc.open();
  idoc.write([
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>FB BM</title>',
    '<style>',
    'html,body{margin:0;padding:0;background:#f0f2f5}',
    '*{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px}',
    '.panel{background:#f0f2f5;border:1px solid #999;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);overflow:hidden;display:flex;flex-direction:column;max-height:92vh}',
    '.hdr{background:#1c1e21;color:#fff;padding:8px 12px;display:flex;align-items:center;gap:8px;user-select:none}',
    '.hdr .title{flex:1;font-weight:600;font-size:13px}',
    '.hdr .meta{font-weight:normal;color:#8b949e;font-size:11px;margin-left:6px}',
    '.hdr button{background:transparent;border:0;color:#fff;cursor:pointer;font-size:14px;padding:2px 8px;border-radius:4px}',
    '.hdr button:hover{background:rgba(255,255,255,.15)}',
    '.body{padding:12px;overflow:auto;flex:1}',
    '.tabs{display:flex;gap:4px;margin-bottom:10px}',
    '.tabs button{flex:1;background:#fff;border:1px solid #dadde1;padding:8px;cursor:pointer;border-radius:6px 6px 0 0;font-weight:600;color:#1c1e21}',
    '.tabs button.active{background:#1877f2;color:#fff;border-color:#1877f2}',
    '.tab{display:none;background:#fff;border:1px solid #dadde1;border-radius:0 6px 6px 6px;padding:12px}',
    '.tab.active{display:block}',
    '.addr{background:#f0f2f5;border-radius:6px;padding:8px 10px;margin:0 0 10px;font-family:Consolas,Menlo,monospace;font-size:12px;line-height:1.6;color:#1c1e21}',
    'label{display:block;font-weight:600;margin:8px 0 4px;font-size:12px;color:#1c1e21}',
    'textarea,input[type=text]{width:100%;font-family:Consolas,Menlo,monospace;font-size:12px;border:1px solid #dadde1;border-radius:6px;padding:6px 8px;resize:vertical;background:#fff;color:#1c1e21}',
    'textarea{height:140px}',
    '.cols{display:flex;gap:8px}',
    '.cols>div{flex:1}',
    'button.run{background:#1877f2;color:#fff;border:0;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;margin-top:10px}',
    'button.run:disabled{background:#999;cursor:default}',
    'button.stop{background:#e41e3f;color:#fff;border:0;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;margin-top:10px;margin-left:6px}',
    '.log{background:#0d1117;color:#c9d1d9;border-radius:6px;padding:10px;margin-top:12px;height:200px;overflow:auto;font-family:Consolas,Menlo,monospace;font-size:11px;white-space:pre-wrap;line-height:1.5}',
    '.ok{color:#3fb950}.err{color:#f85149}.muted{color:#8b949e}.warn{color:#d29922}',
    '</style>',
    '</head><body>',
    '<div class="panel">',
    '  <div class="hdr" id="hdr">',
    '    <span class="title">FB Billing automation<span class="meta">actor=' + USER_ID + '</span></span>',
    '    <button id="btn-min" title="Свернуть">_</button>',
    '    <button id="btn-close" title="Закрыть">×</button>',
    '  </div>',
    '  <div class="body" id="body">',
    '    <div class="tabs">',
    '      <button id="t-addr" class="active">1. Set address</button>',
    '      <button id="t-card">2. Attach card</button>',
    '    </div>',

    // Tab Address
    '    <div id="tab-addr" class="tab active">',
    '      <div class="addr"><b>Адрес:</b><br>country=US, state=DE<br>city=Wilmington, zip=91105</div>',
    '      <label>Account IDs (по строке, с act_ или без)</label>',
    '      <textarea id="addr-accs" placeholder="1133545425604191"></textarea>',
    '      <button id="addr-run" class="run">Run address</button>',
    '      <button id="addr-stop" class="stop" style="display:none">Stop</button>',
    '    </div>',

    // Tab Card
    '    <div id="tab-card" class="tab">',
    '      <label>Name on card (одно на все)</label>',
    '      <input type="text" id="card-name" placeholder="John Smith" value="' + (USER_NAME || '').replace(/"/g, '&quot;') + '">',
    '      <label style="font-weight:normal;margin-top:8px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="card-currmonth" style="width:auto"> Подставлять текущий месяц/год (формат: PAN-CVC) &nbsp; Срок (лет): <input type="text" id="card-yearsadd" value="2" style="width:50px;text-align:center"></label>',
    '      <label style="font-weight:normal;margin-top:4px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="card-setdefault" style="width:auto"> Сделать новую карту основной (если есть "Set as default")</label>',
    '      <div class="cols">',
    '        <div><label>Account IDs</label><textarea id="card-accs" placeholder="1133545425604191"></textarea></div>',
    '        <div><label>Cards (по строке)</label><textarea id="card-cards" placeholder="PAN-MM/YY-CVC&#10;или с галкой:&#10;PAN-CVC"></textarea></div>',
    '      </div>',
    '      <div class="muted" style="font-size:11px;margin-top:6px">Строка N в Accounts ↔ строка N в Cards. Worker откроется один раз.</div>',
    '      <button id="card-run" class="run">Run cards</button>',
    '      <button id="card-stop" class="stop" style="display:none">Stop</button>',
    '    </div>',

    '    <div class="log" id="log">Готов.</div>',
    '  </div>',
    '</div>',
    '</body></html>'
  ].join(''));
  idoc.close();

  var $ = function (id) { return idoc.getElementById(id); };
  var $log = $('log');

  function log(msg, cls) {
    var span = idoc.createElement('span');
    if (cls) span.className = cls;
    span.textContent = msg + '\n';
    $log.appendChild(span);
    $log.scrollTop = $log.scrollHeight;
  }

  // === Закрыть / свернуть =================================================
  $('btn-close').onclick = function () {
    cardStopped = true; addrStopped = true;
    if (worker && !worker.closed) { try { worker.close(); } catch (e) {} }
    host.remove();
    if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  };
  $('btn-min').onclick = function () {
    var b = $('body');
    b.style.display = (b.style.display === 'none') ? '' : 'none';
  };

  // Табы
  $('t-addr').onclick = function () { $('t-addr').classList.add('active'); $('t-card').classList.remove('active'); $('tab-addr').classList.add('active'); $('tab-card').classList.remove('active'); };
  $('t-card').onclick = function () { $('t-card').classList.add('active'); $('t-addr').classList.remove('active'); $('tab-card').classList.add('active'); $('tab-addr').classList.remove('active'); };

  // ==========================================================================
  // ETAP 1 — Address (GraphQL)
  // ==========================================================================

  function buildAddressBody(accId) {
    var variables = {
      input: {
        billable_account_payment_legacy_account_id: accId,
        currency: null, device_country: null,
        tax: {
          business_address: {
            city: ADDRESS.city, country_code: ADDRESS.country_code,
            state: ADDRESS.state, street1: ADDRESS.street1,
            street2: ADDRESS.street2, zip: ADDRESS.zip
          },
          business_name: '', is_personal_use: false,
          second_tax_id: '', tax_id: '', tax_registration_status: ''
        },
        timezone: null,
        upl_logging_data: {
          billing_notification_id: '', context: 'billingaccountinfo',
          entry_point: 'ads_manager', external_flow_id: 'bm_' + Date.now(),
          target_name: 'BillingAccountInformationUtilsUpdateAccountMutation',
          user_session_id: 'bm_' + Date.now(),
          wizard_config_name: 'BUSINESS_INFO_SUB',
          wizard_name: 'COLLECT_ACCOUNT_INFO',
          wizard_screen_name: 'account_information_state_display',
          wizard_session_id: 'bm_wizard_' + Date.now()
        },
        actor_id: USER_ID,
        client_mutation_id: String(Date.now() % 100000)
      },
      includeCreateNewFromOldFragment: false
    };
    var p = {
      av: USER_ID, __user: USER_ID, __a: '1', __req: '1',
      __hs: SITE.hsi || '', dpr: '1', __rev: SITE.client_revision || '',
      __s: '', __hsi: '', __dyn: '', __csr: '', __ccg: 'GOOD',
      lsd: LSD || '', jazoest: calcJazoest(DTSG),
      __spin_r: SITE.__spin_r || '',
      __spin_b: SITE.__spin_b || 'trunk',
      __spin_t: SITE.__spin_t || String(Math.floor(Date.now() / 1000)),
      fb_dtsg: DTSG, fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: 'BillingAccountInformationUtilsUpdateAccountMutation',
      variables: JSON.stringify(variables),
      server_timestamps: 'true', doc_id: DOC_UPDATE_ACCOUNT
    };
    return new URLSearchParams(p).toString();
  }

  function postAddress(accId) {
    var body = buildAddressBody(accId);
    function send(url) {
      return fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body, credentials: 'include', mode: 'cors'
      }).then(function (r) {
        return r.text().then(function (t) { return { status: r.status, text: t, url: url }; });
      });
    }
    return send(location.origin + '/api/graphql/').then(function (res) {
      if (res.status === 200 && res.text && res.text.indexOf('"errors"') === -1) return res;
      return send('https://business.facebook.com/api/graphql/');
    });
  }

  // Универсальный GraphQL-POST (для не-крипто мутаций — list, make-primary)
  async function graphqlPost(friendlyName, docId, variables) {
    var p = {
      av: USER_ID, __user: USER_ID, __a: '1', __req: '1',
      __hs: SITE.hsi || '', dpr: '1', __rev: SITE.client_revision || '',
      __s: '', __hsi: '', __dyn: '', __csr: '', __ccg: 'GOOD',
      lsd: LSD || '', jazoest: calcJazoest(DTSG),
      __spin_r: SITE.__spin_r || '',
      __spin_b: SITE.__spin_b || 'trunk',
      __spin_t: SITE.__spin_t || String(Math.floor(Date.now() / 1000)),
      fb_dtsg: DTSG,
      fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: friendlyName,
      variables: JSON.stringify(variables),
      server_timestamps: 'true',
      doc_id: docId
    };
    var body = new URLSearchParams(p).toString();
    function send(url) {
      return fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body, credentials: 'include', mode: 'cors'
      }).then(function (r) {
        return r.text().then(function (t) { return { status: r.status, text: t }; });
      });
    }
    var res = await send(location.origin + '/api/graphql/');
    if (res.status !== 200 || (res.text && res.text.indexOf('"errors"') !== -1)) {
      res = await send('https://business.facebook.com/api/graphql/');
    }
    try { return JSON.parse(res.text); } catch (e) { return { _raw: res.text, _status: res.status }; }
  }

  // Проверяет primary-статус карты и если не primary — делает primary.
  // Возвращает 'already', 'made', или throw на ошибку.
  async function ensurePrimary(accId, last4) {
    var list = await graphqlPost('BillingHubPaymentSettingsPaymentMethodsListQuery', DOC_PAYMENT_METHODS_LIST, {
      paymentAccountID: accId,
      assetID: accId
    });
    var methods = (((list || {}).data || {}).billable_account_by_asset_id || {}).billing_payment_account;
    methods = methods ? (methods.billing_payment_methods_allowlist_customized || []) : [];
    var ours = null;
    for (var i = 0; i < methods.length; i++) {
      var m = methods[i];
      var c = m && m.credential;
      if (c && c.credential_type === 'CREDIT_CARD' && c.last_four_digits === last4) {
        ours = m; break;
      }
    }
    if (!ours) throw new Error('card ****' + last4 + ' не найдена в списке после привязки');
    if (ours.is_primary) return 'already';

    var credId = ours.credential.credential_id;
    var primary = await graphqlPost('BillingMakePrimaryStateMutation', DOC_MAKE_PRIMARY, {
      input: {
        billable_account_payment_legacy_account_id: accId,
        primary_funding_id: credId,
        upl_logging_data: {
          billing_notification_id: '',
          context: 'billingaddpm',
          credential_id: credId,
          entry_point: 'ads_manager',
          external_flow_id: 'bm_' + Date.now(),
          target_name: 'BillingMakePrimaryStateMutation',
          user_session_id: 'bm_' + Date.now(),
          wizard_config_name: 'MAKE_PRIMARY',
          wizard_name: 'MAKE_PRIMARY',
          wizard_screen_name: 'make_primary_display_state_display',
          wizard_session_id: 'bm_wizard_' + Date.now()
        },
        actor_id: USER_ID,
        client_mutation_id: String(Date.now() % 100000)
      }
    });
    if (primary && primary.errors && primary.errors[0]) {
      var er = primary.errors[0];
      throw new Error('make primary: ' + (er.summary || er.description || er.message || JSON.stringify(er).slice(0, 200)));
    }
    return 'made';
  }

  var addrStopped = false;

  $('addr-stop').onclick = function () {
    addrStopped = true;
    $('addr-stop').style.display = 'none';
    $('addr-run').disabled = false;
    log('--- stop requested ---', 'muted');
  };

  $('addr-run').onclick = async function () {
    var raw = $('addr-accs').value.trim();
    if (!raw) { log('пустой список', 'err'); return; }
    var ids = raw.split(/\s+/)
                 .map(function (x) { return x.replace(/^act_/, '').trim(); })
                 .filter(function (x) { return /^\d{6,}$/.test(x); });
    if (!ids.length) { log('нет валидных ID', 'err'); return; }

    $('addr-run').disabled = true;
    $('addr-stop').style.display = 'inline-block';
    addrStopped = false;
    log('--- Address: ' + ids.length + ' accounts ---', 'muted');

    var ok = 0, err = 0;
    for (var i = 0; i < ids.length; i++) {
      if (addrStopped) break;
      var id = ids[i];
      log('[' + (i + 1) + '/' + ids.length + '] ' + id + ' …');
      try {
        var res = await postAddress(id);
        var parsed = null;
        try { parsed = JSON.parse(res.text); } catch (e) {}
        if (res.status === 200 && parsed && parsed.data && !parsed.errors) {
          log('   ✓ OK', 'ok'); ok++;
        } else {
          var reason = res.status + '';
          if (parsed && parsed.errors && parsed.errors[0]) {
            reason += ' — ' + (parsed.errors[0].summary || parsed.errors[0].description || parsed.errors[0].message || JSON.stringify(parsed.errors[0]).slice(0, 200));
          } else if (res.text) {
            reason += ' — ' + res.text.slice(0, 200);
          }
          log('   ✗ ' + reason, 'err'); err++;
        }
      } catch (e) {
        log('   ✗ exception: ' + (e.message || e), 'err'); err++;
      }
      await new Promise(function (r) { setTimeout(r, 400); });
    }
    log('--- Done. OK=' + ok + ' ERR=' + err + (addrStopped ? ' (stopped)' : '') + ' ---', 'muted');
    $('addr-run').disabled = false;
    $('addr-stop').style.display = 'none';
  };

  // ==========================================================================
  // ETAP 2 — Attach card (UI injection в worker-вкладке)
  // ==========================================================================

  var worker = null;
  var cardStopped = false;

  function billingUrl(accId) {
    return 'https://business.facebook.com/billing_hub/payment_settings/' +
           '?placement=ads_manager' +
           '&asset_id=' + accId +
           '&payment_account_id_from_jsmodule=' + accId +
           '&payment_account_id=' + accId +
           '&entrypoint=ads_ecosystem_navigation_ads_billing_tool_plugin' +
           '&_bm=' + Date.now();  // cache-buster — гарантирует свежий контекст SPA
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function waitFor(predicate, timeoutMs, intervalMs) {
    timeoutMs = timeoutMs || 25000;
    intervalMs = intervalMs || 250;
    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (cardStopped) throw new Error('stopped');
      try {
        var el = predicate();
        if (el) return el;
      } catch (e) {}
      await sleep(intervalMs);
    }
    throw new Error('timeout: ' + (predicate.name || 'wait'));
  }

  function findByText(rootDoc, selector, text, exact) {
    var els = rootDoc.querySelectorAll(selector);
    var ttext = (text || '').toLowerCase().trim();
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || '').toLowerCase().trim();
      if (exact ? t === ttext : t.indexOf(ttext) !== -1) return els[i];
    }
    return null;
  }

  function clickable(el) {
    while (el && el.tagName !== 'BUTTON' && (!el.getAttribute || el.getAttribute('role') !== 'button')) {
      el = el.parentElement;
      if (!el) break;
    }
    return el;
  }

  function setInput(input, value) {
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    // Сбросить React-tracker, чтобы reconciler увидел изменение
    if (input._valueTracker) {
      try { input._valueTracker.setValue(''); } catch (e) {}
    }
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function blurInput(input) {
    if (!input) return;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur',   { bubbles: true }));
  }
  function isVisible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    var st = el.ownerDocument.defaultView.getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  }
  function findByTextVisible(rootDoc, selector, text, exact) {
    var els = rootDoc.querySelectorAll(selector);
    var ttext = (text || '').toLowerCase().trim();
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || '').toLowerCase().trim();
      var ok = exact ? t === ttext : t.indexOf(ttext) !== -1;
      if (ok && isVisible(els[i])) return els[i];
    }
    return null;
  }

  function findSetDefaultCheckbox(d) {
    // Способ 1: label с текстом "Set as default" → checkbox внутри
    var labels = d.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      if (/set as default/i.test(labels[i].textContent || '')) {
        var cb = labels[i].querySelector('input[type="checkbox"]');
        if (cb) return cb;
      }
    }
    // Способ 2: найти текст рядом с checkbox
    var anchor = findByTextVisible(d, 'span,div,label', 'Set as default');
    if (anchor) {
      var p = anchor;
      for (var j = 0; j < 5 && p; j++) {
        var cb2 = p.querySelector('input[type="checkbox"]');
        if (cb2) return cb2;
        p = p.parentElement;
      }
    }
    return null;
  }

  async function ensureWorker() {
    if (worker && !worker.closed) return worker;
    worker = window.open('about:blank', 'fb_card_worker', 'width=1280,height=900');
    if (!worker) throw new Error('worker popup blocked');
    return worker;
  }

  function isCrossOrigin() {
    try {
      // Любая попытка прочитать location.href кросс-оригинного worker'а бросит SecurityError
      var _ = worker.location.href; void _;
      return false;
    } catch (e) {
      return /cross.?origin|security/i.test(e.message || '');
    }
  }

  async function navigateAndWait(url) {
    // Извлекаем ожидаемый asset_id из URL для проверки после навигации
    var expectedMatch = url.match(/asset_id=(\d+)/);
    var expectedAcc = expectedMatch ? expectedMatch[1] : null;

    // Ставим маркер на текущий document — он исчезнет при перезагрузке
    var navMarker = 'bm_' + Date.now() + '_' + Math.random();
    try { worker.__bmNav = navMarker; } catch (e) {}

    // location.replace() атомарно делает full navigation без race condition
    try {
      worker.location.replace(url);
    } catch (e) {
      // Fallback на href + reload
      worker.location.href = url;
      await sleep(200);
      try { worker.location.reload(); } catch (e2) {}
    }

    // Ждём пока document перезагрузится (наш маркер пропал)
    var t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      if (cardStopped) throw new Error('stopped');
      if (worker.closed) throw new Error('worker closed');
      if (isCrossOrigin()) {
        throw new Error('Cross-origin block: master=' + location.hostname + ', worker target=business.facebook.com. Запусти bookmarklet с business.facebook.com (например с Billing Hub любого аккаунта).');
      }
      try {
        var sameDoc = (worker.__bmNav === navMarker);
        if (!sameDoc && worker.document.readyState === 'complete' &&
            worker.location.href.indexOf('billing_hub') !== -1) {
          break;
        }
      } catch (e) {}
      await sleep(300);
    }
    // Даём React смонтировать страницу
    await sleep(2000);

    // VERIFY: реально ли мы на правильном asset_id
    if (expectedAcc) {
      var actualUrl = '';
      try { actualUrl = worker.location.href; } catch (e) {}
      if (actualUrl.indexOf('asset_id=' + expectedAcc) === -1) {
        throw new Error('navigation mismatch: ожидался asset_id=' + expectedAcc + ', worker на ' + actualUrl.slice(0, 140));
      }
    }
  }

  function findInputs(d) {
    return {
      name: d.querySelector('input[name="firstName"]') ||
            d.querySelector('input[name="cardholder_name"]') ||
            d.querySelector('input[placeholder*="Name" i]'),
      pan:  d.querySelector('input[name="cardNumber"]') ||
            d.querySelector('input[name="credit_card_number"]') ||
            d.querySelector('input[placeholder*="Card number" i]'),
      exp:  d.querySelector('input[name="expiration"]') ||
            d.querySelector('input[name="expiration_date"]') ||
            d.querySelector('input[placeholder*="MM/YY" i]'),
      cvc:  d.querySelector('input[name="securityCode"]') ||
            d.querySelector('input[name="csc"]') ||
            d.querySelector('input[placeholder*="CVV" i],input[placeholder*="CVC" i]'),
      zip:  d.querySelector('input[name="zip"]') ||
            d.querySelector('input[name="zipCode"]') ||
            d.querySelector('input[name="postalCode"]') ||
            d.querySelector('input[name="postal_code"]') ||
            d.querySelector('input[placeholder*="ZIP" i]') ||
            d.querySelector('input[placeholder*="Postal" i]') ||
            d.querySelector('input[aria-label*="ZIP" i]') ||
            d.querySelector('input[aria-label*="Postal" i]')
    };
  }

  async function attachCard(accId, pan, mmyy, cvc, name, setDefault) {
    await navigateAndWait(billingUrl(accId));
    var d = worker.document;

    // 1. Кликаем "Add payment method"
    var addBtn = await waitFor(function addPaymentMethodBtn() {
      return findByText(d, '[role="button"],button', 'Add payment method') ||
             findByText(d, '[role="button"],button', 'Add payment')        ||
             findByText(d, 'div[role="button"]', 'Add payment');
    }, 25000);
    addBtn.click();

    // 2. Ждём появление модала: либо сразу card-input, либо radio/кнопка метода/Next
    await waitFor(function modalAppeared() {
      return findInputs(d).pan ||
             d.querySelector('input[name="AdAccountNewCreditCardOption"]') ||
             findByText(d, 'button,[role="button"]', 'Debit or credit card') ||
             findByText(d, '[role="button"],button', 'Next');
    }, 25000);

    // 3a. Новый UI: метод — это кнопка "Debit or credit card+4"
    var creditBtn = findByText(d, 'button,[role="button"]', 'Debit or credit card');
    if (creditBtn) {
      try { creditBtn.click(); } catch (e) {}
      await sleep(400);
    }

    // 3b. Старый UI: radio
    var radio = d.querySelector('input[name="AdAccountNewCreditCardOption"]');
    if (radio && !radio.checked) {
      try { radio.click(); } catch (e) {}
      await sleep(300);
    }

    // 4. Если сразу нет card-input — кликаем Next, ждём форму
    if (!findInputs(d).pan) {
      var nextBtn = findByText(d, '[role="button"],button', 'Next');
      if (nextBtn && (!nextBtn.getAttribute || nextBtn.getAttribute('aria-disabled') !== 'true')) {
        nextBtn.click();
      }
      await waitFor(function cardFormAppeared() {
        return findInputs(d).pan;
      }, 20000);
    }

    // 5. Заполняем
    var inps = findInputs(d);
    if (!inps.pan || !inps.exp || !inps.cvc) {
      throw new Error('inputs not found (name=' + !!inps.name + ' pan=' + !!inps.pan + ' exp=' + !!inps.exp + ' cvc=' + !!inps.cvc + ')');
    }

    if (inps.name) { setInput(inps.name, name); await sleep(100); }
    setInput(inps.pan, pan);  await sleep(100);
    setInput(inps.exp, mmyy); await sleep(100);
    setInput(inps.cvc, cvc);  await sleep(200);

    // ZIP появляется не всегда. Если поле есть прямо сейчас или появится после CVC — заполним 91105.
    var zipInp = inps.zip;
    if (!zipInp) {
      var zipStart = Date.now();
      while (Date.now() - zipStart < 2500) {
        zipInp = findInputs(d).zip;
        if (zipInp) break;
        await sleep(200);
      }
    }
    if (zipInp) {
      setInput(zipInp, ADDRESS.zip);
      await sleep(200);
    }

    // Финальный blur — отправляем change/blur по всем заполненным,
    // чтобы FB-валидация зафиксировала ввод и активировала Save
    blurInput(inps.name);
    blurInput(inps.pan);
    blurInput(inps.exp);
    blurInput(inps.cvc);
    blurInput(zipInp);
    // Фокус "наружу" — на body — гарантирует blur последнего поля
    try { worker.document.body.focus(); } catch (e) {}
    await sleep(400);

    // "Set as default payment method" — кликаем если пользователь хочет и пункт есть
    if (setDefault) {
      var defCb = findSetDefaultCheckbox(d);
      if (defCb && !defCb.checked) {
        try { defCb.click(); } catch (e) {}
        await sleep(200);
      }
    }

    // 6. Клик финальной кнопки (Save / Next / Add — зависит от UI).
    // Ищем только среди ВИДИМЫХ — в DOM могут оставаться скрытые кнопки от старых экранов.
    var SAVE_TEXTS = ['Save', 'Save and continue', 'Next', 'Add card', 'Add', 'Confirm', 'Continue', 'Done', 'Submit'];
    var saveBtn = await waitFor(function saveBtnSearch() {
      for (var s = 0; s < SAVE_TEXTS.length; s++) {
        var b = findByTextVisible(d, 'button,[role="button"]', SAVE_TEXTS[s]);
        if (b) {
          if (b.getAttribute && b.getAttribute('aria-disabled') === 'true') continue;
          return b;
        }
      }
      return null;
    }, 15000);
    saveBtn.click();

    // 7. Ждём результат: success-модал, ошибку, или закрытие формы
    var result = await waitFor(function finalResult() {
      // Success-модал "Card successfully saved" / "has been added"
      var successText = findByTextVisible(d, 'div,h1,h2,h3,span', 'successfully saved') ||
                        findByTextVisible(d, 'div,h1,h2,h3,span', 'has been added') ||
                        findByTextVisible(d, 'div,h1,h2,h3,span', 'Card successfully');
      if (successText) return { type: 'ok' };

      // Ошибка валидации/банка
      var errEl = d.querySelector('[role="alert"]');
      if (errEl && errEl.textContent && errEl.textContent.trim().length > 4) {
        return { type: 'error', text: errEl.textContent.trim() };
      }

      // Форма карты закрылась без видимого success — считаем что ОК
      if (!findInputs(d).pan && !findByTextVisible(d, 'button,[role="button"]', 'Next')) {
        return { type: 'ok' };
      }
      return null;
    }, 30000, 500);

    if (result.type === 'error') throw new Error('FB: ' + result.text.slice(0, 200));

    // Закрываем success-модал кликом Done (если он есть)
    await sleep(400);
    var doneBtn = findByTextVisible(d, 'button,[role="button"]', 'Done');
    if (doneBtn) {
      try { doneBtn.click(); } catch (e) {}
      await sleep(500);
    }

    // Если пользователь хочет primary — проверяем через API и при необходимости делаем
    if (setDefault) {
      var last4 = pan.slice(-4);
      // Даём FB пару секунд проиндексировать новую карту
      await sleep(1500);
      try {
        var st = await ensurePrimary(accId, last4);
        return { ok: true, primary: st };
      } catch (e) {
        return { ok: true, primary: 'err:' + (e.message || e) };
      }
    }
    return { ok: true };
  }

  $('card-stop').onclick = function () {
    cardStopped = true;
    $('card-stop').style.display = 'none';
    $('card-run').disabled = false;
    log('--- stop requested ---', 'muted');
  };

  $('card-run').onclick = async function () {
    var name = $('card-name').value.trim();
    if (!name) { log('Name on card пустое', 'err'); return; }

    var accs = $('card-accs').value.trim().split(/\s+/)
                 .map(function (x) { return x.replace(/^act_/, '').trim(); })
                 .filter(function (x) { return /^\d{6,}$/.test(x); });
    var cards = $('card-cards').value.trim().split(/\n+/)
                 .map(function (x) { return x.trim(); })
                 .filter(function (x) { return x.length > 0; });

    if (accs.length !== cards.length) {
      log('Несовпадение: accounts=' + accs.length + ' cards=' + cards.length, 'err');
      return;
    }
    if (!accs.length) { log('пусто', 'err'); return; }

    var useCurrentMonth = $('card-currmonth').checked;
    var nowMM, nowYY;
    if (useCurrentMonth) {
      var yearsAdd = parseInt($('card-yearsadd').value, 10);
      if (!Number.isFinite(yearsAdd) || yearsAdd < 0) yearsAdd = 2;
      var nowD = new Date();
      nowMM = String(nowD.getMonth() + 1).padStart(2, '0');
      nowYY = String((nowD.getFullYear() + yearsAdd) % 100).padStart(2, '0');
      log('Срок: ' + nowMM + '/' + nowYY + ' (тек. месяц + ' + yearsAdd + ' лет)', 'muted');
    }

    var parsed = [];
    for (var i = 0; i < cards.length; i++) {
      // Принимаем разделитель '-' (основной) и '|' (для совместимости)
      var parts = cards[i].split(/[\-|]/).map(function (x) { return x.trim(); });
      var expected = useCurrentMonth ? 2 : 3;
      if (parts.length !== expected) {
        log('Card #' + (i + 1) + ': нужен формат ' + (useCurrentMonth ? 'PAN-CVC' : 'PAN-MM/YY-CVC'), 'err');
        return;
      }
      var pan = parts[0].replace(/\s/g, '');
      var mmyy, cvc;
      if (useCurrentMonth) {
        mmyy = nowMM + '/' + nowYY;
        cvc = parts[1];
      } else {
        mmyy = parts[1].replace(/\s/g, '');
        cvc = parts[2];
        var mexp = mmyy.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
        if (!mexp) { log('Card #' + (i + 1) + ': MM/YY должно быть как 05/28', 'err'); return; }
        var mm = mexp[1].length === 1 ? '0' + mexp[1] : mexp[1];
        var yy = mexp[2].length === 4 ? mexp[2].slice(-2) : mexp[2];
        mmyy = mm + '/' + yy;
      }
      if (!/^\d{12,19}$/.test(pan)) { log('Card #' + (i + 1) + ': невалидный PAN', 'err'); return; }
      if (!/^\d{3,4}$/.test(cvc)) { log('Card #' + (i + 1) + ': невалидный CVC', 'err'); return; }
      parsed.push({ pan: pan, mmyy: mmyy, cvc: cvc });
    }

    $('card-run').disabled = true;
    $('card-stop').style.display = 'inline-block';
    cardStopped = false;
    log('--- Cards: ' + accs.length + ' pairs ---', 'muted');

    try {
      await ensureWorker();
    } catch (e) {
      log('Не открылась worker-вкладка: ' + e.message, 'err');
      $('card-run').disabled = false; $('card-stop').style.display = 'none';
      return;
    }

    var setDefault = $('card-setdefault').checked;
    var ok = 0, err = 0;
    for (var j = 0; j < accs.length; j++) {
      if (cardStopped) break;
      var accId = accs[j], c = parsed[j];
      log('[' + (j + 1) + '/' + accs.length + '] act_' + accId + ' ← ****' + c.pan.slice(-4) + ' …');
      try {
        var r = await attachCard(accId, c.pan, c.mmyy, c.cvc, name, setDefault);
        var note = '';
        if (r && r.primary === 'made')     note = ' (made primary)';
        else if (r && r.primary === 'already') note = ' (already primary)';
        else if (r && r.primary && r.primary.indexOf('err:') === 0) note = ' (primary failed: ' + r.primary.slice(4) + ')';
        log('   ✓ OK' + note, 'ok'); ok++;
      } catch (e) {
        log('   ✗ ' + (e.message || e), 'err'); err++;
      }
      await sleep(1500);
    }

    log('--- Done. OK=' + ok + ' ERR=' + err + (cardStopped ? ' (stopped)' : '') + ' ---', 'muted');
    $('card-run').disabled = false;
    $('card-stop').style.display = 'none';
  };
})();
