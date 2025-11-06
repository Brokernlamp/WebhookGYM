import { getTursoDb } from "./db-turso";
import { getLocalDb } from "./db-local";
import { storage } from "./storage";

let isSyncing = false;
let lastSyncTimestamp: Record<string, number> = {};
let syncInterval: NodeJS.Timeout | null = null;
let backgroundSyncEnabled = false;

// Sync a single table row to Turso
async function syncRowToTurso(
  turso: ReturnType<typeof getTursoDb>,
  table: string,
  row: any
): Promise<void> {
  try {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => "?").join(",");
    
    // Check if row exists
    const check = await turso.execute({ 
      sql: `SELECT id FROM ${table} WHERE id = ?`, 
      args: [row.id] 
    });
    
    if ((check.rows as any[]).length > 0) {
      // Update existing
      const updates = cols.filter(c => c !== "id").map(c => `${c} = ?`).join(",");
      const values = cols.map(c => row[c]);
      await turso.execute({ 
        sql: `UPDATE ${table} SET ${updates} WHERE id = ?`, 
        args: [...values, row.id] 
      });
    } else {
      // Insert new
      await turso.execute({ 
        sql: `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`, 
        args: cols.map((c) => row[c]) 
      });
    }
  } catch (error) {
    console.error(`Failed to sync ${table} row ${row.id} to Turso:`, error);
    throw error;
  }
}

// Sync a single table row from Turso to local
async function syncRowFromTurso(
  local: ReturnType<typeof getLocalDb>,
  table: string,
  row: any
): Promise<void> {
  try {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => "?").join(",");
    
    // Check if row exists
    const check = await local.execute({ 
      sql: `SELECT id FROM ${table} WHERE id = ?`, 
      args: [row.id] 
    });
    
    if ((check.rows as any[]).length > 0) {
      // Update existing
      const updates = cols.filter(c => c !== "id").map(c => `${c} = ?`).join(",");
      const values = cols.map(c => row[c]);
      await local.execute({ 
        sql: `UPDATE ${table} SET ${updates} WHERE id = ?`, 
        args: [...values, row.id] 
      });
    } else {
      // Insert new
      await local.execute({ 
        sql: `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`, 
        args: cols.map((c) => row[c]) 
      });
    }
  } catch (error) {
    console.error(`Failed to sync ${table} row ${row.id} from Turso:`, error);
    throw error;
  }
}

// Sync a single record from local to Turso (called after local changes)
export async function syncToTurso(table: string, recordId: string): Promise<void> {
  if (isSyncing) return; // Prevent sync loops
  
  const desktop = process.env.DESKTOP === "1" || process.env.ELECTRON === "1";
  if (!desktop) return; // Only sync in desktop mode
  
  try {
    // Get credentials from settings
    const settings = await storage.getSettings();
    const tursoUrl = settings.tursoDatabaseUrl || process.env.TURSO_DATABASE_URL?.trim();
    const tursoToken = settings.tursoAuthToken || process.env.TURSO_AUTH_TOKEN?.trim();
    
    if (!tursoUrl || !tursoToken) {
      return; // No credentials configured, skip sync
    }
    
    const turso = getTursoDb(tursoUrl, tursoToken);
    const local = getLocalDb();
    
    // Get the record from local
    const result = await local.execute({ 
      sql: `SELECT * FROM ${table} WHERE id = ?`, 
      args: [recordId] 
    });
    
    if ((result.rows as any[]).length === 0) {
      // Record deleted, sync deletion to Turso
      await turso.execute({ 
        sql: `DELETE FROM ${table} WHERE id = ?`, 
        args: [recordId] 
      });
    } else {
      // Sync the record
      await syncRowToTurso(turso, table, result.rows[0]);
    }
    
    console.log(`✅ Auto-synced ${table}:${recordId} to Turso`);
  } catch (error) {
    console.error(`❌ Auto-sync to Turso failed for ${table}:${recordId}:`, error);
    // Don't throw - sync failures shouldn't break the app
  }
}

// Background sync: Check Turso for changes and sync to local
async function backgroundSyncFromTurso(): Promise<void> {
  if (isSyncing) return;
  
  const desktop = process.env.DESKTOP === "1" || process.env.ELECTRON === "1";
  if (!desktop) return;
  
  try {
    isSyncing = true;
    
    // Get credentials from settings
    const settings = await storage.getSettings();
    const tursoUrl = settings.tursoDatabaseUrl || process.env.TURSO_DATABASE_URL?.trim();
    const tursoToken = settings.tursoAuthToken || process.env.TURSO_AUTH_TOKEN?.trim();
    
    if (!tursoUrl || !tursoToken) {
      return; // No credentials configured, skip sync
    }
    
    const turso = getTursoDb(tursoUrl, tursoToken);
    const local = getLocalDb();
    
    const tables = ["members", "payments", "attendance", "plans", "trainers", "equipment", "classes"];
    
    for (const table of tables) {
      try {
        // Get all records from Turso
        const tursoResult = await turso.execute({ sql: `SELECT * FROM ${table}`, args: [] });
        const tursoRows = tursoResult.rows as any[];
        
        // Get all records from local
        const localResult = await local.execute({ sql: `SELECT * FROM ${table}`, args: [] });
        const localRows = localResult.rows as any[];
        
        // Create maps for comparison
        const tursoMap = new Map(tursoRows.map((r: any) => [r.id, r]));
        const localMap = new Map(localRows.map((r: any) => [r.id, r]));
        
        // Find new/updated records in Turso
        for (const [id, tursoRow] of tursoMap.entries()) {
          const localRow = localMap.get(id);
          
          // Check if Turso row is newer (simple comparison - if different, Turso wins)
          if (!localRow || JSON.stringify(localRow) !== JSON.stringify(tursoRow)) {
            await syncRowFromTurso(local, table, tursoRow);
          }
        }
        
        // Find deleted records (in local but not in Turso)
        for (const [id, localRow] of localMap.entries()) {
          if (!tursoMap.has(id)) {
            // Record exists in local but not in Turso - keep it (local wins)
            // Or delete it if you want Turso to be source of truth
            // For now, we keep local-only records
          }
        }
        
        lastSyncTimestamp[table] = Date.now();
      } catch (error) {
        console.error(`Failed to background sync table ${table}:`, error);
      }
    }
    
    console.log("✅ Background sync from Turso completed");
  } catch (error) {
    console.error("❌ Background sync from Turso failed:", error);
  } finally {
    isSyncing = false;
  }
}

// Start background sync service (polls Turso every 5 seconds)
export function startBackgroundSync(): void {
  const desktop = process.env.DESKTOP === "1" || process.env.ELECTRON === "1";
  if (!desktop) return;
  
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  backgroundSyncEnabled = true;
  
  // Initial sync
  backgroundSyncFromTurso().catch(console.error);
  
  // Then sync every 5 seconds
  syncInterval = setInterval(() => {
    if (backgroundSyncEnabled) {
      backgroundSyncFromTurso().catch(console.error);
    }
  }, 5000);
  
  console.log("🔄 Background sync service started (every 5 seconds)");
}

// Stop background sync service
export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  backgroundSyncEnabled = false;
  console.log("⏹️ Background sync service stopped");
}

