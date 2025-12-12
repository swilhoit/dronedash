// Service Worker for caching Google 3D Tiles
const CACHE_NAME = 'drone-dash-tiles-v1';
const TILE_CACHE_NAME = 'google-3d-tiles-v1';

// Tile domains to cache
const TILE_DOMAINS = [
  'tile.googleapis.com',
  'khms0.googleapis.com',
  'khms1.googleapis.com',
  'khms2.googleapis.com',
  'khms3.googleapis.com',
  'maps.googleapis.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'streetviewpixels-pa.googleapis.com',
  'cbk0.googleapis.com',
  'cbk1.googleapis.com',
  'cbk2.googleapis.com',
  'cbk3.googleapis.com',
  'mt0.googleapis.com',
  'mt1.googleapis.com',
  'mt2.googleapis.com',
  'mt3.googleapis.com',
];

// Max cache size (approximate) - 2GB
const MAX_CACHE_SIZE_MB = 2000;
const MAX_CACHE_ENTRIES = 20000;

self.addEventListener('install', (event) => {
  console.log('[SW] Installing tile cache service worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating tile cache service worker');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== TILE_CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
    ])
  );
});

// Check if URL is a tile request we should cache
function isTileRequest(url) {
  try {
    const urlObj = new URL(url);
    return TILE_DOMAINS.some((domain) => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

// Create a cache key without auth tokens (they expire)
function getCacheKey(url) {
  try {
    const urlObj = new URL(url);
    // Remove session/auth tokens from URL for caching
    urlObj.searchParams.delete('session');
    urlObj.searchParams.delete('token');
    urlObj.searchParams.delete('key');
    // Keep the essential tile identifiers
    return urlObj.toString();
  } catch {
    return url;
  }
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only intercept tile requests
  if (!isTileRequest(url)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cacheKey = getCacheKey(url);
      const cache = await caches.open(TILE_CACHE_NAME);

      // Try cache first
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        // Return cached tile
        return cachedResponse;
      }

      // Not in cache, fetch from network
      try {
        const networkResponse = await fetch(event.request);

        // Only cache successful responses
        if (networkResponse.ok) {
          // Clone response before caching (response can only be read once)
          const responseToCache = networkResponse.clone();

          // Cache in background (don't block response)
          event.waitUntil(
            (async () => {
              try {
                await cache.put(cacheKey, responseToCache);
                // Periodically clean up cache if too large
                await trimCache(cache);
              } catch (e) {
                console.warn('[SW] Cache write failed:', e);
              }
            })()
          );
        }

        return networkResponse;
      } catch (error) {
        console.warn('[SW] Fetch failed, no cache available:', error);
        throw error;
      }
    })()
  );
});

// Trim cache if it gets too large
async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_CACHE_ENTRIES) {
    console.log(`[SW] Trimming cache: ${keys.length} entries`);
    // Delete oldest 10% of entries
    const deleteCount = Math.floor(keys.length * 0.1);
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'GET_CACHE_STATS') {
    getCacheStats().then((stats) => {
      event.ports[0].postMessage(stats);
    });
  } else if (event.data.type === 'CLEAR_TILE_CACHE') {
    caches.delete(TILE_CACHE_NAME).then(() => {
      event.ports[0].postMessage({ cleared: true });
    });
  }
});

async function getCacheStats() {
  try {
    const cache = await caches.open(TILE_CACHE_NAME);
    const keys = await cache.keys();
    return {
      entries: keys.length,
      maxEntries: MAX_CACHE_ENTRIES,
    };
  } catch {
    return { entries: 0, maxEntries: MAX_CACHE_ENTRIES };
  }
}
