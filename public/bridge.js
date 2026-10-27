/* 宿主桥（装进 DSH 后才有意义；独立打开时 window.parent === window 直接返回）。
 * 只做两件事：
 *   1. 监听 app.js 派发的 pbc:agent-draft → postMessage 给 lib/client.js 的外框；
 *      （外框的 message 监听只认 type==='pbc:agent-draft' + 同源 + 自己的 iframe，
 *       页面不自己造聊天窗，也不发请求给模型）
 *   2. 告诉外框「页面已就绪」。
 * 2026-10-27 补：此前页面只派发 document 事件、没有桥，装机版里「AI 帮我填」永远送不到会话。
 */
(function () {
  if (window.parent === window) return;
  var EVT = 'pbc:agent-draft';
  document.addEventListener(EVT, function (ev) {
    var d = (ev && ev.detail) || {};
    try {
      window.parent.postMessage({
        type: EVT,
        prompt: String(d.prompt || ''),
        context: String(d.context || ''),
      }, window.location.origin);
    } catch (e) { /* 外框收不到时提示词仍留在页面里 */ }
  });
  try { window.parent.postMessage({ type: 'pbc:ui-ready' }, window.location.origin); } catch (e) { /* ignore */ }
})();
