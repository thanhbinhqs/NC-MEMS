package com.ncmems.app

import android.bluetooth.BluetoothDevice
import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject

/**
 * Bridge between Bluetooth scanner and WebView JavaScript.
 *
 * PRIMARY FLOW (recommended):
 *   1. QR code on login page shows the phone's Bluetooth MAC
 *   2. Zebra scanner scans the QR → connects to phone (HID keyboard or SPP)
 *   3. Barcode data received via BtScannerService server + HID key capture
 *
 * FALLBACK:
 *   User can still discover & connect to a scanner from Settings.
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
        var connectedDeviceName: String = ""
            private set
    }

    private val btService = BtScannerService(context)

    init {
        btService.setCallback(object : BtScannerService.ScannerCallback {
            override fun onBarcodeReceived(barcode: String, type: String) {
                lastBarcode = barcode
                lastBarcodeType = type
                isScannerConnected = true
                Log.d(TAG, "Barcode: [$type] $barcode")
            }

            override fun onConnectionStateChanged(connected: Boolean, deviceName: String) {
                isScannerConnected = connected
                connectedDeviceName = if (connected) deviceName else ""
                Log.d(TAG, "Scanner ${if (connected) "connected" else "disconnected"}: $deviceName")
            }

            override fun onError(message: String) {
                Log.w(TAG, "Error: $message")
            }
        })

        // Start Bluetooth server for incoming scanner connections
        btService.startServer()
    }

    // ── Phone Info ─────────────────────────────────────────────
    @JavascriptInterface
    fun getPhoneMac(): String = btService.getPhoneMac()

    @JavascriptInterface
    fun getPhoneName(): String = btService.getPhoneName()

    // ── Status ──────────────────────────────────────────────────
    @JavascriptInterface
    fun getLastBarcode(): String = lastBarcode

    @JavascriptInterface
    fun getLastBarcodeType(): String = lastBarcodeType

    @JavascriptInterface
    fun isConnected(): Boolean = isScannerConnected

    @JavascriptInterface
    fun getConnectedDeviceName(): String = connectedDeviceName

    // ── Discovery (for Settings → scan for devices) ────────────
    @JavascriptInterface
    fun startDiscovery(): String {
        btService.startScan(8000)
        return "scanning"
    }

    @JavascriptInterface
    fun stopDiscovery() { btService.stopScan() }

    @JavascriptInterface
    fun getDiscoveredDevices(): String {
        val arr = JSONArray()
        btService.discoveredDevices.forEach { device ->
            arr.put(JSONObject().apply {
                put("name", device.name ?: "Unknown")
                put("address", device.address)
                put("type", when (device.type) {
                    BluetoothDevice.DEVICE_TYPE_CLASSIC -> "CLASSIC"
                    BluetoothDevice.DEVICE_TYPE_LE -> "BLE"
                    BluetoothDevice.DEVICE_TYPE_DUAL -> "DUAL"
                    else -> "UNKNOWN"
                })
            })
        }
        return arr.toString()
    }

    // ── Client connect (fallback) ──────────────────────────────
    @JavascriptInterface
    fun connectToDevice(address: String) {
        btService.connectByAddress(address)
    }

    @JavascriptInterface
    fun disconnectDevice() { btService.disconnect() }

    @JavascriptInterface
    fun startScanning() {}

    @JavascriptInterface
    fun stopScanning() {}

    @JavascriptInterface
    fun getConfig(): String {
        return JSONObject().apply {
            put("enableLoginQR", true)
            put("enableCategoryScan", true)
            put("loginQRFormat", "NCMEMS://")
            put("scannerType", "BLUETOOTH_SERVER")
        }.toString()
    }

    @JavascriptInterface
    fun setConfig(json: String) { Log.d(TAG, "setConfig: $json") }

    // ── Lifecycle ──────────────────────────────────────────────
    fun destroy() { btService.destroy() }
}