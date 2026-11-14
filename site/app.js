/* 本番モードの接続層。config.js が空なら何もしません（試作モード）。
   画面側は window.Nasuri を見て、登録・ログイン・「話を聞きたい」の保存を行います。 */
(function () {
  'use strict';
  var cfg = window.NASURI_CONFIG || {};
  var PENDING = 'nasuri_pending_talk', LAST = 'nasuri_last_talk';
  var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var client = null;
  var N = window.Nasuri = {
    enabled: !!(cfg.supabaseUrl && cfg.supabaseAnonKey),
    ready: false, session: null, profile: null
  };
  if (!N.enabled) return;

  function read(store, key) { try { return JSON.parse(store.getItem(key) || 'null'); } catch (e) { return null; } }
  function write(store, key, v) { try { store.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function drop(store, key) { try { store.removeItem(key); } catch (e) {} }
  function ok(res) { if (res.error) throw res.error; return res.data; }
  function page() { return location.pathname.split('/').pop() || 'index.html'; }

  function loadProfile() {
    if (!N.session) { N.profile = null; return Promise.resolve(); }
    return client.from('profiles').select('*').eq('id', N.session.user.id).maybeSingle()
      .then(function (res) { N.profile = res.error ? null : res.data; });
  }
  function insertTalk(payload) {
    var row = Object.assign({ user_id: N.session.user.id }, payload);
    return client.from('talk_requests').insert(row).then(ok);
  }

  N.signIn = function (email) {
    return client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: new URL('signup.html', location.href).href } }).then(ok);
  };
  N.signOut = function () { return client.auth.signOut().then(function () { N.session = null; N.profile = null; }); };
  N.saveProfile = function (p) {
    var row = Object.assign({ id: N.session.user.id, email: N.session.user.email }, p);
    return client.from('profiles').upsert(row).select().single().then(ok).then(function (d) { N.profile = d; });
  };
  /* 送信。未ログイン・未登録なら内容を控えて登録画面へ送り、'redirect' を返す */
  N.sendTalk = function (payload, ui) {
    if (!N.session || !N.profile) {
      write(localStorage, PENDING, { payload: payload, ui: ui, back: page() });
      location.href = 'signup.html';
      return Promise.resolve('redirect');
    }
    return insertTalk(payload).then(function () { return 'sent'; });
  };
  N.hasPending = function () { return !!read(localStorage, PENDING); };
  /* 登録が済んだあと、控えておいた「話を聞きたい」を送る。戻り先URL（なければ null）を返す */
  N.flushPending = function () {
    var p = read(localStorage, PENDING);
    if (!p || !N.session || !N.profile) return Promise.resolve(null);
    return insertTalk(p.payload).then(function () {
      drop(localStorage, PENDING);
      write(sessionStorage, LAST, p.ui || {});
      return (p.back || 'job.html') + '#sent';
    });
  };
  N.lastState = function () { return read(sessionStorage, LAST); };

  function start() {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    client.auth.getSession().then(function (res) {
      N.session = (res.data && res.data.session) || null;
      return loadProfile();
    }).catch(function () {}).then(function () {
      N.ready = true;
      window.dispatchEvent(new Event('nasuri:ready'));
    });
  }
  if (window.supabase && window.supabase.createClient) { start(); return; }
  var s = document.createElement('script');
  s.src = SDK; s.onload = start;
  s.onerror = function () { N.ready = true; window.dispatchEvent(new Event('nasuri:ready')); };
  document.head.appendChild(s);
})();
