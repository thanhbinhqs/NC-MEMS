package com.ncmems.app

import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.io.InputStream
import java.io.OutputStream
import java.util.*

/**
 * Bluetooth scanner service — supports both Bluetooth Classic (SPP) and BLE.
 *
 * Zebra Barcode scanners typically support:
 *   - Bluetooth Classic SPP (RFCOMM): data arrives as raw byte stream
 *   - BLE: data via GATT notifications
 *
 * In HID mode (keyboard emulation) the scanner types directly into focused fields.
 * This service connects in SPP/BLE mode for programmatic access.
 */
class BtScannerService(private val context: Context) {

    companion object {
        private const val TAG = "BtScanner"
        // Common Zebra BLE service/char UUIDs (SSI over BLE)
        private val ZEBRA_BLE_SERVICE = UUID.fromString("00001810-0000-1000-8000-00805f9b34fb") // Device Information
        private val ZEBRA_DATA_CHAR = UUID.fromString("00002a35-0000-1000-8000-00805f9b34fb") // SSI data
        private val ZEBRA_BLE_SERVICE_ALT = UUID.fromString("49535343-fe7d-4ae5-8fa9-9fafd205e455") // Nordic UART
        private val ZEBRA_TX_CHAR = UUID.fromString("49535343-1e4d-4bd9-ba61-23c647249616")
        private val ZEBRA_RX_CHAR = UUID.fromString("49535343-8841-43f4-a8d4-ec36c0a0e0f3")
        // SPP UUID (Bluetooth Classic)
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34cb")
        // BLE scan settings
        private const val BLE_SCAN_PERIOD = 10000L
        private const val RECONNECT_DELAY = 5000L
    }

    // ── Callback interface ─────────────────────────────────────
    interface ScannerCallback {
        fun onBarcodeReceived(barcode: String, type: String)
        fun onConnectionStateChanged(connected: Boolean, deviceName: String)
        fun onError(message: String)
    }

    // ── Connection type ─────────────────────────────────────────
    enum class ConnectionType { NONE, BLUETOOTH_CLASSIC, BLE }

    // ── State ───────────────────────────────────────────────────
    private var callback: ScannerCallback? = null
    private var connectionType = ConnectionType.NONE
    private var connectedDevice: BluetoothDevice? = null
    private var connectedDeviceName: String = ""

    // Bluetooth Classic (SPP)
    private var bluetoothSocket: BluetoothSocket? = null
    private var sppThread: Thread? = null

    // BLE
    private var bluetoothGatt: BluetoothGatt? = null
    private var bleNotifyCharacteristic: BluetoothGattCharacteristic? = null

    // Scanner
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bleScanner: BluetoothLeScanner? = null
    private var isScanning = false
    private val handler = Handler(Looper.getMainLooper())
    private var scanResults = mutableListOf<BluetoothDevice>()
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 3
    private var autoReconnect = true

    // ── Init ────────────────────────────────────────────────────
    init {
        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = btManager?.adapter
    }

    fun setCallback(cb: ScannerCallback?) { callback = cb }

    // ── Scan ────────────────────────────────────────────────────
    fun startScan(durationMs: Long = BLE_SCAN_PERIOD) {
        if (isScanning) return
        scanResults.clear()
        isScanning = true

        // Use BLE scan (discovers both BLE and Classic devices)
        bleScanner = bluetoothAdapter?.bluetoothLeScanner
        if (bleScanner == null) {
            callback?.onError("Bluetooth LE not available")
            isScanning = false
            return
        }

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        val filters = listOf(
            ScanFilter.Builder().build() // All devices
        )

        bleScanner?.startScan(filters, settings, bleScanCallback)

        handler.postDelayed({
            stopScan()
        }, durationMs)

        Log.d(TAG, "BLE scan started")
    }

    fun stopScan() {
        if (!isScanning) return
        isScanning = false
        bleScanner?.stopScan(bleScanCallback)
        handler.removeCallbacksAndMessages(null)
        Log.d(TAG, "BLE scan stopped, found ${scanResults.size} devices")
    }

    val isScanningActive: Boolean get() = isScanning
    val discoveredDevices: List<BluetoothDevice> get() = scanResults.toList()

    // ── Connect by MAC address (without prior discovery) ────────
    fun connectByAddress(address: String): Boolean {
        // First check if it's already in discovered list
        val existing = scanResults.find { it.address.equals(address, ignoreCase = true) }
        if (existing != null) {
            connect(existing)
            return true
        }

        // Need to get the device from the adapter
        val device = bluetoothAdapter?.getRemoteDevice(address)
        if (device != null) {
            scanResults.add(device)
            connect(device)
            return true
        }
        return false
    }

    // ── BLE Scan callback ───────────────────────────────────────
    private val bleScanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            val device = result?.device ?: return
            // Deduplicate
            if (scanResults.none { it.address == device.address }) {
                scanResults.add(device)
                Log.d(TAG, "Discovered: ${device.name ?: "Unknown"} [${device.address}]")
            }
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE scan failed: $errorCode")
            isScanning = false
            callback?.onError("BLE scan failed (code $errorCode)")
        }
    }

    // ── Connect ─────────────────────────────────────────────────
    fun connect(device: BluetoothDevice) {
        connectedDevice = device
        connectedDeviceName = device.name ?: device.address
        reconnectAttempts = 0

        // Try BLE first, fall back to Classic
        if (device.type == BluetoothDevice.DEVICE_TYPE_LE || device.type == BluetoothDevice.DEVICE_TYPE_DUAL) {
            connectBLE(device)
        } else {
            connectClassic(device)
        }
    }

    fun disconnect() {
        autoReconnect = false
        disconnectInternal()
    }

    private fun disconnectInternal() {
        // Stop BLE
        bluetoothGatt?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                it.close()
            } else {
                @Suppress("DEPRECATION")
                it.disconnect()
                @Suppress("DEPRECATION")
                it.close()
            }
        }
        bluetoothGatt = null
        bleNotifyCharacteristic = null

        // Stop SPP
        sppThread?.interrupt()
        sppThread = null
        try { bluetoothSocket?.close() } catch (_: Exception) {}
        bluetoothSocket = null

        connectionType = ConnectionType.NONE

        if (connectedDeviceName.isNotEmpty()) {
            callback?.onConnectionStateChanged(false, connectedDeviceName)
        }
    }

    private fun connectBLE(device: BluetoothDevice) {
        Log.d(TAG, "Connecting BLE to ${device.address}")
        connectionType = ConnectionType.BLE
        bluetoothGatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            device.connectGatt(context, false, bleGattCallback, BluetoothDevice.TRANSPORT_LE)
        } else {
            @Suppress("DEPRECATION")
            device.connectGatt(context, false, bleGattCallback)
        }
    }

    private fun connectClassic(device: BluetoothDevice) {
        Log.d(TAG, "Connecting Classic to ${device.address}")
        connectionType = ConnectionType.BLUETOOTH_CLASSIC

        Thread {
            try {
                val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                bluetoothSocket = socket
                bluetoothAdapter?.cancelDiscovery()
                socket.connect()

                callback?.onConnectionStateChanged(true, connectedDeviceName)

                // Read stream
                val inputStream = socket.inputStream
                sppThread = Thread {
                    readSppStream(inputStream)
                }.apply { start() }

            } catch (e: Exception) {
                Log.e(TAG, "SPP connect failed: ${e.message}")
                connectionType = ConnectionType.NONE
                callback?.onError("Kết nối thất bại: ${e.message}")
                attemptReconnect()
            }
        }.apply { start() }
    }

    private fun readSppStream(inputStream: InputStream) {
        val buffer = ByteArray(1024)
        val sb = StringBuilder()

        try {
            while (!Thread.currentThread().isInterrupted) {
                val bytesRead = inputStream.read(buffer)
                if (bytesRead > 0) {
                    for (i in 0 until bytesRead) {
                        val b = buffer[i].toInt() and 0xFF
                        // Zebra typically sends ASCII: STX (0x02) prefix, ETX (0x03) suffix
                        // or just raw data terminated by CR/LF
                        when (b) {
                            0x02 -> sb.setLength(0) // STX - start
                            0x03, 0x0D, 0x0A -> { // ETX, CR, LF - end
                                if (sb.isNotEmpty()) {
                                    val barcode = sb.toString()
                                    Log.d(TAG, "SPP barcode: $barcode")
                                    callback?.onBarcodeReceived(barcode, "CODE128")
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
                Log.e(TAG, "SPP read error: ${e.message}")
                callback?.onError("Mất kết nối scanner")
                attemptReconnect()
            }
        }
    }

    // ── BLE GATT callback ───────────────────────────────────────
    private val bleGattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                Log.d(TAG, "BLE connected to ${gatt.device.address}")
                gatt.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                Log.d(TAG, "BLE disconnected")
                callback?.onConnectionStateChanged(false, connectedDeviceName)
                attemptReconnect()
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                callback?.onError("Không thể discover services")
                return
            }

            // Find data characteristic
            var foundChar: BluetoothGattCharacteristic? = null

            // Try Zebra SSI service first
            val ssiService = gatt.getService(ZEBRA_BLE_SERVICE)
            if (ssiService != null) {
                foundChar = ssiService.getCharacteristic(ZEBRA_DATA_CHAR)
            }

            // Fall back to Nordic UART
            if (foundChar == null) {
                val uartService = gatt.getService(ZEBRA_BLE_SERVICE_ALT)
                if (uartService != null) {
                    foundChar = uartService.getCharacteristic(ZEBRA_TX_CHAR)
                }
            }

            // Try any service with notify/indicate properties
            if (foundChar == null) {
                for (service in gatt.services) {
                    for (char in service.characteristics) {
                        if (char.properties and (BluetoothGattCharacteristic.PROPERTY_NOTIFY or BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0) {
                            foundChar = char
                            break
                        }
                    }
                    if (foundChar != null) break
                }
            }

            foundChar?.let { char ->
                bleNotifyCharacteristic = char
                val enabled = gatt.setCharacteristicNotification(char, true)
                if (enabled) {
                    // For Indicate, need CCCD
                    val cccdUuid = UUID.fromString("00002902-0000-1000-8000-00805f9b34cb")
                    val cccd = char.getDescriptor(cccdUuid)
                    cccd?.let {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            it.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        } else {
                            @Suppress("DEPRECATION")
                            it.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        }
                        gatt.writeDescriptor(it)
                    }
                }

                callback?.onConnectionStateChanged(true, connectedDeviceName)
                Log.d(TAG, "BLE notifications enabled on ${char.uuid}")
            } ?: callback?.onError("Không tìm thấy characteristic dữ liệu")
        }

        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            val barcode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                characteristic.value?.toString(Charsets.UTF_8) ?: return
            } else {
                @Suppress("DEPRECATION")
                String(characteristic.value ?: return, Charsets.UTF_8)
            }

            Log.d(TAG, "BLE barcode: $barcode")
            callback?.onBarcodeReceived(barcode.trim(), "CODE128")
        }
    }

    // ── Reconnect ───────────────────────────────────────────────
    private fun attemptReconnect() {
        if (!autoReconnect || reconnectAttempts >= maxReconnectAttempts) return
        reconnectAttempts++
        val device = connectedDevice ?: return

        Log.d(TAG, "Reconnect attempt $reconnectAttempts/$maxReconnectAttempts")
        handler.postDelayed({
            if (autoReconnect) {
                disconnectInternal()
                connect(device)
            }
        }, RECONNECT_DELAY)
    }

    // ── Cleanup ─────────────────────────────────────────────────
    fun destroy() {
        autoReconnect = false
        stopScan()
        disconnectInternal()
    }
}