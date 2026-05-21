// Vite 설정 — Windows 환경 HMR 안정성 + 실기 휴대폰 접속 (Phase P-5) 보존.
//
// [Phase P-22] HMR 자동 갱신 안 되는 Windows 환경 보강:
//   - watch.usePolling: true → Windows 파일 watcher (chokidar) 누락 사례 회피.
//   - host: true → 0.0.0.0 listen (npm run dev 시 Network URL 노출 — P-5 실기 접속 보존).
//   - hmr 명시 X → Vite 가 클라이언트 측 호스트 자동 추론.
//
// [Phase P-26] force-full-reload plugin — 모든 파일 변경을 page reload 로 변환.
//   배경: P-24 의 main.js dispose 핸들러는 entry 모듈 (main.js) 자체가 update 될 때만 호출.
//   ui/scenes 자식 모듈만 변경 시 dispose 안 발동 → Phaser 인스턴스 누적 → 5+회 후 검은 화면.
//   해결: handleHotUpdate hook 에서 server.ws.send({ type: 'full-reload' }) 전송.
//   효과: 모든 파일 변경 시 location.reload() — Phaser 인스턴스 자연 소멸 (F5 와 동일).
//   trade-off: 개발 속도 살짝 느려짐 (페이지 전체 fetch). 안정성 우선.

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // host: true → 모든 네트워크 인터페이스 listen.
    //   localhost (127.0.0.1:5173) + 외부 IP (현재 192.168.219.102:5173, 와이파이 변경 시 자동 갱신).
    //   휴대폰 등 같은 와이파이 기기 접속 가능 (P-5 실기 휴대폰 흐름).
    host: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  plugins: [
    {
      name: 'force-reload-via-poll',
      // [Phase P-35] HTTP polling 으로 reload — ws 메시지 의존성 완전 제거.
      //   P-26/P-27/P-33 의 ws 기반 시도 모두 일부 환경에서 location.reload() 트리거 X.
      //   해결: vite 가 변경 시 version 타임스탬프 갱신 + index.html 에 polling 스크립트 주입.
      //   클라이언트가 1초마다 /__force_version fetch → 변경 감지 시 location.reload() 직접 호출.
      //   ws 메시지 타입 / Vite 의 module replace flow / HMR 동작 모두 우회 — 가장 reliable.
      apply: 'serve',  // dev 모드만 작동 (프로덕션 빌드 영향 X)
      configureServer(server) {
        let rev = String(Date.now());
        server.watcher.on('change', (file) => {
          console.log('[Vite force-reload-poll] file changed →', file);
          rev = String(Date.now());
        });
        server.middlewares.use('/__poll', (req, res) => {
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'text/plain');
          res.end(rev);
        });
      },
      transformIndexHtml() {
        // [Phase P-44 후속] 'version' 단어 제거 + async/await → then chain (vite module wrap 충돌 회피).
        return [{
          tag: 'script',
          injectTo: 'head',
          children: `
(function(){
  var _r = null;
  function chk() {
    fetch('/__poll', { cache: 'no-store' }).then(function(s){ return s.text(); }).then(function(t){
      if (_r === null) { _r = t; return; }
      if (_r !== t) {
        console.log('[poll] reload');
        window.location.reload();
      }
    }).catch(function(){});
  }
  setInterval(chk, 1000);
  chk();
})();
          `,
        }];
      },
    },
  ],
});
