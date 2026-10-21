package com.ryuzyrel.habitstreak

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class ReminderReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "habit_reminder"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ReminderScheduler.ACTION_REMIND) return

        val habitId = intent.getStringExtra("habitId") ?: return
        val name = intent.getStringExtra("name") ?: return
        val icon = intent.getStringExtra("icon") ?: ""

        // Jadwal ulang untuk besok (alarm exact tidak berulang otomatis)
        rescheduleNext(context, habitId)

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(CHANNEL_ID, "Pengingat Habit", NotificationManager.IMPORTANCE_DEFAULT)
            ch.description = "Pengingat harian untuk habit"
            nm.createNotificationChannel(ch)
        }

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            context, habitId.hashCode() + 1, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = if (Build.VERSION.SDK_INT >= 26) {
            android.app.Notification.Builder(context, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            android.app.Notification.Builder(context)
        }.setContentTitle("Dayloop")
            .setContentText("Jangan lupa: $icon $name")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()

        nm.notify(habitId.hashCode(), notif)
    }

    private fun rescheduleNext(context: Context, habitId: String) {
        val raw = context.getSharedPreferences("habit_reminders", Context.MODE_PRIVATE)
            .getString(habitId, null) ?: return
        val parts = raw.split("|")
        if (parts.size != 4) return
        val hour = parts[2].toIntOrNull() ?: return
        val minute = parts[3].toIntOrNull() ?: return
        ReminderScheduler.schedule(context, habitId, parts[0], parts[1], hour, minute)
    }
}
