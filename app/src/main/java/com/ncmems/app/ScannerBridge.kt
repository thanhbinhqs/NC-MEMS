package com.ncmems.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.util.Base64
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import com.zebra.scannercontrol.BarCodeView
import com.zebra.scannercontrol.DCSSDKDefs
import com.zebra.scannercontrol.DCSScannerInfo
import com.zebra.scannercontrol.IDcsSdkApiDelegate
import com.zebra.scannercontrol.SDKHandler
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/**
 * ScannerBridge — Scan-To-Connect via Zebra Scanner SDK (v2.6.19.0).
 *
 * Flow:
 *   1. SDKHandler(context, true)  // true = STC enabled
 *   2. dcssdkGetPairingBarcode(SSI_BT_SSI_SLAVE, KEEP_CURRENT) → BarCodeView
 *   3. Render BarCodeView to Bitmap → base64 → WebView as data:image
 *   4. DS8178 scans pairing barcode → auto-connects via SSI
 *   5. callback dcssdkEventBarcode → data forwarded to JS
 */
class ScannerBridge(private val context: Context) : IDcsSdkApiDelegate {

    companion object {
        private const val TAG = "ScannerBridge"

        // Public state for JS polling
        @Volatile var lastBarcode: String = ""
            private set
        @Volatile var lastBarcodeType: String = ""
            private set
        @Volatile var isScannerConnected: Boolean = false
            private set
        @Volatile var connectedDeviceName: String = ""
            private set
        @Volatile var pairingBarcodeData: String = "" // "data:image/png;base64,..."
            private set
    }

    private var sdkHandler: SDKHandler? = null

    init {
        try {
            sdkHandler = SDKHandler(context, true) // true = STC mode
            sdkHandler?.dcssdkSetDelegate(this)
            sdkHandler?.dcssdkSetOperationalMode(DCSSDKDefs.DCSSDK_MODE.DCSSDK_OPMODE_BT_NORMAL)
            sdkHandler?.dcssdkEnableAvailableScannersDetection(true)

            Log.d(TAG, "Zebra SDK initialized (STC)")

            // Subscribe to events: barcode + session + scanner appearance
            val subscribeFlags = DCSSDKDefs.DCSSDK_EVENT.DCSSDK_EVENT_BARCODE.value or
                    DCSSDKDefs.DCSSDK_EVENT.DCSSDK_EVENT_SESSION_ESTABLISHMENT.value or
                    DCSSDKDefs.DCSSDK_EVENT.DCSSDK_EVENT_SESSION_TERMINATION.value or
                    DCSSDKDefs.DCSSDK_EVENT.DCSSDK_EVENT_SCANNER_APPEARANCE.value or
                    DCSSDKDefs.DCSSDK_EVENT.DCSSDK_EVENT_SCANNER_DISAPPEARANCE.value
            sdkHandler?.dcssdkSubsribeForEvents(subscribeFlags)

            // Generate pairing barcode for DS8178 (SSI mode)
            generatePairingBarcode()

        } catch (e: Exception) {
            Log.e(TAG, "SDK init failed: ${e.message}")
        }
    }

    // ── Generate Scan-To-Connect Barcode ───────────────────────
    private fun generatePairingBarcode() {
        try {
            // SSI slave = scanner connects to Android via SSI protocol
            val barcodeView = sdkHandler?.dcssdkGetPairingBarcode(
                DCSSDKDefs.DCSSDK_BT_PROTOCOL.SSI_BT_SSI_SLAVE,
                DCSSDKDefs.DCSSDK_BT_SCANNER_CONFIG.KEEP_CURRENT
            )

            if (barcodeView != null) {
                pairingBarcodeData = viewToBase64Png(barcodeView)
                Log.d(TAG, "Pairing barcode generated (${pairingBarcodeData.length} chars)")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Pairing barcode failed: ${e.message}")
        }
    }

    // Render a BarCodeView to a base64 PNG
    private fun viewToBase64Png(view: BarCodeView): String {
        val xSize = view.getXSize()
        val ySize = view.getYSize()
        val width = if (xSize > 0) xSize else 340
        val height = if (ySize > 0) ySize else 72
        view.measure(
            View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)
        )
        view.layout(0, 0, width, height)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(android.graphics.Color.WHITE)
        view.draw(canvas)

        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
        val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        bitmap.recycle()
        return "data:image/png;base64,$base64"
    }

    // ── IDcsSdkApiDelegate ─────────────────────────────────────
    override fun dcssdkEventScannerAppeared(scannerInfo: DCSScannerInfo) {
        Log.d(TAG, "Scanner appeared: ${scannerInfo.scannerName} (${scannerInfo.scannerID})")
    }

    override fun dcssdkEventScannerDisappeared(scannerID: Int) {
        Log.d(TAG, "Scanner disappeared: $scannerID")
    }

    override fun dcssdkEventCommunicationSessionEstablished(scannerInfo: DCSScannerInfo) {
        isScannerConnected = true
        connectedDeviceName = scannerInfo.scannerName ?: "DS8178"
        Log.d(TAG, "Session established: ${scannerInfo.scannerName}")
    }

    override fun dcssdkEventCommunicationSessionTerminated(scannerID: Int) {
        isScannerConnected = false
        connectedDeviceName = ""
        Log.d(TAG, "Session terminated: $scannerID")
    }

    override fun dcssdkEventBarcode(barcodeData: ByteArray, barcodeType: Int, scannerID: Int) {
        val barcode = String(barcodeData, Charsets.UTF_8).trim()
        lastBarcode = barcode
        lastBarcodeType = when (barcodeType) {
            0 -> "CODE128"; 1 -> "CODE39"; 2 -> "EAN13"; 3 -> "QR_CODE"
            else -> "BARCODE_$barcodeType"
        }
        Log.d(TAG, "Barcode [$scannerID]: $barcode")
    }

    override fun dcssdkEventImage(imageData: ByteArray, scannerID: Int) {}
    override fun dcssdkEventVideo(videoData: ByteArray, scannerID: Int) {}
    override fun dcssdkEventBinaryData(binaryData: ByteArray, scannerID: Int) {}
    override fun dcssdkEventFirmwareUpdate(event: com.zebra.scannercontrol.FirmwareUpdateEvent) {}
    override fun dcssdkEventAuxScannerAppeared(auxScanner: DCSScannerInfo, mainScanner: DCSScannerInfo) {}
    override fun dcssdkEventConfigurationUpdate(event: com.zebra.barcode.sdk.sms.ConfigurationUpdateEvent) {}

    // ── JS Interface ───────────────────────────────────────────
    @JavascriptInterface
    fun getPairingBarcodeData(): String = pairingBarcodeData

    @JavascriptInterface
    fun regeneratePairingBarcode(): String {
        generatePairingBarcode()
        return pairingBarcodeData
    }

    @JavascriptInterface
    fun getLastBarcode(): String = lastBarcode

    @JavascriptInterface
    fun getLastBarcodeType(): String = lastBarcodeType

    @JavascriptInterface
    fun isConnected(): Boolean = isScannerConnected

    @JavascriptInterface
    fun getConnectedDeviceName(): String = connectedDeviceName

    @JavascriptInterface
    fun getConfig(): String {
        return JSONObject().apply {
            put("scannerType", "ZEBRA_SDK_STC")
            put("sdkAvailable", true)
            put("stcMode", true)
            put("protocol", "SSI_BT_SSI_SLAVE")
        }.toString()
    }

    @JavascriptInterface
    fun getPhoneName(): String {
        return try {
            android.bluetooth.BluetoothAdapter.getDefaultAdapter()?.name ?: "Android"
        } catch (e: Exception) { "Android" }
    }

    @JavascriptInterface
    fun disconnectDevice() {
        try { sdkHandler?.dcssdkClose() } catch (_: Exception) {}
        isScannerConnected = false
        connectedDeviceName = ""
    }

    // ── Lifecycle ──────────────────────────────────────────────
    fun destroy() {
        try { sdkHandler?.dcssdkClose() } catch (_: Exception) {}
    }
}