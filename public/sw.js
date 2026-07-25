// CACHE_VERSION을 배포마다 올려서 이전 캐시를 폐기한다 (버전을 고정해두면 절대 갱신되지 않음).
const CACHE_VERSION = "2";
const CACHE_NAME = `asset-mgmt-v${CACHE_VERSION}`;

const NEVER_CACHE_HOSTS = [
  "googleapis.com",
  "google.com",
  "gstatic.com",
  "firebaseio.com",
];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE_HOSTS.some((host) => url.hostname.includes(host))) return;

  // 페이지 내비게이션: 네트워크 우선 — 배포 후 캐시된 옛 HTML을 보여주지 않도록 함.
  // 오프라인일 때만 캐시로 폴백.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match("/");
        })
    );
    return;
  }

  // 해시가 붙은 정적 자산(_next/static 등): 캐시 우선 — 내용이 바뀌면 파일명 자체가 바뀌므로 안전.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});
