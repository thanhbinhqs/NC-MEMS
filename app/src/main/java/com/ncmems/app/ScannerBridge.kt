package com.ncmems.app

import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Bridge between Zebra Scanner SDK events and WebView JavaScript.
 * All @JavascriptInterface methods are callable from app.js.
 */
class ScannerBridge(private val context: Context) {

    companion object {
        private const val TAG = "ScannerBridge"
        var lastBarcode: String = ""
            private set
        var lastBarcodeType: String = ""
            private set
        var isScannerConnected: Boolean = false
            private set
    }

    // JS callback target — set by app.js on init
    private var jsCallback: String = "window.onBarcodeScanned"

    // ── Configuration ──────────────────────────────────────────
    data class ScanConfig(
        val enableLoginQR: Boolean = true,   // scan QR → auto login
        val enableCategoryScan: Boolean = true, // scan → pass to active category
        val beepOnScan: Boolean = true,
        val vibrateOnScan: Boolean = true,
        val prefix: String = "",   // expected barcode prefix for login QR
        val loginQRFormat: String = "NCMEMS://" // QR content prefix for login
    )

    val config = ScanConfig()

    // ── Called from native ScannerManager ──────────────────────
    fun onBarcodeReceived(barcode: String, barcodeType: String) {
        lastBarcode = barcode
        lastBarcodeType = barcodeType
        Log.d(TAG, "Barcode: [$barcodeType] $barcode")
    }

    // ── JS Interface ───────────────────────────────────────────
    @JavascriptInterface
    fun getLastBarcode(): String = lastBarcode

    @JavascriptInterface
    fun getLastBarcodeType(): String = lastBarcodeType

    @JavascriptInterface
    fun isConnected(): Boolean = isScannerConnected

    @JavascriptInterface
    fun setJsCallback(name: String) {
        jsCallback = name
    }

    @JavascriptInterface
    fun getConfig(): String {
        return JSONObject().apply {
            put("enableLoginQR", config.enableLoginQR)
            put("enableCategoryScan", config.enableCategoryScan)
            put("beepOnScan", config.beepOnScan)
            put("vibrateOnScan", config.vibrateOnScan)
            put("loginQRFormat", config.loginQRFormat)
        }.toString()
    }

    @JavascriptInterface
    fun setConfig(json: String) {
        try {
            val obj = JSONObject(json)
            if (obj.has("enableLoginQR")) config.copy(enableLoginQR = obj.getBoolean("enableLoginQR"))
            if (obj.has("enableCategoryScan")) config.copy(enableCategoryScan = obj.getBoolean("enableCategoryScan"))
            if (obj.has("beepOnScan")) config.copy(beepOnScan = obj.getBoolean("beepOnScan"))
            if (obj.has("vibrateOnScan")) config.copy(vibrateOnScan = obj.getBoolean("vibrateOnScan"))
        } catch (e: Exception) {
            Log.w(TAG, "setConfig error: ${e.message}")
        }
    }

    @JavascriptInterface
    fun startScanning() {
        Log.d(TAG, "Scanner started — waiting for barcode events")
    }

    @JavascriptInterface
    fun stopScanning() {
        Log.d(TAG, "Scanner stopped")
    }
}