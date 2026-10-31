package tech.berty.bertybridgeexpo.service;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import tech.berty.bertybridgeexpo.gobridge.Logger;
import tech.berty.bertybridgeexpo.notification.NotificationHelper;

/**
 * Foreground service that keeps the Berty process (and so the Go node and the BLE
 * driver) alive while the app is in the background or has been removed from the
 * recent apps, like Briar does with its BriarService. Without it Android is free to
 * freeze or kill the process, and messages are only delivered once the app is opened.
 *
 * The service does not do any work by itself: it only owns an ongoing notification.
 */
public class BackgroundService extends Service {
    private static final String TAG = "BackgroundService";
    private static final int ONGOING_NOTIFICATION_ID = 0x4265;
    private static final String EXTRA_TITLE = "title";
    private static final String EXTRA_TEXT = "text";

    public static void start(Context context, String title, String text) {
        Intent intent = new Intent(context, BackgroundService.class);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_TEXT, text);
        try {
            ContextCompat.startForegroundService(context, intent);
        } catch (RuntimeException e) {
            // e.g. ForegroundServiceStartNotAllowedException when started from the background
            Logger.e(TAG, "unable to start the background service", e);
        }
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, BackgroundService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        String text = intent != null ? intent.getStringExtra(EXTRA_TEXT) : null;

        try {
            ServiceCompat.startForeground(
                this,
                ONGOING_NOTIFICATION_ID,
                buildNotification(title, text),
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                    : 0
            );
        } catch (RuntimeException e) {
            Logger.e(TAG, "unable to enter the foreground", e);
            stopSelf();
        }

        // Don't restart automatically if killed: the bridge would not be running anyway,
        // the JS side starts the service again when it initializes the bridge.
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String title, String text) {
        // make sure the channel exists
        new NotificationHelper(getBaseContext());

        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = null;
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            contentIntent = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE);
        }

        return new NotificationCompat.Builder(this, NotificationHelper.CHANNEL_ID_SERVICE)
            .setContentTitle(title != null ? title : "Berty")
            .setContentText(text != null ? text : "Running in the background")
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setShowWhen(false)
            .setContentIntent(contentIntent)
            .build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
