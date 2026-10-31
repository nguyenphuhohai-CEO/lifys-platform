import webpush from 'web-push';

// Notifications push Web : actives uniquement si les clés VAPID sont configurées.
export function createPush(config) {
  const { publicKey, privateKey, subject } = config.vapid;
  const enabled = Boolean(publicKey && privateKey);
  if (enabled) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  async function notify(database, userId, payload) {
    if (!enabled) return;
    const body = JSON.stringify(payload);
    for (const sub of database.listPushSubscriptions(userId)) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, { TTL: 3600 });
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          database.removePushSubscription(sub.endpoint);
        }
      }
    }
  }

  return { enabled, notify: (database, userId, payload) => { notify(database, userId, payload).catch(() => {}); } };
}
