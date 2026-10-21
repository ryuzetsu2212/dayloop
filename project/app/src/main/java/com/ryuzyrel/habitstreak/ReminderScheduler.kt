package com.ryuzyrel.habitstreak

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/**
 * Penjadwalan alarm pengingat harian. Data pengingat juga disimpan di
 * SharedPreferences agar bisa dijadwal ulang setelah reboot.
 * Format value: "nama|icon|hour|minute" (karakter '|' pada nama dibuang).
 */
object ReminderScheduler {

    private const val PREFS = "habit_reminders"
    const val ACTION_REMIND = "com.ryuzyrel.habitstreak.ACTION_REMIND"

    fun schedule(context: Context, habitId: String, name: String, icon: String, hour: Int, minute: Int) {
        val safeName = name.replace("|", " ").take(60)
        val safeIcon = icon.replace("|", "")
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(habitId, "$safeName|$safeIcon|$hour|$minute")
            .apply()

        val trigger = nextTriggerMillis(hour, minute)
        val pi = pendingIntent(context, habitId, safeName, safeIcon)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        try {
            if (Build.VERSION.SDK_INT >= 31 && am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
            } else if (Build.VERSION.SDK_INT < 31) {
                @Suppress("DEPRECATION")
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
            }
        } catch (se: SecurityException) {
            // Tanpa izin exact alarm: pakai inexact sebagai fallback
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
        }
    }

    fun cancel(context: Context, habitId: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove(habitId)
            .apply()
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pendingIntent(context, habitId, "", ""))
    }

    /** Jadwal ulang semua pengingat tersimpan (dipakai saat boot & tiap aplikasi dibuka). */
    fun rescheduleAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        for ((habitId, raw) in prefs.all) {
            val parts = (raw as? String)?.split("|") ?: continue
            if (parts.size != 4) continue
            val hour = parts[2].toIntOrNull() ?: continue
            val minute = parts[3].toIntOrNull() ?: continue
            schedule(context, habitId, parts[0], parts[1], hour, minute)
        }
    }

    private fun nextTriggerMillis(hour: Int, minute: Int): Long {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, hour)
        cal.set(Calendar.MINUTE, minute)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        if (cal.timeInMillis <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        return cal.timeInMillis
    }

    private fun pendingIntent(context: Context, habitId: String, name: String, icon: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION_REMIND
            putExtra("habitId", habitId)
            putExtra("name", name)
            putExtra("icon", icon)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getBroadcast(context, habitId.hashCode(), intent, flags)
    }
}
