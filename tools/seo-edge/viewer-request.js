// Integration candidate: run this logic BEFORE existing clean-URL rewriting.
// Do not replace an existing viewer-request function without merging its behavior.
function handler(event) {
  var request = event.request;
  if (request.method !== 'GET' && request.method !== 'HEAD') return request;
  var host = request.headers.host && request.headers.host.value;
  if (host !== 'studycrack.co.kr' && host !== 'www.studycrack.co.kr') return request;
  var uri = request.uri;
  var canonical = uri;
  var pages = ['service', 'analysis', 'payment', 'qna', 'jungsi-score-guide', 'jungsi-admission-prediction-guide', 'jungsi-percentile-guide'];
  var stripped = uri.replace(/\/+$/, '') || '/';
  if (stripped === '/index.html' || stripped === '/') canonical = '/';
  for (var i = 0; i < pages.length; i++) {
    if (stripped === '/' + pages[i] || stripped === '/' + pages[i] + '.html') canonical = '/' + pages[i];
  }
  if (host === 'studycrack.co.kr' && canonical === uri) return request;
  var query = [];
  var params = request.querystring || {};
  for (var key in params) {
    var values = params[key].multiValue || [params[key]];
    for (var j = 0; j < values.length; j++) query.push(key + '=' + values[j].value);
  }
  var location = 'https://studycrack.co.kr' + canonical + (query.length ? '?' + query.join('&') : '');
  if (/[\r\n]/.test(location)) return request;
  return { statusCode: 301, statusDescription: 'Moved Permanently', headers: {
    location: { value: location }, 'cache-control': { value: 'public, max-age=300' }
  }};
}
