package com.ncmems.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Bridge between Zebra DataWedge scanner events and WebView JavaScript.
 * DataWedge is pre-installed on all Zebra Android devices — no SDK AAR needed.
 *
 * DataWedge Protocol:
 *   - Enable:     broadcast ACTION=com.symbol.datawedge.api.ACTION with extra
 *                 "com.symbol.datawedge.api.SOFT_SCAN_TRIGGER" = START_STOP
 *   - Disable:    broadcast with SOFT_SCAN_TRIGGER = STOP
 *   - Receive:    registerReceiver for action "com.zebra.barcode.SCANNED"
 *   - Barcode:    intent extras: "com.symbol.datawedge.data_string" (String),
 *                 "com.symbol.datawedge.label_type" (String)
 *
 * Reference:  https://techdocs.zebra.com/datawedge/latest/guide/api/
 */
class ScannerBridge(private val context: Context) {

    companion object {
        private const val TAG = "ScannerBridge"
        private const val ACTION_DATAWEDGE = "com.symbol.datawedge.api.ACTION"
        private const val ACTION_SCANNED = "com.zebra.barcode.SCANNED"
        private const val EXTRA_DATA = "com.symbol.datawedge.data_string"
        private const val EXTRA_LABEL = "com.symbol.datawedge.label_type"
        private const val EXTRA_SOFT_SCAN = "com.symbol.datawedge.api.SOFT_SCAN_TRIGGER"
        private const val ACTION_RESULT = "com.symbol.datawedge.api.RESULT_ACTION"

        var lastBarcode: String = ""
            private set
        var lastBarcodeType: String = ""
            private set
        var isScannerConnected: Boolean = false
            private set
    }

    private var receiverRegistered = false
    private var jsCallback: String = "window.onBarcodeScanned"

    // DataWedge barcode receiver
    private val barcodeReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            when (intent.action) {
                ACTION_SCANNED -> {
                    val barcode = intent.getStringExtra(EXTRA_DATA) ?: return
                    val labelType = intent.getStringExtra(EXTRA_LABEL) ?: "UNKNOWN"
                    lastBarcode = barcode
                    lastBarcodeType = labelType
                    isScannerConnected = true
                    Log.d(TAG, "Barcode: [$labelType] $barcode")
                }
                ACTION_RESULT -> {
                    // DataWedge command result — check connection
                    isScannerConnected = true
                }
            }
        }
    }

    // ── Lifecycle ──────────────────────────────────────────────
    fun register(context: Context) {
        if (receiverRegistered) return
        val filter = IntentFilter().apply {
            addAction(ACTION_SCANNED)
            addAction(ACTION_RESULT)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(barcodeReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            context.registerReceiver(barcodeReceiver, filter)
        }
        receiverRegistered = true
        Log.d(TAG, "DataWedge receiver registered")
    }

    fun unregister(context: Context) {
        if (!receiverRegistered) return
        try {
            context.unregisterReceiver(barcodeReceiver)
        } catch (e: Exception) {
            Log.w(TAG, "unregister error: ${e.message}")
        }
        receiverRegistered = false
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
    fun startScanning() {
        val intent = Intent(ACTION_DATAWEDGE).apply {
            putExtra(EXTRA_SOFT_SCAN, "START")
        }
        context.sendBroadcast(intent)
        Log.d(TAG, "DataWedge scan START")
    }

    @JavascriptInterface
    fun stopScanning() {
        val intent = Intent(ACTION_DATAWEDGE).apply {
            putExtra(EXTRA_SOFT_SCAN, "STOP")
        }
        context.sendBroadcast(intent)
        Log.d(TAG, "DataWedge scan STOP")
    }

    @JavascriptInterface
    fun getConfig(): String {
        return JSONObject().apply {
            put("enableLoginQR", true)
            put("enableCategoryScan", true)
            put("beepOnScan", false)
            put("vibrateOnScan", false)
            put("loginQRFormat", "NCMEMS://")
            put("scannerType", "DataWedge")
        }.toString()
    }

    @JavascriptInterface
    fun setConfig(json: String) {
        // DataWedge uses profiles — for now just a stub
        Log.d(TAG, "setConfig: $json")
    }

    @JavascriptInterface
    fun createDataWedgeProfile() {
        // Auto-create a DataWedge profile for NC MEMS
        val profileIntent = Intent(ACTION_DATAWEDGE).apply {
            putExtra("com.symbol.datawedge.api.CREATE_PROFILE", "NC MEMS")
        }
        context.sendBroadcast(profileIntent)

        // Configure profile: enable scanning, set to barcode mode
        val configBundle = Bundle().apply {
            putString("PROFILE_NAME", "NC MEMS")
            putString("PROFILE_ENABLED", "true")
            putString("CONFIG_MODE", "UPDATE")
            putString("PLUGIN_NAME", "BARCODE")
            putString("PLUGIN_CONFIG", """{"scanner_selection":"auto","scanner_input_enabled":true}""")
        }
        val configIntent = Intent(ACTION_DATAWEDGE).apply {
            putExtra("com.symbol.datawedge.api.SET_CONFIG", configBundle)
        }
        context.sendBroadcast(configIntent)
        Log.d(TAG, "DataWedge profile created: NC MEMS")
    }
}