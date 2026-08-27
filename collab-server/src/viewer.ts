export const VIEWER_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nerd 협업</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: "Segoe UI", "Malgun Gothic", sans-serif; background: #12141a; color: #e7eaf0; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 14px; color: #9aa3b2; margin: 24px 0 10px; }
    p { color: #9aa3b2; line-height: 1.55; }
    .box { font-family: Consolas, "Cascadia Mono", monospace; background: #10131a; border: 1px solid #2d3340; border-radius: 6px; padding: 10px 12px; word-break: break-all; }
    .row { display: flex; gap: 8px; margin: 12px 0 8px; }
    button { height: 32px; padding: 0 12px; border: 1px solid #3d4554; background: #262b36; color: inherit; border-radius: 4px; cursor: pointer; }
    .tables { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    .card { background: #1c2029; border: 1px solid #2d3340; border-radius: 6px; padding: 10px 12px; }
    .card h3 { margin: 0 0 8px; font-size: 13px; }
    .card li { color: #9aa3b2; font-size: 12px; }
    .people { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 8px; }
    .chip { background: #1f3d57; color: #d6ecfa; border-radius: 99px; padding: 4px 10px; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Nerd 협업 보기</h1>
    <p id="status">연결 중...</p>
    <p>같이 편집하려면 Nerd 앱에서 <strong>도구 → 협업 참가</strong>에 아래 접속 정보를 붙여넣으세요.</p>
    <div class="box" id="join"></div>
    <div class="row"><button type="button" id="copy">접속 정보 복사</button></div>
    <h2>참가자</h2>
    <div class="people" id="people"></div>
    <h2>테이블</h2>
    <div class="tables" id="tables"></div>
  </main>
  <script>
    const roomId = location.pathname.split('/').filter(Boolean)[1]
    const joinUrl = 'nerd-collab://' + location.host + '/' + roomId
    document.getElementById('join').textContent = joinUrl
    document.getElementById('copy').onclick = async () => { await navigator.clipboard.writeText(joinUrl) }
    function render(doc, viewers) {
      document.getElementById('status').textContent =
        ((doc && doc.name) || '문서') + ' · 테이블 ' + ((doc && doc.tables && doc.tables.length) || 0)
      document.getElementById('people').innerHTML = (viewers || []).map((v) => {
        const role = v.role === 'host' ? '호스트' : v.role === 'viewer' ? '보기' : '편집'
        return '<span class="chip">' + (v.name || '참가자') + ' · ' + role + '</span>'
      }).join('') || '<span class="chip">없음</span>'
      document.getElementById('tables').innerHTML = ((doc && doc.tables) || []).map((table) => {
        const cols = (table.columns || []).map((c) => '<li>' + c.name + '</li>').join('')
        return '<section class="card"><h3>' + table.name + '</h3><ul>' + cols + '</ul></section>'
      }).join('') || '<p>테이블이 없습니다.</p>'
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(proto + '://' + location.host + '/ws')
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'join', roomId,
        clientId: 'browser-' + Math.random().toString(16).slice(2),
        role: 'viewer', name: '브라우저'
      }))
    }
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.snapshot) window.__doc = msg.snapshot
      if (msg.document) window.__doc = msg.document
      if (msg.viewers) window.__viewers = msg.viewers
      if (msg.type === 'joined' || msg.type === 'snapshot' || msg.type === 'presence') {
        render(window.__doc, window.__viewers)
      }
      if (msg.type === 'error') document.getElementById('status').textContent = msg.message
    }
    ws.onclose = () => { document.getElementById('status').textContent = '연결이 끊어졌습니다.' }
  </script>
</body>
</html>
`
