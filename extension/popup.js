for (const site of Object.keys(window.AWR.sites)) {
  const panel = window.AWR.createPanel(site);
  document.getElementById('panels').append(panel.element);
  panel.ready.catch(error => {
    panel.element.querySelector('.save-status').textContent = '读取设置失败，请重新打开扩展';
    console.error(error);
  });
}
