(() => {
  const { sites, defaults, watch } = window.AWR;
  const site = Object.keys(sites).find(id => sites[id].hosts.includes(location.hostname));
  if (!site) return;
  const root = document.documentElement;
  const targetSelector = site === 'chatgpt' ? 'main' : 'chat-window';
  let state = { ...defaults };
  let target;
  let frame;
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
    if (state.enabled) { bind(); schedule(); }
  }
  // Only rebind when the SPA replaces the measured container. Streaming text requires no DOM walk.
  const mutations = new MutationObserver(() => { if (state.enabled && !target?.isConnected) bind(); });
  mutations.observe(document.body, { childList: true, subtree: true });
  watch(site, apply).catch(error => console.error('宽屏阅读：读取设置失败，请刷新网页', error));
})();
