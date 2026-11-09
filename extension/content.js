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

  function chatGPTLayout() {
    const selector = 'main .thread-scroll-container';
    const property = '--awr-chat-pane-width';
    const marker = 'data-awr-chat-pane';
    const panes = new Set();
    let observing = false;

    const resize = new ResizeObserver(entries => {
      for (const { target, contentRect } of entries) {
        const width = `${contentRect.width}px`;
        if (target.style.getPropertyValue(property) === width) continue;
        target.style.setProperty(property, width);
        target.setAttribute(marker, '');
      }
    });
    function observe(pane) {
      if (panes.has(pane)) return;
      panes.add(pane);
      resize.observe(pane);
    }
    function forget(pane) {
      resize.unobserve(pane);
      panes.delete(pane);
      pane.removeAttribute(marker);
      pane.style.removeProperty(property);
    }
    const mutations = new MutationObserver(records => {
      for (const pane of panes) if (!pane.isConnected || !pane.matches(selector)) forget(pane);
      for (const { addedNodes } of records) for (const node of addedNodes) {
        if (!(node instanceof Element) || !node.isConnected) continue;
        if (node.matches(selector)) observe(node);
        if (node.firstElementChild) node.querySelectorAll(selector).forEach(observe);
      }
    });

    return ({ enabled, width, composer }) => {
      applyWidth(enabled ? String(width / 100) : null, composer);
      if (enabled === observing) return;
      observing = enabled;
      if (enabled) {
        document.querySelectorAll(selector).forEach(observe);
        mutations.observe(document.body, { childList: true, subtree: true });
      } else {
        mutations.disconnect();
        for (const pane of panes) forget(pane);
      }
    };
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

  const apply = site === 'chatgpt' ? chatGPTLayout() : geminiLayout();
  watch(site, apply).catch(error => console.error('宽屏阅读：读取设置失败，请刷新网页', error));
})();
