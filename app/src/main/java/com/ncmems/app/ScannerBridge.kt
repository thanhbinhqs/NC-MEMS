package com.ncmems.app

import android.content.Context
import android.graphics.Bitmap
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/**
 * ScannerBridge — manages Zebra scanner connection and barcode events.
 *
 * MODE 1: Zebra Scanner SDK (Scan-To-Connect)
 *   Requires barcode_scanner_library AAR from Zebra.
 *   SDK initializes → generates pairing barcode → scanner scans it →
 *   auto-connects → barcode data received via SDK callback.
 *
 * MODE 2: Bluetooth Direct (fallback)
 *   Uses BtScannerService for SPP/BLE/HID connections.
 *   Phone connects to scanner by MAC, or scanner connects to phone.
 *
 * The app works in MODE 2 by default. To enable MODE 1:
 *   1. Download AAR from https://www.zebra.com/us/en/support-downloads/software/scanner-software/scanner-sdk-for-android.html
 *   2. Place in app/libs/
 *   3. Uncomment dependency in app/build.gradle.kts
 *   4. Uncomment // USE_ZEBRA_SDK in this file
 */
class ScannerBridge(private val context: Context) {

    companion object {
        private const val TAG = "ScannerBridge"
        // Set to true when Zebra SDK AAR is available
        private const val USE_ZEBRA_SDK = false

        var lastBarcode: String = ""
            private set
        var lastBarcodeType: String = ""
            private set
        var isScannerConnected: Boolean = false
            private set
        var connectedDeviceName: String = ""
            private set
        var pairingBarcodeData: String = "" // base64 PNG of pairing barcode
            private set
    }

    // Fallback Bluetooth service
    private val btService = if (!USE_ZEBRA_SDK) BtScannerService(context) else null

    init {
        if (USE_ZEBRA_SDK) {
            initZebraSdk()
        } else {
            initFallback()
        }
    }

    // ── Zebra SDK Mode ─────────────────────────────────────────
    private fun initZebraSdk() {
        Log.d(TAG, "Initializing Zebra Scanner SDK (Scan-To-Connect)...")
        // When USE_ZEBRA_SDK = true and AAR is available:
        //   val sdkHandler = SDKHandler(context, true) // true = STC mode
        //   sdkHandler.dcssdkSetDelegate(sdkDelegate)
        //   sdkHandler.dcssdkEnableAvailableScannersDetection(true)
        //   val barcodeView = sdkHandler.dcssdkGetPairingBarcode(
        //       DCSSDKDefs.DCSSDK_BT_PROTOCOL.SSI_BT_CLASSIC,
        //       DCSSDKDefs.DCSSDK_BT_SCANNER_CONFIG.DEFAULT
        //   )
        //   pairingBarcodeData = bitmapToBase64(barcodeView.bitmap)
        Log.d(TAG, "Zebra SDK not available, using fallback mode")
    }

    // ── Fallback Bluetooth Mode ────────────────────────────────
    private fun initFallback() {
        btService?.setCallback(object : BtScannerService.ScannerCallback {
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
        btService?.startServer()
    }

    // ── Helpers ────────────────────────────────────────────────
    private fun bitmapToBase64(bmp: Bitmap): String {
        val stream = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 100, stream)
        return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    }

    // ── JS Interface ───────────────────────────────────────────
    @JavascriptInterface
    fun getPairingBarcodeData(): String = pairingBarcodeData

    @JavascriptInterface
    fun getPhoneMac(): String {
        return btService?.getPhoneMac() ?: run {
            try {
                val adapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter()
                adapter?.address ?: "UNAVAILABLE"
            } catch (e: Exception) { "UNAVAILABLE" }
        }
    }

    @JavascriptInterface
    fun getPhoneName(): String = btService?.getPhoneName() ?: "Android"

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
        btService?.startScan(8000)
        return "scanning"
    }

    @JavascriptInterface
    fun stopDiscovery() { btService?.stopScan() }

    @JavascriptInterface
    fun getDiscoveredDevices(): String {
        val arr = org.json.JSONArray()
        btService?.discoveredDevices?.forEach { device ->
            arr.put(JSONObject().apply {
                put("name", device.name ?: "Unknown")
                put("address", device.address)
                put("type", when (device.type) {
                    android.bluetooth.BluetoothDevice.DEVICE_TYPE_CLASSIC -> "CLASSIC"
                    android.bluetooth.BluetoothDevice.DEVICE_TYPE_LE -> "BLE"
                    android.bluetooth.BluetoothDevice.DEVICE_TYPE_DUAL -> "DUAL"
                    else -> "UNKNOWN"
                })
            })
        }
        return arr.toString()
    }

    @JavascriptInterface
    fun connectToDevice(address: String) { btService?.connectByAddress(address) }

    @JavascriptInterface
    fun disconnectDevice() { btService?.disconnect() }

    @JavascriptInterface
    fun getConfig(): String {
        return JSONObject().apply {
            put("enableLoginQR", true)
            put("enableCategoryScan", true)
            put("loginQRFormat", "NCMEMS://")
            put("scannerType", if (USE_ZEBRA_SDK) "ZEBRA_SDK_STC" else "BLUETOOTH_FALLBACK")
            put("sdkAvailable", USE_ZEBRA_SDK)
        }.toString()
    }

    @JavascriptInterface
    fun generatePairingBarcode(): String {
        if (USE_ZEBRA_SDK) {
            // Regenerate pairing barcode from SDK
            return pairingBarcodeData
        }
        // Fallback: return empty — JS will generate Code128 barcode
        return ""
    }

    // ── Lifecycle ──────────────────────────────────────────────
    fun destroy() {
        btService?.destroy()
    }
}