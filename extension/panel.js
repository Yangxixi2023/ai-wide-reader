(() => {
  const { sites, defaults, key, read, minWidth, maxWidth } = window.AWR;
  function createPanel(site, onChange) {
    const element = document.createElement('section');
    element.className = 'site-panel';
    element.innerHTML = `
      <header class="site-heading"><h2></h2><label class="switch"><input type="checkbox" data-field="enabled"><span>启用</span></label></header>
      <div class="width-heading"><label>对话宽度 <input class="width-number" type="number" min="${minWidth}" max="${maxWidth}" step="1" aria-label="对话宽度百分比"> %</label></div>
      <input class="width-slider" type="range" min="${minWidth}" max="${maxWidth}" step="1" aria-label="调整对话宽度">
      <div class="scale"><span>${minWidth}%</span><span>占可用对话区域</span><span>${maxWidth}%</span></div>
      <div class="presets"><button type="button" data-width="65">舒适 65%</button><button type="button" data-width="85">宽屏 85%</button><button type="button" data-width="100">铺满 100%</button></div>
      <label class="option"><input type="checkbox" data-field="composer">输入框跟随宽度</label>
      <label class="option"><input type="checkbox" data-field="floating">显示页面快捷按钮</label>
      <footer><button type="button" class="restore">恢复网站原宽度</button><button type="button" class="reset">重置设置</button></footer>
      <p class="save-status" role="status" aria-live="polite"></p>`;
    element.querySelector('h2').textContent = sites[site].name;
    const slider = element.querySelector('.width-slider');
    const number = element.querySelector('.width-number');
    const status = element.querySelector('.save-status');
    let state = { ...defaults };
    function render(next) {
      state = next;
      slider.value = number.value = state.width;
      slider.disabled = number.disabled = !state.enabled;
      for (const input of element.querySelectorAll('[data-field]')) input.checked = state[input.dataset.field];
      for (const button of element.querySelectorAll('[data-width]')) {
        button.setAttribute('aria-pressed', String(Number(button.dataset.width) === state.width && state.enabled));
      }
    }
    async function update(patch) {
      render({ ...state, ...patch });
      onChange?.(state);
      try {
        await chrome.storage.local.set(Object.fromEntries(Object.entries(patch).map(([field, value]) => [key(site, field), value])));
        status.textContent = '已保存到本机';
      } catch (error) {
        status.textContent = '保存失败，请刷新网页后重试';
        console.error('宽屏阅读：保存设置失败', error);
      }
    }
    slider.addEventListener('input', () => update({ width: Number(slider.value) }));
    number.addEventListener('input', () => {
      if (number.validity.valid && number.value !== '') update({ width: Number(number.value) });
    });
    number.addEventListener('change', () => { if (!number.validity.valid || number.value === '') render(state); });
    for (const input of element.querySelectorAll('[data-field]')) input.addEventListener('change', () => update({ [input.dataset.field]: input.checked }));
    for (const button of element.querySelectorAll('[data-width]')) button.addEventListener('click', () => update({ width: Number(button.dataset.width), enabled: true }));
    element.querySelector('.restore').addEventListener('click', () => update({ enabled: false }));
    element.querySelector('.reset').addEventListener('click', () => update({ ...defaults }));
    const listener = (changes, area) => {
      if (area !== 'local') return;
      const patch = {};
      for (const field of Object.keys(defaults)) {
        const change = changes[key(site, field)];
        if (change) patch[field] = change.newValue ?? defaults[field];
      }
      if (Object.keys(patch).length) { render({ ...state, ...patch }); onChange?.(state); }
    };
    chrome.storage.onChanged.addListener(listener);
    render(state);
    const ready = chrome.storage.local.get(null).then(values => { render(read(site, values)); onChange?.(state); });
    return { element, ready };
  }
  window.AWR.createPanel = createPanel;
})();
