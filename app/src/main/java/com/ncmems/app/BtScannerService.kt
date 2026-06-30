package com.ncmems.app

import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.io.InputStream
import java.util.*

/**
 * Bluetooth scanner service — supports both server (scanner connects to phone)
 * and client (phone connects to scanner) modes.
 *
 * SERVER MODE (primary): Phone advertises via QR code → scanner scans QR → scanner
 * connects to phone via Bluetooth (HID keyboard or SPP). Barcode data arrives via:
 *   - HID: keystrokes typed into focused field (captured by JS keydown)
 *   - SPP: incoming BluetoothSocket connection (this service)
 *
 * CLIENT MODE (fallback): Phone connects to scanner directly via MAC (used for
 * configured scanners that support SPP/BLE client connections).
 */
class BtScannerService(private val context: Context) {

    companion object {
        private const val TAG = "BtScanner"
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34cb")
        private val SPP_SERVICE_NAME = "NC MEMS Scanner"
        private const val RECONNECT_DELAY = 5000L
    }

    // ── Callback ──────────────────────────────────────────────
    interface ScannerCallback {
        fun onBarcodeReceived(barcode: String, type: String)
        fun onConnectionStateChanged(connected: Boolean, deviceName: String)
        fun onError(message: String)
    }

    // ── State ───────────────────────────────────────────────────
    private var callback: ScannerCallback? = null
    private var connectedDeviceName: String = ""
    private var isServerRunning = false
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 3
    private var autoReconnect = false

    // Server (incoming connections from scanner)
    private var serverSocket: BluetoothServerSocket? = null
    private var serverThread: Thread? = null
    private var connectedSocket: BluetoothSocket? = null
    private var dataThread: Thread? = null

    // Client (phone connects to scanner)
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var clientSocket: BluetoothSocket? = null
    private var clientThread: Thread? = null
    private var clientDataThread: Thread? = null

    // BLE client
    private var bluetoothGatt: BluetoothGatt? = null
    private var bleNotifyCharacteristic: BluetoothGattCharacteristic? = null

    // Scanner
    private var bleScanner: BluetoothLeScanner? = null
    private var isScanning = false
    private val handler = Handler(Looper.getMainLooper())
    private var scanResults = mutableListOf<BluetoothDevice>()

    // ── Init ────────────────────────────────────────────────────
    init {
        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = btManager?.adapter
    }

    fun setCallback(cb: ScannerCallback?) { callback = cb }

    // ── Phone MAC ───────────────────────────────────────────────
    fun getPhoneMac(): String {
        return try {
            val adapter = bluetoothAdapter
            if (adapter == null) return "N/A"
            // Try to get real MAC (works on most devices despite deprecation)
            val mac = adapter.address
            if (mac != null && mac != "02:00:00:00:00:00") return mac
            // Fallback: use device name
            "NAME:${adapter.name}"
        } catch (e: Exception) {
            "UNAVAILABLE"
        }
    }

    fun getPhoneName(): String = bluetoothAdapter?.name ?: "Android"

    // ── SERVER MODE: Listen for incoming scanner connections ────
    fun startServer() {
        if (isServerRunning) return

        Thread {
            try {
                val adapter = bluetoothAdapter ?: return@Thread
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    serverSocket = adapter.listenUsingInsecureRfcommWithServiceRecord(SPP_SERVICE_NAME, SPP_UUID)
                } else {
                    @Suppress("DEPRECATION")
                    serverSocket = adapter.listenUsingRfcommWithServiceRecord(SPP_SERVICE_NAME, SPP_UUID)
                }
                isServerRunning = true
                Log.d(TAG, "Bluetooth server listening for scanner connections...")

                // Accept connections (blocking)
                while (isServerRunning) {
                    try {
                        val socket = serverSocket?.accept()
                        if (socket != null) {
                            connectedSocket = socket
                            val deviceName = socket.remoteDevice.name ?: socket.remoteDevice.address
                            connectedDeviceName = deviceName
                            Log.d(TAG, "Scanner connected: $deviceName")
                            callback?.onConnectionStateChanged(true, deviceName)
                            readDataLoop(socket)
                        }
                    } catch (e: Exception) {
                        if (isServerRunning) {
                            Log.w(TAG, "Accept error: ${e.message}")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Server error: ${e.message}")
                isServerRunning = false
            }
        }.apply { serverThread = this; start() }
    }

    fun stopServer() {
        isServerRunning = false
        serverThread?.interrupt()
        serverThread = null
        try { serverSocket?.close() } catch (_: Exception) {}
        serverSocket = null
        disconnectSocket()
    }

    private fun readDataLoop(socket: BluetoothSocket) {
        dataThread?.interrupt()
        dataThread = Thread {
            try {
                val input = socket.inputStream
                val buf = ByteArray(1024)
                val sb = StringBuilder()

                while (!Thread.currentThread().isInterrupted) {
                    val n = input.read(buf)
                    if (n > 0) {
                        for (i in 0 until n) {
                            val b = buf[i].toInt() and 0xFF
                            when (b) {
                                0x02 -> sb.setLength(0)
                                0x03, 0x0D, 0x0A -> {
                                    if (sb.isNotEmpty()) {
                                        callback?.onBarcodeReceived(sb.toString(), "CODE128")
                                        sb.setLength(0)
                                    }
                                }
                                in 0x20..0x7E -> sb.append(b.toChar())
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                if (!Thread.currentThread().isInterrupted) {
                    Log.w(TAG, "Data read error: ${e.message}")
                    onDisconnected()
                }
            }
        }.apply { start() }
    }

    private fun disconnectSocket() {
        dataThread?.interrupt()
        dataThread = null
        try { connectedSocket?.close() } catch (_: Exception) {}
        connectedSocket = null
        if (connectedDeviceName.isNotEmpty()) {
            callback?.onConnectionStateChanged(false, connectedDeviceName)
            connectedDeviceName = ""
        }
    }

    private fun onDisconnected() {
        val name = connectedDeviceName
        connectedDeviceName = ""
        callback?.onConnectionStateChanged(false, name)
    }

    // ── CLIENT MODE: Phone connects to scanner by MAC ──────────
    fun connectByAddress(address: String): Boolean {
        try {
            val device = bluetoothAdapter?.getRemoteDevice(address) ?: return false
            connectBluetoothClassic(device)
            return true
        } catch (e: Exception) {
            Log.e(TAG, "connectByAddress error: ${e.message}")
            return false
        }
    }

    private fun connectBluetoothClassic(device: BluetoothDevice) {
        Thread {
            try {
                val socket = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
                } else {
                    @Suppress("DEPRECATION")
                    device.createRfcommSocketToServiceRecord(SPP_UUID)
                }
                clientSocket = socket
                bluetoothAdapter?.cancelDiscovery()
                socket.connect()
                connectedDeviceName = device.name ?: device.address
                callback?.onConnectionStateChanged(true, connectedDeviceName)
                readDataLoop(socket)
            } catch (e: Exception) {
                Log.e(TAG, "Client connect error: ${e.message}")
                callback?.onError("Kết nối thất bại: ${e.message}")
                onDisconnected()
            }
        }.apply { clientThread = this; start() }
    }

    fun disconnect() {
        autoReconnect = false
        clientDataThread?.interrupt()
        clientDataThread = null
        try { clientSocket?.close() } catch (_: Exception) {}
        clientSocket = null
        disconnectSocket()

        bluetoothGatt?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                it.close()
            } else {
                @Suppress("DEPRECATION")
                it.disconnect(); it.close()
            }
        }
        bluetoothGatt = null
        bleNotifyCharacteristic = null
    }

    // ── Discovery (BLE scan for finding target scanners) ───────
    fun startScan(durationMs: Long = 8000) {
        if (isScanning) return
        scanResults.clear()
        isScanning = true
        bleScanner = bluetoothAdapter?.bluetoothLeScanner ?: run {
            callback?.onError("Bluetooth LE not available"); isScanning = false; return
        }
        bleScanner?.startScan(null, ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), bleScanCallback)
        handler.postDelayed({ stopScan() }, durationMs)
    }

    fun stopScan() {
        if (!isScanning) return; isScanning = false
        bleScanner?.stopScan(bleScanCallback)
        handler.removeCallbacksAndMessages(null)
    }

    val isScanningActive: Boolean get() = isScanning
    val discoveredDevices: List<BluetoothDevice> get() = scanResults.toList()

    private val bleScanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            val device = result?.device ?: return
            if (scanResults.none { it.address == device.address }) {
                scanResults.add(device)
            }
        }
        override fun onScanFailed(errorCode: Int) {
            isScanning = false
            callback?.onError("BLE scan failed (code $errorCode)")
        }
    }

    // ── Cleanup ─────────────────────────────────────────────────
    fun destroy() {
        autoReconnect = false
        stopScan()
        stopServer()
        disconnect()
    }
}