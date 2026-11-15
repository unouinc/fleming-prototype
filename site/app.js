/* 本番モードの接続層。config.js で有効になっていなければ何もしません（試作モード）。
   画面側は window.Nasuri を見て、登録・ログイン・「話を聞きたい」の保存を行います。 */
(function () {
  'use strict';
  var cfg = window.NASURI_CONFIG || {};
  var PENDING = 'nasuri_pending_talk', LAST = 'nasuri_last_talk';
  var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var client = null;
  var live = !!cfg.liveByDefault;
  try {
    var q = new URLSearchParams(location.search).get('live');
    if (q === '1') localStorage.setItem('nasuri_live', '1');
    if (q === '0') localStorage.removeItem('nasuri_live');
    /* ログインメールのリンクから戻ってきたとき（URLに認証情報が付いている）は、必ず本番モードで受け取る */
    if (/[#&?](access_token|refresh_token|error_code)=/.test(location.hash + location.search)) localStorage.setItem('nasuri_live', '1');
    if (localStorage.getItem('nasuri_live') === '1') live = true;
  } catch (e) {}
  var N = window.Nasuri = {
    enabled: live && !!(cfg.supabaseUrl && cfg.supabaseAnonKey),
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
    return client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: new URL('signup.html' + (cfg.liveByDefault ? '' : '?live=1'), location.href).href } }).then(ok);
  };
  N.signOut = function () { return client.auth.signOut().then(function () { N.session = null; N.profile = null; }); };
  /* 顔写真：端末側で縮小し（最大640px・JPEG）、位置情報などを含まない画像にしてから、本人専用のフォルダに保存する */
  N.uploadAvatar = function (file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 640, w = img.naturalWidth, h = img.naturalHeight, r = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * r); c.height = Math.round(h * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('画像を変換できませんでした')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした')); };
      img.src = url;
    }).then(function (blob) {
      var path = N.session.user.id + '/avatar-' + Date.now() + '.jpg';
      return client.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true }).then(ok).then(function () { return path; });
    });
  };
  /* 自分の顔写真を表示するための、1時間だけ有効なURL */
  N.avatarUrl = function (path) {
    if (!path) return Promise.resolve(null);
    return client.storage.from('avatars').createSignedUrl(path, 3600).then(function (r) { return r.error ? null : r.data.signedUrl; });
  };
  N.isComplete = function () { return !!(N.session && N.profile && N.profile.avatar_path); };
  N.saveProfile = function (p) {
    var row = Object.assign({ id: N.session.user.id, email: N.session.user.email }, p);
    return client.from('profiles').upsert(row).select().single().then(ok).then(function (d) { N.profile = d; });
  };
  /* 送信。未ログイン・未登録なら内容を控えて登録画面へ送り、'redirect' を返す */
  N.sendTalk = function (payload, ui) {
    if (!N.isComplete()) {
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
    if (!p || !N.isComplete()) return Promise.resolve(null);
    return insertTalk(p.payload).then(function () {
      drop(localStorage, PENDING);
      write(sessionStorage, LAST, p.ui || {});
      return (p.back || 'job.html') + '#sent';
    });
  };
  N.lastState = function () { return read(sessionStorage, LAST); };

  /* メッセージ：自分の「話を聞きたい」ごとのやりとり（読めるのは本人と運営だけ） */
  N.loadThreads = function () {
    if (!N.session) return Promise.resolve([]);
    return Promise.all([
      client.from('talk_requests').select('*').eq('user_id', N.session.user.id).order('created_at', { ascending: false }).then(ok),
      client.from('messages').select('*').order('created_at', { ascending: true }).then(ok)
    ]).then(function (r) {
      var by = {};
      (r[1] || []).forEach(function (m) { (by[m.talk_id] = by[m.talk_id] || []).push(m); });
      return (r[0] || []).map(function (t) { return Object.assign({}, t, { messages: by[t.id] || [] }); });
    });
  };
  N.sendMessage = function (talkId, body) {
    return client.from('messages').insert({ talk_id: talkId, body: body }).select().single().then(ok);
  };
  N.markRead = function (talkId) {
    return client.rpc('mark_read', { p_talk: talkId }).then(function () { refreshBadge(); });
  };
  /* ナビの未読バッジ。画面の描き直しで消えないよう、CSSで数字を出す */
  var badgeStyle = null;
  function setBadge(n) {
    if (!badgeStyle) { badgeStyle = document.createElement('style'); document.head.appendChild(badgeStyle); }
    var sel = 'a[href="scouts.html"] > span';
    badgeStyle.textContent = n > 0
      ? sel + '{font-size:0!important;min-width:8px;text-align:center}' + sel + '::after{content:"' + (n > 99 ? '99+' : n) + '";font-size:11px}'
      : sel + '{display:none!important}';
  }
  function refreshBadge() {
    if (!N.session) { setBadge(0); return; }
    client.rpc('unread_count').then(function (r) { setBadge(r.error ? 0 : (r.data || 0)); });
  }
  N.refreshBadge = refreshBadge;

  setBadge(0);
  function start() {
    client =window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    client.auth.getSession().then(function (res) {
      N.session = (res.data && res.data.session) || null;
      return loadProfile();
    }).catch(function () {}).then(function () {
      refreshBadge();
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
