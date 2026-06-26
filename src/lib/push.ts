import webpush from 'web-push';
import { prisma } from './db';

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured in .env');
  }

  webpush.setVapidDetails(
    'mailto:disruption-radar@example.com',
    publicKey,
    privateKey
  );

  return { publicKey, privateKey };
}

export async function saveSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId: userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    create: {
      userId: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
  console.log('[Push] Subscription saved.');
}

export async function removeSubscription(endpoint: string) {
  try {
    await prisma.pushSubscription.delete({ where: { endpoint } });
    console.log('[Push] Subscription removed.');
  } catch (e) {
    // Might not exist, that's fine
    console.log('[Push] No subscription found to remove.');
  }
}

export async function sendPushAlert(userId: string, payload: { title: string; body: string }) {
  getVapidConfig();

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId }
  });

  if (subscriptions.length === 0) {
    console.log('[Push] No active subscriptions. Skipping push.');
    return;
  }

  console.log(`[Push] Sending alert to ${subscriptions.length} subscriber(s)...`);

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(pushSub, JSON.stringify(payload));
      } catch (err: any) {
        // If subscription expired (410 Gone), clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[Push] Removing expired subscription: ${sub.endpoint.slice(0, 50)}...`);
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          throw err;
        }
      }
    })
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`[Push] Sent: ${succeeded}, Failed: ${failed}`);
}
