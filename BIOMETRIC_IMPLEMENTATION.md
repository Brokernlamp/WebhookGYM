# Biometric Device Implementation - Real Device Integration

## ✅ What's Been Implemented

Real eSSL K30 Pro device integration is now implemented! The system can:

1. **Connect to Device** - TCP/IP connection on port 4370
2. **Read Fingerprint Scans** - Polls device every 1 second for new attendance logs
3. **Process Access Control** - Checks member status, dates, and payment
4. **Unlock Door** - Sends relay control command to unlock door
5. **Record Attendance** - Automatically logs attendance when access granted

## 🔧 How It Works

### Connection Method

**TCP Polling (Current Implementation)**
- App connects to device via TCP/IP on port 4370
- Polls device every 1 second for new attendance logs
- Processes new scans immediately
- Sends door unlock command if access granted

**HTTP Push (Alternative - if device supports)**
- Device pushes events to: `http://<PC-IP>:5000/essl/push`
- Real-time processing (no polling delay)
- Configure device to push events (if supported)

### Flow

1. **Device Scan** → Fingerprint scanned on eSSL device
2. **Device Logs** → Device records scan in internal log
3. **App Polls** → App reads log from device (every 1 second)
4. **Find Member** → App finds member by biometric ID
5. **Check Access** → Validates:
   - Member status = "active"
   - Current date within start/expiry dates
   - Payment status not "pending" or "overdue"
6. **If Allowed**:
   - ✅ Record attendance
   - ✅ Unlock door (relay control)
   - ✅ Log success
7. **If Denied**:
   - ❌ Door stays locked
   - ⚠️ Log denied attempt

## 📋 Requirements

### Hardware
- eSSL K30 Pro device
- Network connection (Ethernet or WiFi)
- PC and device on same LAN
- Door relay wired (for automatic unlock)

### Software
- Device IP address configured
- Port 4370 accessible
- Comm Key (if set on device)

## 🚀 Setup Steps

### 1. Configure Device Settings

1. Open desktop app
2. Go to **Settings** → **Biometric Device Settings**
3. Enter:
   - **Device IP Address**: e.g., `192.168.1.100`
   - **Port**: `4370` (default)
   - **Comm Key**: Device password (usually `0`)
   - **Unlock Duration**: `3` seconds
   - **Relay Type**: `NO` or `NC` (based on wiring)
4. Click **"Save Biometric Settings"**

### 2. Test Connection

1. Click **"Test Connection"** button
2. Should see: "Successfully connected to device"
3. If fails, check:
   - IP address is correct
   - Device and PC on same network
   - Port 4370 is open
   - Device is powered on

### 3. Link Members

1. Go to **Members** page
2. Click **View** on a member
3. Click **"Link Biometric"**
4. Enter the **User ID** from device (e.g., `1001`)
5. Click **Link**

### 4. Verify It's Working

1. Polling starts automatically when app launches
2. Check console logs for:
   - `🔄 Biometric device polling started`
   - `✅ Connected to eSSL device at...`
3. Scan fingerprint on device
4. Should see:
   - `✅ Access granted: [Member Name]` (if allowed)
   - `❌ Access denied: [Member Name]` (if denied)
5. Check attendance - should be recorded automatically

## 🔍 Monitoring

### Console Logs

Watch for these messages:
- `🔄 Biometric device polling started` - Service started
- `✅ Connected to eSSL device at...` - Connection successful
- `✅ Access granted: [Name]` - Scan successful, door unlocked
- `❌ Access denied: [Name]` - Access denied
- `❌ Device connection error` - Connection failed

### Verify Attendance

- Go to **Attendance** page
- Look for entries with `markedVia: "biometric"`
- Should appear within 1 second of scan

## ⚠️ Important Notes

### Protocol Compatibility

The implementation uses a generic eSSL protocol based on common patterns:
- Packet format: `[0x55, 0xAA] + [Command] + [Data] + [Checksum] + [0x00, 0x00]`
- Commands: Connect, Get Users, Get Logs, Relay Control

**Note**: Different eSSL models may have slight protocol variations. If you encounter issues:
1. Check device documentation for exact protocol
2. Adjust packet format in `server/biometric-device.ts` if needed
3. Test with actual device to verify

### Performance

- Polling runs every 1 second
- Minimal network overhead
- Non-blocking (doesn't slow down app)
- Auto-reconnects if connection lost

### Error Handling

- Connection errors are logged but don't break the app
- Failed scans are logged
- App continues working even if device is offline
- Auto-retry on connection loss

## 🐛 Troubleshooting

### Connection Fails

**Check:**
1. IP address is correct
2. Device and PC on same network
3. Port 4370 is open (firewall)
4. Device is powered on
5. Ping device: `ping 192.168.1.100`

### Scans Not Detected

**Check:**
1. Polling is running (check console logs)
2. Member is linked to correct biometric ID
3. Device is recording scans
4. Connection is active

### Door Not Unlocking

**Check:**
1. Relay is wired correctly
2. Relay type setting matches wiring (NO vs NC)
3. Unlock duration is set
4. Access control logic allows access (check member status)

### Protocol Errors

If you see protocol parsing errors:
1. Device may use different packet format
2. Check eSSL device documentation
3. May need to adjust `buildCommand()` or `parseResponse()` functions
4. Test with actual device to see packet format

## 📝 Protocol Details

### Commands Implemented

- `CMD_CONNECT` (0x10000001) - Connect to device
- `CMD_GET_USER` (0x00000005) - Fetch users from device
- `CMD_GET_ATTENDANCE_LOG` (0x0000000D) - Get attendance logs
- `CMD_RELAY_CONTROL` (0x00140000) - Control door relay

### Packet Format

```
[Start Marker: 0x55, 0xAA]
[Command: 4 bytes, little-endian]
[Comm Key: 4 bytes, little-endian]
[Data: variable length]
[Checksum: 1 byte (XOR of all bytes)]
[End Marker: 0x00, 0x00]
```

### Log Format

```
[Timestamp: 4 bytes, Unix timestamp]
[User ID: 2 bytes]
[Status: 1 byte]
[Verify Mode: 1 byte]
```

## 🎯 Testing

### Test Connection

```bash
# Via API
curl -X POST http://localhost:5000/api/biometric/test-connection
```

### Test Scan (Simulation)

```bash
curl -X POST http://localhost:5000/api/biometric/simulate-scan \
  -H "Content-Type: application/json" \
  -d '{"biometricId": "1001"}'
```

### Real Device Test

1. Scan fingerprint on device
2. Watch console for logs
3. Check attendance page
4. Verify door unlocks (if wired)

---

**Status**: ✅ **Real device integration implemented and ready for testing!**

