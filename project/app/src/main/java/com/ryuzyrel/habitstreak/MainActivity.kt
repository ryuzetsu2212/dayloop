package com.ryuzyrel.habitstreak

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.app.Activity

class MainActivity : Activity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        val ws: WebSettings = webView.settings
        ws.javaScriptEnabled = true
        ws.domStorageEnabled = true
        ws.loadWithOverviewMode = true
        ws.useWideViewPort = true
        ws.mediaPlaybackRequiresUserGesture = false

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(Bridge(), "AndroidBridge")
        webView.loadUrl("file:///android_asset/www/index.html")

        // Izin notifikasi (Android 13+)
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
    }

    private var lastBackPress = 0L

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
            return
        }
        val now = System.currentTimeMillis()
        if (now - lastBackPress < 2000) {
            super.onBackPressed()
        } else {
            lastBackPress = now
            Toast.makeText(this, "Tekan sekali lagi untuk keluar", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }

    /** Bridge JS -> native untuk penjadwalan pengingat. */
    inner class Bridge {
        @JavascriptInterface
        fun scheduleReminder(habitId: String, name: String, icon: String, hour: Int, minute: Int) {
            runOnUiThread {
                ReminderScheduler.schedule(this@MainActivity, habitId, name, icon, hour, minute)
            }
        }

        @JavascriptInterface
        fun cancelReminder(habitId: String) {
            runOnUiThread {
                ReminderScheduler.cancel(this@MainActivity, habitId)
            }
        }

        @JavascriptInterface
        fun saveFile(name: String, mime: String, base64Data: String) {
            runOnUiThread {
                try {
                    val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                    val values = android.content.ContentValues().apply {
                        put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, name)
                        put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mime)
                        if (android.os.Build.VERSION.SDK_INT >= 29) {
                            put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, "Download/Dayloop")
                        }
                    }
                    val collection = if (android.os.Build.VERSION.SDK_INT >= 29)
                        android.provider.MediaStore.Downloads.getContentUri(android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    else
                        android.provider.MediaStore.Files.getContentUri("external")
                    val uri = contentResolver.insert(collection, values)
                    if (uri != null) {
                        contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                        android.widget.Toast.makeText(this@MainActivity, "Tersimpan di Download/Dayloop/$name", android.widget.Toast.LENGTH_LONG).show()
                    } else {
                        android.widget.Toast.makeText(this@MainActivity, "Gagal menyimpan file", android.widget.Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    android.widget.Toast.makeText(this@MainActivity, "Gagal: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
