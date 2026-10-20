(function () {
  'use strict';
  window.__studycrackAppBooted = false;
  setTimeout(function () {
    if (window.__studycrackAppBooted) return;
    var root = document.getElementById('root');
    if (!root) return;
    var shell = document.createElement('div');
    shell.className = 'mobile-boot-shell';
    var panel = document.createElement('div');
    panel.className = 'init-loading';
    var message = document.createElement('div');
    message.setAttribute('role', 'alert');
    var title = document.createElement('h3');
    title.textContent = '앱을 불러오지 못했습니다';
    var detail = document.createElement('p');
    var describe = function () {
      detail.textContent = navigator.onLine === false ? '오프라인 상태예요. 연결 후 다시 시도해주세요.' : '연결 상태를 확인한 뒤 페이지를 다시 불러와주세요.';
    };
    describe();
    window.addEventListener('online', describe);
    window.addEventListener('offline', describe);
    var retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '다시 불러오기';
    retry.addEventListener('click', function () { window.location.reload(); });
    message.append(title, detail);
    panel.append(message, retry);
    shell.append(panel);
    root.replaceChildren(shell);
  }, 12000);
})();
