import net from "net";
import { storage } from "./storage";

interface BiometricSettings {
  ip: string;
  port: string;
  commKey: string;
  unlockSeconds: string;
  relayType: string;
}

interface DeviceUser {
  userId: string;
  name: string;
}

interface AttendanceLog {
  userId: string;
  timestamp: Date;
  status: number; // 0 = Check-in, 1 = Check-out (if supported)
  verifyMode: number; // 0 = Fingerprint, etc.
}

let deviceConnection: net.Socket | null = null;
let isPolling = false;
let pollingInterval: NodeJS.Timeout | null = null;
let lastLogTime: Date | null = null;

// eSSL Protocol Constants
const CMD_CONNECT = 0x10000001;
const CMD_GET_USER = 0x00000005;
const CMD_GET_ATTENDANCE_LOG = 0x0000000D;
const CMD_RELAY_CONTROL = 0x00140000;

// Helper: Convert number to 4-byte little-endian buffer
function intToBuffer(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

// Helper: Calculate checksum (simple XOR for eSSL)
function calculateChecksum(data: Buffer): number {
  let checksum = 0;
  for (let i = 0; i < data.length; i++) {
    checksum ^= data[i];
  }
  return checksum;
}

// Build eSSL command packet
function buildCommand(command: number, data: Buffer = Buffer.alloc(0), commKey: number = 0): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(command, 0);
  header.writeUInt32LE(commKey, 4);
  
  const packet = Buffer.concat([header, data]);
  const checksum = calculateChecksum(packet);
  
  const fullPacket = Buffer.concat([
    Buffer.from([0x55, 0xAA]), // Start marker
    packet,
    Buffer.from([checksum]),
    Buffer.from([0x00, 0x00]) // End marker
  ]);
  
  return fullPacket;
}

// Parse eSSL response packet
function parseResponse(buffer: Buffer): { command: number; data: Buffer; success: boolean } | null {
  if (buffer.length < 12) return null;
  
  // Check start marker
  if (buffer[0] !== 0x55 || buffer[1] !== 0xAA) return null;
  
  const command = buffer.readUInt32LE(2);
  const commKey = buffer.readUInt32LE(6);
  const dataLength = buffer.length - 12; // Header + checksum + markers
  const data = buffer.slice(10, 10 + dataLength);
  
  // Verify checksum
  const packet = buffer.slice(2, buffer.length - 3);
  const checksum = calculateChecksum(packet);
  const receivedChecksum = buffer[buffer.length - 3];
  
  return {
    command,
    data,
    success: checksum === receivedChecksum
  };
}

// Connect to eSSL device
async function connectToDevice(settings: BiometricSettings): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (deviceConnection) {
        deviceConnection.destroy();
      }
      
      const socket = new net.Socket();
      const port = parseInt(settings.port || "4370", 10);
      const commKey = parseInt(settings.commKey || "0", 10);
      
      socket.setTimeout(5000); // 5 second timeout
      
      socket.on("connect", () => {
        console.log(`✅ Connected to eSSL device at ${settings.ip}:${port}`);
        deviceConnection = socket;
        
        // Send connect command
        const connectCmd = buildCommand(CMD_CONNECT, Buffer.alloc(0), commKey);
        socket.write(connectCmd);
        
        resolve(true);
      });
      
      socket.on("data", (data: Buffer) => {
        const response = parseResponse(data);
        if (response && response.success) {
          console.log(`📥 Received response: command=${response.command.toString(16)}`);
        }
      });
      
      socket.on("error", (err) => {
        console.error(`❌ Device connection error: ${err.message}`);
        resolve(false);
      });
      
      socket.on("timeout", () => {
        console.error("❌ Device connection timeout");
        socket.destroy();
        resolve(false);
      });
      
      socket.on("close", () => {
        console.log("🔌 Device connection closed");
        deviceConnection = null;
      });
      
      socket.connect(port, settings.ip);
      
      // Resolve after timeout if connection pending
      setTimeout(() => {
        if (!deviceConnection) {
          resolve(false);
        }
      }, 3000);
    } catch (error) {
      console.error("❌ Failed to connect to device:", error);
      resolve(false);
    }
  });
}

// Get users from device
export async function getDeviceUsers(settings: BiometricSettings): Promise<DeviceUser[]> {
  return new Promise((resolve) => {
    if (!deviceConnection || deviceConnection.destroyed) {
      resolve([]);
      return;
    }
    
    const commKey = parseInt(settings.commKey || "0", 10);
    const cmd = buildCommand(CMD_GET_USER, Buffer.alloc(0), commKey);
    
    const timeout = setTimeout(() => {
      resolve([]);
    }, 5000);
    
    const dataHandler = (data: Buffer) => {
      const response = parseResponse(data);
      if (response && response.command === CMD_GET_USER && response.success) {
        // Parse user data (format depends on device)
        const users: DeviceUser[] = [];
        // TODO: Parse actual user data from response.data
        // This requires knowing the exact eSSL data format
        clearTimeout(timeout);
        deviceConnection?.removeListener("data", dataHandler);
        resolve(users);
      }
    };
    
    deviceConnection.on("data", dataHandler);
    deviceConnection.write(cmd);
  });
}

// Get attendance logs from device
async function getAttendanceLogs(settings: BiometricSettings): Promise<AttendanceLog[]> {
  return new Promise((resolve) => {
    if (!deviceConnection || deviceConnection.destroyed) {
      resolve([]);
      return;
    }
    
    const commKey = parseInt(settings.commKey || "0", 10);
    const cmd = buildCommand(CMD_GET_ATTENDANCE_LOG, Buffer.alloc(0), commKey);
    
    const timeout = setTimeout(() => {
      resolve([]);
    }, 5000);
    
    const logs: AttendanceLog[] = [];
    let buffer = Buffer.alloc(0);
    
    const dataHandler = (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      
      // Try to parse logs from buffer
      // eSSL log format: timestamp (4 bytes) + user_id (2 bytes) + status + verify_mode
      while (buffer.length >= 8) {
        try {
          const timestamp = buffer.readUInt32LE(0);
          const userId = buffer.readUInt16LE(4);
          const status = buffer[6];
          const verifyMode = buffer[7];
          
          logs.push({
            userId: userId.toString(),
            timestamp: new Date(timestamp * 1000), // Convert Unix timestamp
            status,
            verifyMode
          });
          
          buffer = buffer.slice(8);
        } catch (e) {
          break;
        }
      }
      
      // If we got a response, process it
      const response = parseResponse(buffer);
      if (response && response.command === CMD_GET_ATTENDANCE_LOG) {
        clearTimeout(timeout);
        deviceConnection?.removeListener("data", dataHandler);
        resolve(logs);
      }
    };
    
    deviceConnection.on("data", dataHandler);
    deviceConnection.write(cmd);
  });
}

// Send door unlock command
async function unlockDoor(settings: BiometricSettings, durationSeconds: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!deviceConnection || deviceConnection.destroyed) {
      resolve(false);
      return;
    }
    
    const commKey = parseInt(settings.commKey || "0", 10);
    const relayNum = 1; // Usually relay 1
    const duration = durationSeconds;
    
    // Build relay control command
    const data = Buffer.alloc(2);
    data.writeUInt8(relayNum, 0);
    data.writeUInt8(duration, 1);
    
    const cmd = buildCommand(CMD_RELAY_CONTROL, data, commKey);
    
    const timeout = setTimeout(() => {
      resolve(false);
    }, 2000);
    
    const dataHandler = (data: Buffer) => {
      const response = parseResponse(data);
      if (response && response.command === CMD_RELAY_CONTROL) {
        clearTimeout(timeout);
        deviceConnection?.removeListener("data", dataHandler);
        resolve(response.success);
      }
    };
    
    deviceConnection.on("data", dataHandler);
    deviceConnection.write(cmd);
  });
}

// Public helper to trigger a brief relay pulse (e.g., for test-connection)
export async function pulseRelay(settings: BiometricSettings, seconds: number = 1): Promise<boolean> {
  return await unlockDoor(settings, seconds);
}

// Process a scan event
export async function processScan(biometricId: string, settings: BiometricSettings): Promise<void> {
  try {
    // Find member by biometric ID
    const allMembers = await storage.listMembers();
    const member = allMembers.find((m: any) => (m as any).biometricId === biometricId || (m as any).biometricId == biometricId);
    
    if (!member) {
      console.log(`⚠️ Biometric scan from unknown user: ${biometricId}`);
      return;
    }
    
    // Check access control (same logic as simulate-scan)
    const now = new Date();
    const startOk = !member.startDate || new Date(member.startDate) <= now;
    const endOk = !member.expiryDate || new Date(member.expiryDate) >= now;
    const statusOk = member.status === "active";
    const paymentOk = member.paymentStatus !== "overdue" && member.paymentStatus !== "pending";
    const allowed = statusOk && startOk && endOk && paymentOk;
    
    if (allowed) {
      // Record attendance
      await storage.createAttendance({
        memberId: member.id,
        checkInTime: now,
        checkOutTime: null,
        latitude: null as any,
        longitude: null as any,
        markedVia: "biometric",
      } as any);
      
      // Unlock door
      const unlockSeconds = parseInt(settings.unlockSeconds || "3", 10);
      await unlockDoor(settings, unlockSeconds);
      
      console.log(`✅ Access granted: ${member.name} (${biometricId})`);
    } else {
      console.log(`❌ Access denied: ${member.name} (${biometricId})`);
      // Could optionally log denied attempts
    }
  } catch (error) {
    console.error(`❌ Error processing scan for ${biometricId}:`, error);
  }
}

// Poll device for new attendance logs
async function pollDeviceForScans(): Promise<void> {
  if (isPolling) return;
  
  try {
    isPolling = true;
    
    const settings = await storage.getSettings();
    const ip = settings.biometricIp;
    const port = settings.biometricPort || "4370";
    const commKey = settings.biometricCommKey || "0";
    
    if (!ip) {
      isPolling = false;
      return;
    }
    
    // Ensure connected
    if (!deviceConnection || deviceConnection.destroyed) {
      const connected = await connectToDevice({
        ip,
        port,
        commKey,
        unlockSeconds: settings.biometricUnlockSeconds || "3",
        relayType: settings.biometricRelayType || "NO"
      });
      
      if (!connected) {
        isPolling = false;
        return;
      }
    }
    
    // Get new logs
    const logs = await getAttendanceLogs({
      ip,
      port,
      commKey,
      unlockSeconds: settings.biometricUnlockSeconds || "3",
      relayType: settings.biometricRelayType || "NO"
    });
    
    // Process new logs
    for (const log of logs) {
      // Only process logs newer than last processed
      if (!lastLogTime || log.timestamp > lastLogTime) {
        await processScan(log.userId, {
          ip,
          port,
          commKey,
          unlockSeconds: settings.biometricUnlockSeconds || "3",
          relayType: settings.biometricRelayType || "NO"
        });
        
        if (!lastLogTime || log.timestamp > lastLogTime) {
          lastLogTime = log.timestamp;
        }
      }
    }
  } catch (error) {
    console.error("❌ Error polling device:", error);
  } finally {
    isPolling = false;
  }
}

// Start polling device for scans
export function startBiometricDevicePolling(): void {
  const desktop = process.env.DESKTOP === "1" || process.env.ELECTRON === "1";
  if (!desktop) return;
  
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  // Initial poll
  pollDeviceForScans().catch(console.error);
  
  // Poll every 1 second
  pollingInterval = setInterval(() => {
    pollDeviceForScans().catch(console.error);
  }, 1000);
  
  console.log("🔄 Biometric device polling started (every 1 second)");
}

// Stop polling
export function stopBiometricDevicePolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  if (deviceConnection) {
    deviceConnection.destroy();
    deviceConnection = null;
  }
  
  console.log("⏹️ Biometric device polling stopped");
}

// Test connection to device
export async function testDeviceConnection(settings: BiometricSettings): Promise<boolean> {
  return await connectToDevice(settings);
}

