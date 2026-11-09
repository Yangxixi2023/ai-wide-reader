(() => {
  const { sites, watch } = window.AWR;
  const site = Object.keys(sites).find(id => sites[id].hosts.includes(location.hostname));
  if (!site) return;
  const root = document.documentElement;
  function applyWidth(width, composer) {
    root.toggleAttribute('data-awr-composer', width !== null && composer);
    if (width === null) {
      root.removeAttribute('data-awr-site');
      root.style.removeProperty('--awr-width');
    } else {
      root.style.setProperty('--awr-width', width);
      root.setAttribute('data-awr-site', site);
    }
  }

  function geminiLayout() {
    let state, target, frame;
    function measure() {
      frame = undefined;
      if (state.enabled && target?.isConnected) {
        // 100% still leaves a small reading gutter; the sidebar is outside chat-window.
        const available = target.clientWidth;
        const width = Math.max(0, Math.min(available * state.width / 100, available - 24));
        applyWidth(`${width}px`, state.composer);
      }
    }
    function schedule() { if (frame === undefined) frame = requestAnimationFrame(measure); }
    const resize = new ResizeObserver(schedule);
    function bind() {
      if (target?.isConnected) return;
      target = document.querySelector('chat-window');
      resize.disconnect();
      if (target) resize.observe(target);
    }
    const mutations = new MutationObserver(() => { if (state?.enabled && !target?.isConnected) bind(); });
    mutations.observe(document.body, { childList: true, subtree: true });
    return next => {
      state = next;
      if (state.enabled) { bind(); schedule(); }
      else applyWidth(null, false);
    };
  }

  const apply = site === 'chatgpt'
    ? ({ enabled, width, composer }) => applyWidth(enabled ? `${width}%` : null, composer)
    : geminiLayout();
  watch(site, apply).catch(error => console.error('宽屏阅读：读取设置失败，请刷新网页', error));
})();
