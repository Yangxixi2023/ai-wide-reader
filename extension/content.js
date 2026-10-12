(() => {
  const { sites, defaults, createPanel } = window.AWR;
  const site = Object.keys(sites).find(id => sites[id].hosts.includes(location.hostname));
  if (!site) return;
  const root = document.documentElement;
  const targetSelector = site === 'chatgpt' ? 'main' : 'chat-window';
  let state = { ...defaults };
  let target;
  let frame;
  const host = document.createElement('div');
  host.id = 'ai-wide-reader';
  const shadow = host.attachShadow({ mode: 'open' });
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = chrome.runtime.getURL('panel.css');
  shadow.append(stylesheet);
  const ui = document.createElement('div');
  ui.className = 'awr-ui';
  ui.innerHTML = `<div class="awr-dialog" role="dialog" aria-label="宽屏阅读设置" hidden><div class="close-row"><span>宽屏阅读</span><button type="button" aria-label="关闭设置">×</button></div></div><button type="button" class="awr-pill" aria-expanded="false" aria-label="调整对话宽度"></button>`;
  shadow.append(ui);
  const dialog = ui.querySelector('.awr-dialog');
  const pill = ui.querySelector('.awr-pill');
  function close() { dialog.hidden = true; pill.setAttribute('aria-expanded', 'false'); pill.focus(); }
  pill.addEventListener('click', () => {
    dialog.hidden = !dialog.hidden;
    pill.setAttribute('aria-expanded', String(!dialog.hidden));
    if (!dialog.hidden) dialog.querySelector('.width-slider').focus();
  });
  ui.querySelector('.close-row button').addEventListener('click', close);
  ui.addEventListener('keydown', event => { if (event.key === 'Escape') { close(); event.stopPropagation(); } });
  document.body.append(host);
  function measure() {
    frame = undefined;
    if (state.enabled && target && target.isConnected) {
      // 100% still leaves a small reading gutter; never count the sidebar as usable space.
      const width = Math.max(0, Math.min(target.clientWidth * state.width / 100, target.clientWidth - 24));
      root.style.setProperty('--awr-width', `${width}px`);
    }
  }
  function schedule() { if (frame === undefined) frame = requestAnimationFrame(measure); }
  const resize = new ResizeObserver(schedule);
  function bind() {
    if (target?.isConnected) return;
    target = document.querySelector(targetSelector);
    resize.disconnect();
    if (target) { resize.observe(target); schedule(); }
  }
  function apply(next) {
    state = next;
    root.toggleAttribute('data-awr-composer', state.composer);
    if (state.enabled) root.setAttribute('data-awr-site', site);
    else { root.removeAttribute('data-awr-site'); root.style.removeProperty('--awr-width'); }
    host.hidden = !state.floating;
    pill.textContent = state.enabled ? `↔ ${state.width}%` : '↔ 原宽';
    if (state.enabled) { bind(); schedule(); }
  }
  // Only rebind when the SPA replaces the measured container. Streaming text requires no DOM walk.
  const mutations = new MutationObserver(() => { if (state.enabled && !target?.isConnected) bind(); });
  mutations.observe(document.body, { childList: true, subtree: true });
  const panel = createPanel(site, apply);
  dialog.append(panel.element);
  panel.ready.catch(error => { panel.element.querySelector('.save-status').textContent = '读取设置失败，请刷新网页'; console.error(error); });
})();
