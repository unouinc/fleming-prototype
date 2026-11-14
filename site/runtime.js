/* ナスリー prototype — tiny template runtime
   Supports: {{a.b}} holes in text and attributes, <sc-for list as>, <sc-if value>,
   onClick / onChange handlers, checked / aria-pressed from state. */
(function () {
  'use strict';

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.');
    var cur = scope;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;

  function interpolate(str, scope) {
    var m = str.match(/^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/);
    if (m) return lookup(m[1], scope);
    return str.replace(HOLE, function (_, p) {
      var v = lookup(p, scope);
      return v == null ? '' : String(v);
    });
  }

  function renderNodes(nodes, scope, out) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, out);
  }

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(node.nodeValue.indexOf('{{') >= 0 ? interpolate(node.nodeValue, scope) : node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      var list = lookup(node.getAttribute('list').replace(/[{}]/g, ''), scope) || [];
      var as = node.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) {
        var s = Object.create(scope);
        s[as] = list[i];
        s.$index = i;
        renderNodes(node.childNodes, s, out);
      }
      return;
    }
    if (tag === 'sc-if') {
      var v = lookup(node.getAttribute('value').replace(/[{}]/g, ''), scope);
      if (v) renderNodes(node.childNodes, scope, out);
      return;
    }
    var el = document.createElementNS(node.namespaceURI, node.localName);
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a];
      var name = at.name, val = at.value;
      if (/^hint-/.test(name)) continue;
      if (/^on[A-Z]/.test(name) || /^on[a-z]+$/.test(name) && name !== 'on') {
        var ev = name.slice(2).toLowerCase();
        var fn = interpolate(val, scope);
        if (typeof fn === 'function') { (el.__h || (el.__h = {}))[ev] = fn; el.addEventListener(ev, dispatch); }
        continue;
      }
      var r = val.indexOf('{{') >= 0 ? interpolate(val, scope) : val;
      if (name === 'checked') { if (r === true || r === 'true' || r === '') el.checked = true; continue; }
      if (r === false || r == null) { if (/^aria-/.test(name)) el.setAttribute(name, 'false'); continue; }
      if (r === true) { el.setAttribute(name, /^aria-/.test(name) ? 'true' : ''); continue; }
      el.setAttribute(name, String(r));
    }
    renderNodes(node.childNodes, scope, el);
    out.appendChild(el);
  }

  function dispatch(e) { var h = this.__h && this.__h[e.type]; if (h) h.call(this, e); }

  /* 既存のDOMを作り直さず、差分だけ反映する。入力中の欄がそのまま残るので、
     カーソル位置と日本語変換（IME）が途切れない。 */
  function morph(oldP, newP) {
    var olds = Array.prototype.slice.call(oldP.childNodes);
    var news = Array.prototype.slice.call(newP.childNodes);
    for (var i = 0; i < news.length; i++) {
      var o = olds[i], n = news[i];
      if (!o) { oldP.appendChild(n); continue; }
      if (o.nodeType !== n.nodeType || (n.nodeType === 1 && (o.tagName !== n.tagName || o.id !== n.id || o.namespaceURI !== n.namespaceURI))) { oldP.replaceChild(n, o); continue; }
      if (n.nodeType !== 1) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; continue; }
      var a, k;
      for (k = o.attributes.length - 1; k >= 0; k--) { a = o.attributes[k]; if (!n.hasAttribute(a.name)) o.removeAttribute(a.name); }
      for (k = 0; k < n.attributes.length; k++) { a = n.attributes[k]; if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value); }
      if (o.tagName === 'INPUT' || o.tagName === 'TEXTAREA') {
        if (o.type === 'checkbox' || o.type === 'radio') { if (o.checked !== n.checked) o.checked = n.checked; }
        else if (o.value !== n.value) o.value = n.value;
      }
      var nh = n.__h || {}, oh = o.__h || {};
      for (var ev in nh) if (!(ev in oh)) o.addEventListener(ev, dispatch);
      o.__h = nh;
      morph(o, n);
    }
    for (var j = olds.length - 1; j >= news.length; j--) oldP.removeChild(olds[j]);
  }

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    for (var k in patch) this.state[k] = patch[k];
    if (this.__render) this.__render();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__render) this.__render(); };
  window.DCLogic = DCLogic;

  window.mount = function (Component, templateId, rootId) {
    var tpl = document.getElementById(templateId);
    var root = document.getElementById(rootId);
    var inst = new Component({});
    inst.__render = function () {
      var vals = inst.renderVals();
      var frag = document.createDocumentFragment();
      renderNodes(tpl.content.childNodes, vals, frag);
      morph(root, frag);
      document.body.style.overflow = root.querySelector('[aria-modal="true"]') ? 'hidden' : '';
    };
    inst.__render();
  };
})();
