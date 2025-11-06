# Biometric Device Setup Guide - eSSL K30 Pro

This guide will help you integrate your eSSL K30 Pro biometric fingerprint attendance machine with the Gym Admin Dashboard software.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Device Configuration](#device-configuration)
3. [Software Configuration](#software-configuration)
4. [Member Enrollment & Linking](#member-enrollment--linking)
5. [Testing & Verification](#testing--verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements
- eSSL K30 Pro biometric device
- Network connection (Ethernet cable or WiFi)
- Desktop PC running the Gym Admin Dashboard software
- Door relay wiring (if using automatic door unlock)

### Software Requirements
- Gym Admin Dashboard software installed and running
- Device and PC on the same local network (LAN)

### Information Needed
Before starting, gather the following information from your biometric device:
- **Device IP Address** (e.g., 192.168.1.100)
- **Port** (default: 4370)
- **Comm Key / Device Password** (if set)
- **Device ID** (for reference)
- **Relay Type** (NO = Normally Open, NC = Normally Closed)
- **Door Unlock Duration** (recommended: 3 seconds)

---

## Device Configuration

### Step 1: Access Device Menu

1. On the eSSL K30 Pro device, press the **MENU** button
2. Use the **directional arrows** (↑↓←→) to navigate
3. Press **OK** to select options

### Step 2: Find Network Settings

1. Navigate to **Menu → Comm/Network → TCP/IP**
2. Note the following information:
   - **IP Address**: e.g., 192.168.1.100
   - **Port**: Usually 4370 (default)
   - **Subnet Mask**: e.g., 255.255.255.0
   - **Gateway**: e.g., 192.168.1.1
   - **DNS**: Optional

### Step 3: Find Device ID & Comm Key

1. Navigate to **Menu → System → Device Info**
   - Note the **Device ID** (for reference)
2. Navigate to **Menu → Comm → Comm Key**
   - Note the **Comm Key** value (default is usually 0)
   - If not set, leave empty or set to 0

### Step 4: Verify Date/Time

1. Navigate to **Menu → System → Date/Time**
2. Ensure date and time are correct
3. Set timezone if available
4. Save changes

### Step 5: Check Relay/Door Settings (if applicable)

1. Navigate to **Menu → Access Control → Door Settings**
2. Note the **Relay Type**:
   - **NO** = Normally Open (door unlocks when relay activates)
   - **NC** = Normally Closed (door locks when relay activates)
3. Set **Open Time** (recommended: 3 seconds)

### Step 6: Verify Push Service (Optional)

1. Navigate to **Menu → Comm → Server/Push**
2. Check if **Push Service** is available
3. If available, you can configure it later (not required for initial setup)

---

## Software Configuration

### Step 1: Open Settings Page

1. Launch the Gym Admin Dashboard software
2. Navigate to **Settings** from the sidebar
3. Scroll down to **Biometric Device Settings** section

### Step 2: Enter Device Information

Fill in the following fields:

1. **Device IP Address**
   - Enter the IP address noted from Step 2 (e.g., 192.168.1.100)

2. **Port**
   - Enter the port number (default: 4370)

3. **Comm Key / Device Password**
   - Enter the Comm Key from Step 3
   - Leave empty if not set or set to 0

4. **Door Unlock Duration (seconds)**
   - Enter how long the door should stay unlocked (recommended: 3)

5. **Relay Type**
   - Select **Normally Open (NO)** or **Normally Closed (NC)** based on Step 5

### Step 3: Test Connection

1. Click **Test Connection** button
2. Wait for the result:
   - ✅ **Success**: Device is reachable and settings are correct
   - ❌ **Failed**: Check IP address, port, and network connection

### Step 4: Save Settings

1. Click **Save Biometric Settings** button
2. Wait for confirmation message
3. Settings are now saved

---

## Member Enrollment & Linking

### Method 1: Link Existing Fingerprints (Recommended)

If members already have fingerprints enrolled on the device:

1. **Export Device Users List** (if possible):
   - Use eSSL utility software or device menu to export user list
   - Note the User IDs and Names

2. **Link Members to Device Users**:
   - Go to **Members** page
   - Click **View** on a member card
   - Click **Link Biometric** button
   - Enter the **Biometric User ID** from the device
   - OR click **Fetch from Device** to load users (if available)
   - Click **Link** to save

### Method 2: Enroll New Fingerprints

If you need to enroll new members:

1. **Enroll on Device**:
   - On the eSSL device, press **MENU**
   - Navigate to **User Management → Enroll**
   - Follow device prompts to enroll fingerprint
   - Note the **User ID** assigned (e.g., 1, 2, 3...)

2. **Link in Software**:
   - Go to **Members** page
   - Click **View** on the member
   - Click **Link Biometric** button
   - Enter the **User ID** from Step 1
   - Click **Link** to save

### Repeat for All Members

- Link each member to their corresponding biometric User ID
- You can verify linked members by checking the member profile

---

## Testing & Verification

### Test 1: Validate Membership Check

1. **Simulate a Scan** (if available):
   - Use the software's test scan feature (if implemented)
   - Enter a biometric ID
   - Verify the system checks:
     - Member status is "active"
     - Current date is within start and expiry dates
     - Payment status is not "pending" or "overdue"

### Test 2: Test Real Fingerprint Scan

1. **Use Active Member**:
   - Ensure member has:
     - Status = "active"
     - Valid membership dates (start ≤ today ≤ expiry)
     - Payment status = "paid"

2. **Scan Fingerprint**:
   - Place finger on the device scanner
   - Wait for scan result

3. **Expected Behavior**:
   - ✅ **Green light** or success indicator on device
   - ✅ **Door unlocks** (if relay is wired)
   - ✅ **Attendance recorded** in software
   - ✅ **Toast notification** appears in software (if running)

### Test 3: Test Expired Member

1. **Use Expired Member**:
   - Ensure member has:
     - Status = "expired" OR
     - Expiry date < today OR
     - Payment status = "pending" or "overdue"

2. **Scan Fingerprint**:
   - Place finger on the device scanner

3. **Expected Behavior**:
   - ❌ **Red light** or denial indicator on device
   - ❌ **Door does NOT unlock**
   - ⚠️ **Attempt logged** (optional)

---

## How It Works

### Access Control Logic

The software checks the following conditions when a fingerprint is scanned:

1. **Member Status**: Must be "active"
2. **Date Range**: Current date must be within:
   - Start Date ≤ Today ≤ Expiry Date
3. **Payment Status**: Must NOT be "pending" or "overdue"
4. **All conditions met**: Door unlocks, attendance recorded
5. **Any condition fails**: Access denied, door remains locked

### Attendance Recording

- Each successful scan automatically creates an attendance record
- Records include:
  - Member ID
  - Check-in time (timestamp)
  - Marked via: "biometric"
  - Location (if GPS enabled)

### Door Unlock

- When access is granted:
  - Software sends unlock command to device
  - Device activates relay for specified duration (e.g., 3 seconds)
  - Door unlocks automatically
  - Door locks again after duration expires

---

## Troubleshooting

### Connection Issues

**Problem**: "Connection failed" or "Could not connect to device"

**Solutions**:
1. ✅ Verify device IP address is correct
2. ✅ Ensure device and PC are on the same network
3. ✅ Check if port 4370 is open (firewall settings)
4. ✅ Ping device from PC: `ping 192.168.1.100` (use your device IP)
5. ✅ Verify device is powered on and network cable is connected
6. ✅ Check Comm Key is correct (try 0 if not set)

### Fingerprint Not Recognized

**Problem**: Device doesn't recognize fingerprint even though enrolled

**Solutions**:
1. ✅ Verify member is linked to correct User ID
2. ✅ Re-enroll fingerprint on device if quality is poor
3. ✅ Check if member's biometric ID matches device User ID
4. ✅ Try scanning with a different finger

### Door Not Unlocking

**Problem**: Access granted but door doesn't unlock

**Solutions**:
1. ✅ Verify relay wiring is correct (NO vs NC)
2. ✅ Check relay type setting in software matches device wiring
3. ✅ Test relay manually using device menu
4. ✅ Verify unlock duration is set (minimum 1 second)
5. ✅ Check if door strike/lock is functioning

### Attendance Not Recording

**Problem**: Scan successful but no attendance record created

**Solutions**:
1. ✅ Verify software is running and connected
2. ✅ Check database connection
3. ✅ Verify member is properly linked (biometric ID exists)
4. ✅ Check server logs for errors
5. ✅ Ensure background service is running (if using polling mode)

### Wrong Member Recognized

**Problem**: Device recognizes wrong member

**Solutions**:
1. ✅ Verify biometric ID mapping is correct
2. ✅ Check if multiple members share same User ID (should be unique)
3. ✅ Re-link member to correct User ID
4. ✅ Consider re-enrolling fingerprint on device

---

## TeamViewer Session Checklist

Use this checklist during your TeamViewer session:

### Before Session
- [ ] Device is powered on and connected to network
- [ ] PC is on the same network as device
- [ ] Gym Admin Dashboard software is installed and running
- [ ] Have device IP address ready

### During Session
- [ ] Configure device IP/Port in Settings
- [ ] Test connection successfully
- [ ] Save biometric settings
- [ ] Link at least one test member
- [ ] Test scan with active member (should unlock)
- [ ] Test scan with expired member (should deny)
- [ ] Verify attendance records are created
- [ ] Verify door unlock works (if relay is wired)

### After Session
- [ ] Link all remaining members
- [ ] Document any custom settings
- [ ] Test with multiple members
- [ ] Verify all features working

---

## Quick Reference

### Device Menu Navigation
- **IP Address**: Menu → Comm/Network → TCP/IP
- **Device ID**: Menu → System → Device Info
- **Comm Key**: Menu → Comm → Comm Key
- **Date/Time**: Menu → System → Date/Time
- **Door Settings**: Menu → Access Control → Door Settings

### Software Settings Location
- **Settings Page**: Sidebar → Settings → Biometric Device Settings

### Member Linking
- **Link Biometric**: Members → View Member → Link Biometric

### Access Rules
- ✅ Status = "active"
- ✅ Start Date ≤ Today ≤ Expiry Date
- ✅ Payment Status ≠ "pending" or "overdue"

---

## Support

If you encounter issues not covered in this guide:

1. Check server logs for error messages
2. Verify all network settings are correct
3. Test device connectivity using ping
4. Review device firmware version (should show Push Service)
5. Contact support with:
   - Device IP address
   - Error messages
   - Screenshots of settings
   - Device firmware version

---

**Last Updated**: 2025-01-27
**Device Model**: eSSL K30 Pro
**Software Version**: Gym Admin Dashboard

