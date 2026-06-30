package com.ncmems.app

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var scannerBridge: ScannerBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        supportActionBar?.hide()

        // ===== EDGE-TO-EDGE with transparent system bars =====
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Transparent system status bar + navigation bar
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        // Light status bar icons (dark icons on transparent bg are hard to see)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.decorView.systemUiVisibility =
                window.decorView.systemUiVisibility or
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }

        // Allow drawing under notch / cutout (API 28+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        // Keep screen on
        window.setFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            setSupportZoom(false)
            builtInZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            defaultTextEncodingName = "UTF-8"
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
                result.confirm()
                return true
            }
        }
        webView.webViewClient = WebViewClient()

        // JavaScript interface for native features
        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        // Load the HTML from assets (before scanner init — display login UI first)
        webView.loadUrl("file:///android_asset/index.html")

        // Init scanner and request Bluetooth permissions
        initScannerWithPermissions()
    }

    private fun initScannerWithPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val permissions = mutableListOf<String>()
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN)
                != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_SCAN)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (permissions.isNotEmpty()) {
                btPermissionLauncher.launch(permissions.toTypedArray())
                return // Scanner will init after permissions granted
            }
        }
        // Permissions already granted or Android < 12
        doInitScanner()
    }

    private fun doInitScanner() {
        scannerBridge = ScannerBridge(this)
        webView.addJavascriptInterface(scannerBridge, "ScannerBridge")
        // Re-notify JS that scanner is ready
        webView.evaluateJavascript(
            "if(typeof ScannerBridge !== 'undefined') { Scanner.init(); renderLoginQR(); }", null)

    }

    private val btPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val allGranted = result.values.all { it }
        if (allGranted) {
            doInitScanner()
        } else {
            // Show toast-like feedback in WebView
            webView.evaluateJavascript(
                "showToast('⚠️ Cần cấp quyền Bluetooth để kết nối scanner')", null)
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.evaluateJavascript("window.checkConnectionAgain?.()", null)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::scannerBridge.isInitialized) {
            scannerBridge.destroy()
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                super.onBackPressed()
            } else {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }
}
