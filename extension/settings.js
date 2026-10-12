(() => {
  const sites = {
    chatgpt: { name: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'] },
    gemini: { name: 'Gemini', hosts: ['gemini.google.com'] },
  };
  const defaults = { enabled: true, width: 85, composer: false, floating: true };
  const key = (site, field) => `${site}.${field}`;
  function read(site, values) {
    return Object.fromEntries(Object.entries(defaults).map(([field, value]) => [field, values[key(site, field)] ?? value]));
  }
  window.AWR = { sites, defaults, key, read, minWidth: 35, maxWidth: 100 };
})();
