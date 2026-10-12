(() => {
  const sites = {
    chatgpt: { name: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'] },
    gemini: { name: 'Gemini', hosts: ['gemini.google.com'] },
  };
  const defaults = { enabled: true, width: 85, composer: false };
  const key = (site, field) => `${site}.${field}`;
  function read(site, values) {
    return Object.fromEntries(Object.entries(defaults).map(([field, value]) => [field, values[key(site, field)] ?? value]));
  }
  function watch(site, callback) {
    let state = { ...defaults };
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const patch = {};
      for (const field of Object.keys(defaults)) {
        const change = changes[key(site, field)];
        if (change) patch[field] = change.newValue ?? defaults[field];
      }
      if (Object.keys(patch).length) { state = { ...state, ...patch }; callback(state); }
    });
    return chrome.storage.local.get(null).then(values => { state = read(site, values); callback(state); });
  }
  window.AWR = { sites, defaults, key, watch, minWidth: 35, maxWidth: 100 };
})();
