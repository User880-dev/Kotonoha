const CACHE_NAME = 'kotonoha-v1';

self.addEventListener('install', (event) => {
    // インストール時に即座に有効化
    self.skipWaiting();
    console.log('Service Worker: Installed');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activated');
});

self.addEventListener('fetch', (event) => {
    // 現時点ではネットワーク優先で動作（将来的にキャッシュを追加可能）
    event.respondWith(fetch(event.request));
});

