// ヒトオシ Service Worker
// 担当: ① 出勤前プッシュ通知 ② 週1振り返り通知

const CACHE = 'hitooshi-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// ── 通知クリック: アプリを前面に出す ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});

// ── メッセージ受信: スケジュール登録 ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATIONS') {
    scheduleAll(e.data.payload);
  }
});

// ── スケジューリング本体 ──
async function scheduleAll({ morningMsg, reviewMsg, reviewTag }) {
  // 既存の予定通知をキャンセル (registration.showNotification はキャンセル不可のため、
  // ここでは次回起動時に再スケジュールする設計とし、重複を防ぐためフラグ管理は呼び元で行う)

  const now = new Date();

  // ① 出勤前通知: 次の平日 7:30
  const morning = nextWeekday730(now);
  const msToMorning = morning - now;
  if (msToMorning > 0) {
    setTimeout(() => {
      self.registration.showNotification('ヒトオシ ✦', {
        body: morningMsg,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'morning',
        renotify: true,
        data: { type: 'morning' }
      });
      // 翌日分を再スケジュール (SW起動中のみ有効。実用上はページ訪問時に毎回呼ぶ)
    }, msToMorning);
  }

  // ② 週1振り返り通知: 次の日曜 20:00
  if (reviewMsg) {
    const sunday = nextSunday20(now);
    const msToSunday = sunday - now;
    if (msToSunday > 0) {
      setTimeout(() => {
        self.registration.showNotification('ヒトオシ ✦', {
          body: reviewMsg,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'weekly-review',
          renotify: false,
          data: { type: 'review', tag: reviewTag }
        });
      }, msToSunday);
    }
  }
}

function nextWeekday730(from) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(7, 30);
  // 既に今日の7:30を過ぎていたら翌日へ
  if (d <= from) d.setDate(d.getDate() + 1);
  // 土日をスキップ
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function nextSunday20(from) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(20, 0);
  // 次の日曜を探す
  const daysUntilSun = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSun);
  return d;
}
