package com.ncmems.app

import android.bluetooth.BluetoothDevice
import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject

/**
 * Bridge between Bluetooth scanner (SPP/BLE) and WebView JavaScript.
 * Uses BtScannerService for all Bluetooth connectivity.
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
    }

    // ── JS Interface ───────────────────────────────────────────
    @JavascriptInterface
    fun getLastBarcode(): String = lastBarcode

    @JavascriptInterface
    fun getLastBarcodeType(): String = lastBarcodeType

    @JavascriptInterface
    fun isConnected(): Boolean = isScannerConnected

    @JavascriptInterface
    fun getConnectedDeviceName(): String = connectedDeviceName

    @JavascriptInterface
    fun startDiscovery(): String {
        btService.startScan(8000)
        return "scanning"
    }

    @JavascriptInterface
    fun stopDiscovery() {
        btService.stopScan()
    }

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

    @JavascriptInterface
    fun connectToDevice(address: String) {
        val device = btService.discoveredDevices.find { it.address == address }
        if (device != null) {
            btService.connect(device)
        } else {
            Log.w(TAG, "Device $address not found in discovered list")
        }
    }

    @JavascriptInterface
    fun disconnectDevice() {
        btService.disconnect()
    }

    @JavascriptInterface
    fun startScanning() {
        // Scanner is already receiving data via BtScannerService callbacks
    }

    @JavascriptInterface
    fun stopScanning() {
        // Scanner keeps running via BtScannerService
    }

    @JavascriptInterface
    fun getConfig(): String {
        return JSONObject().apply {
            put("enableLoginQR", true)
            put("enableCategoryScan", true)
            put("beepOnScan", false)
            put("vibrateOnScan", false)
            put("loginQRFormat", "NCMEMS://")
            put("scannerType", "BLUETOOTH_SPP_BLE")
        }.toString()
    }

    @JavascriptInterface
    fun setConfig(json: String) {
        Log.d(TAG, "setConfig: $json")
    }

    // ── Lifecycle ──────────────────────────────────────────────
    fun destroy() {
        btService.destroy()
    }
}