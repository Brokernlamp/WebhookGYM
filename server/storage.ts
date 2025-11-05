import {
  type User,
  type InsertUser,
  type Member,
  type InsertMember,
  type Payment,
  type InsertPayment,
  type Equipment,
  type InsertEquipment,
  type Attendance,
  type InsertAttendance,
  type Plan,
  type InsertPlan,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { getDb } from "./db-factory";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // members
  listMembers(): Promise<Member[]>;
  getMember(id: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: string, member: Partial<InsertMember>): Promise<Member | undefined>;
  deleteMember(id: string): Promise<boolean>;

  // payments
  listPayments(): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<boolean>;

  // equipment
  listEquipment(): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: string): Promise<boolean>;

  // attendance
  listAttendance(): Promise<Attendance[]>;
  createAttendance(record: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, record: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  deleteAttendance(id: string): Promise<boolean>;

  // settings
  getSettings(): Promise<Record<string, any>>;
  updateSettings(settings: Record<string, any>): Promise<Record<string, any>>;
  getMemberByLoginCode(loginCode: string): Promise<Member | undefined>;

  // plans
  listPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, plan: Partial<InsertPlan>): Promise<Plan | undefined>;
  deletePlan(id: string): Promise<boolean>;
}

export class TursoStorage implements IStorage {
  private db = getDb();

  private mapMember(row: any): Member {
    // Handle both snake_case (DB) and camelCase (already mapped) formats
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      photoUrl: row.photo_url ?? row.photoUrl ?? null,
      loginCode: row.login_code ?? row.loginCode,
      planId: row.plan_id ?? row.planId ?? null,
      planName: row.plan_name ?? row.planName ?? null,
      startDate: row.start_date ?? row.startDate ?? null,
      expiryDate: row.expiry_date ?? row.expiryDate ?? null,
      status: row.status,
      paymentStatus: row.payment_status ?? row.paymentStatus,
      lastCheckIn: row.last_check_in ?? row.lastCheckIn ?? null,
      emergencyContact: row.emergency_contact ?? row.emergencyContact ?? null,
      trainerId: row.trainer_id ?? row.trainerId ?? null,
      notes: row.notes ?? null,
      gender: row.gender ?? null,
      age: row.age ?? null,
    } as any;
  }

  private mapPayment(row: any): Payment {
    return {
      id: row.id,
      memberId: row.member_id,
      amount: row.amount,
      paymentMethod: row.payment_method,
      status: row.status,
      dueDate: row.due_date ?? null,
      paidDate: row.paid_date ?? null,
      planName: row.plan_name ?? null,
    } as any;
  }

  private mapAttendance(row: any): Attendance {
    return {
      id: row.id,
      memberId: row.member_id,
      checkInTime: row.check_in_time,
      checkOutTime: row.check_out_time ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      markedVia: row.marked_via,
    } as any;
  }

  private mapEquipment(row: any): Equipment {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      purchaseDate: row.purchase_date ?? null,
      warrantyExpiry: row.warranty_expiry ?? null,
      lastMaintenance: row.last_maintenance ?? null,
      nextMaintenance: row.next_maintenance ?? null,
      status: row.status,
    } as any;
  }

  async getUser(id: string): Promise<User | undefined> {
    const r = await this.db.execute({ sql: `SELECT id, username, password FROM users WHERE id = ?`, args: [id] });
    return r.rows[0] as any;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const r = await this.db.execute({ sql: `SELECT id, username, password FROM users WHERE username = ?`, args: [username] });
    return r.rows[0] as any;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    await this.db.execute({ sql: `INSERT INTO users (id, username, password) VALUES (?, ?, ?)`, args: [id, user.username, user.password] });
    return { id, username: user.username, password: user.password } as any;
  }

  async listMembers(): Promise<Member[]> {
    try {
      console.log("listMembers: executing query");
      const r = await this.db.execute(`SELECT * FROM members ORDER BY name`);
      console.log("listMembers: got rows", r.rows.length);
      const mapped = (r.rows as unknown[]).map((x: any) => {
        try {
          return this.mapMember(x);
        } catch (e) {
          console.error("Error mapping member row:", x, e);
          throw e;
        }
      });
      console.log("listMembers: mapped successfully", mapped.length);
      return mapped as any;
    } catch (error) {
      console.error("listMembers error:", error);
      throw error;
    }
  }

  async getMember(id: string): Promise<Member | undefined> {
    const r = await this.db.execute({ sql: `SELECT * FROM members WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    return row ? this.mapMember(row) : undefined;
  }

  async createMember(member: InsertMember): Promise<Member> {
    try {
      // Generate readable member ID: member_001, member_002, etc.
      let id = "member_001";
      try {
        const maxIdResult = await this.db.execute({
          sql: `SELECT MAX(CAST(SUBSTR(id, 8) AS INTEGER)) as max_num FROM members WHERE id LIKE 'member_%'`,
        });
        const maxNum = maxIdResult.rows[0]?.max_num ? Number(maxIdResult.rows[0].max_num) : 0;
        id = `member_${String(maxNum + 1).padStart(3, '0')}`;
      } catch {
        // If parsing fails, count total members and add 1
        try {
          const countResult = await this.db.execute({
            sql: `SELECT COUNT(*) as total FROM members WHERE id LIKE 'member_%'`,
          });
          const total = countResult.rows[0]?.total ? Number(countResult.rows[0].total) : 0;
          id = `member_${String(total + 1).padStart(3, '0')}`;
        } catch {
          // Fallback: use timestamp-based ID
          id = `member_${Date.now().toString().slice(-6)}`;
        }
      }
      
      console.log("Creating member:", id, member.name);
      const result = await this.db.execute({
        sql: `INSERT INTO members (
          id, name, email, phone, photo_url, login_code, plan_id, plan_name,
          start_date, expiry_date, status, payment_status, last_check_in,
          emergency_contact, trainer_id, notes, gender, age
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          member.name,
          member.email,
          member.phone,
          (member as any).photoUrl ?? null,
          member.loginCode,
          (member as any).planId ?? null,
          (member as any).planName ?? null,
          (member as any).startDate ?? null,
          (member as any).expiryDate ?? null,
          member.status,
          (member as any).paymentStatus,
          (member as any).lastCheckIn ?? null,
          (member as any).emergencyContact ?? null,
          (member as any).trainerId ?? null,
          (member as any).notes ?? null,
          (member as any).gender ?? null,
          (member as any).age ?? null,
        ],
      });
      console.log("Member inserted, rowsAffected:", result.rowsAffected);
      const created = await this.getMember(id);
      if (!created) throw new Error("Failed to retrieve created member");
      return created as Member;
    } catch (error) {
      console.error("createMember error:", error);
      throw error;
    }
  }

  async updateMember(id: string, member: Partial<InsertMember>): Promise<Member | undefined> {
    const current = await this.getMember(id);
    if (!current) return undefined;
    const updated = { ...current, ...member } as any;
    await this.db.execute({
      sql: `UPDATE members SET name=?, email=?, phone=?, photo_url=?, login_code=?, plan_id=?, plan_name=?, start_date=?, expiry_date=?, status=?, payment_status=?, last_check_in=?, emergency_contact=?, trainer_id=?, notes=?, gender=?, age=? WHERE id=?`,
      args: [
        updated.name,
        updated.email,
        updated.phone,
        updated.photoUrl ?? null,
        updated.loginCode,
        updated.planId ?? null,
        updated.planName ?? null,
        updated.startDate ?? null,
        updated.expiryDate ?? null,
        updated.status,
        updated.paymentStatus,
        updated.lastCheckIn ?? null,
        updated.emergencyContact ?? null,
        updated.trainerId ?? null,
        updated.notes ?? null,
        updated.gender ?? null,
        updated.age ?? null,
        id,
      ],
    });
    return await this.getMember(id);
  }

  async deleteMember(id: string): Promise<boolean> {
    const r = await this.db.execute({ sql: `DELETE FROM members WHERE id = ?`, args: [id] });
    return (r.rowsAffected ?? 0) > 0;
  }

  async listPayments(): Promise<Payment[]> {
    const r = await this.db.execute(`SELECT * FROM payments ORDER BY COALESCE(paid_date, due_date) DESC`);
    return (r.rows as unknown[]).map((x: any) => this.mapPayment(x)) as any;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    await this.db.execute({
      sql: `INSERT INTO payments (id, member_id, amount, payment_method, status, due_date, paid_date, plan_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        payment.memberId,
        String((payment as any).amount ?? "0"),
        (payment as any).paymentMethod,
        (payment as any).status,
        (payment as any).dueDate ?? null,
        (payment as any).paidDate ?? null,
        (payment as any).planName ?? null,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM payments WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    if (!row) {
      return {
        id,
        memberId: payment.memberId,
        amount: String((payment as any).amount ?? "0"),
        paymentMethod: (payment as any).paymentMethod,
        status: (payment as any).status,
        dueDate: (payment as any).dueDate ?? null,
        paidDate: (payment as any).paidDate ?? null,
        planName: (payment as any).planName ?? null,
      } as any;
    }
    return this.mapPayment(row) as any;
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const current = await this.db.execute({ sql: `SELECT * FROM payments WHERE id = ?`, args: [id] });
    const cur = current.rows[0] as any;
    if (!cur) return undefined;
    const updated = { ...cur, ...payment } as any;
    await this.db.execute({
      sql: `UPDATE payments SET member_id=?, amount=?, payment_method=?, status=?, due_date=?, paid_date=?, plan_name=? WHERE id=?`,
      args: [
        updated.memberId,
        String(updated.amount ?? "0"),
        updated.paymentMethod,
        updated.status,
        updated.dueDate ?? null,
        updated.paidDate ?? null,
        updated.planName ?? null,
        id,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM payments WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    return row ? this.mapPayment(row) as any : undefined;
  }

  async deletePayment(id: string): Promise<boolean> {
    const r = await this.db.execute({ sql: `DELETE FROM payments WHERE id = ?`, args: [id] });
    return (r.rowsAffected ?? 0) > 0;
  }

  async listEquipment(): Promise<Equipment[]> {
    const r = await this.db.execute(`SELECT * FROM equipment ORDER BY name`);
    return (r.rows as unknown[]).map((x: any) => this.mapEquipment(x)) as any;
  }

  async createEquipment(equipment: InsertEquipment): Promise<Equipment> {
    const id = randomUUID();
    await this.db.execute({
      sql: `INSERT INTO equipment (id, name, category, purchase_date, warranty_expiry, last_maintenance, next_maintenance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        equipment.name,
        (equipment as any).category,
        (equipment as any).purchaseDate ?? null,
        (equipment as any).warrantyExpiry ?? null,
        (equipment as any).lastMaintenance ?? null,
        (equipment as any).nextMaintenance ?? null,
        (equipment as any).status,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM equipment WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    if (!row) {
      return {
        id,
        name: equipment.name,
        category: (equipment as any).category,
        purchaseDate: (equipment as any).purchaseDate ?? null,
        warrantyExpiry: (equipment as any).warrantyExpiry ?? null,
        lastMaintenance: (equipment as any).lastMaintenance ?? null,
        nextMaintenance: (equipment as any).nextMaintenance ?? null,
        status: (equipment as any).status,
      } as any;
    }
    return this.mapEquipment(row) as any;
  }

  async updateEquipment(id: string, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const current = await this.db.execute({ sql: `SELECT * FROM equipment WHERE id = ?`, args: [id] });
    const cur = current.rows[0] as any;
    if (!cur) return undefined;
    // Map DB row (snake_case) to camelCase before merging to avoid losing fields
    const curMapped = this.mapEquipment(cur) as any;
    const updated = { ...curMapped, ...equipment } as any;
    await this.db.execute({
      sql: `UPDATE equipment SET name=?, category=?, purchase_date=?, warranty_expiry=?, last_maintenance=?, next_maintenance=?, status=? WHERE id=?`,
      args: [
        updated.name,
        updated.category,
        updated.purchaseDate ?? null,
        updated.warrantyExpiry ?? null,
        updated.lastMaintenance ?? null,
        updated.nextMaintenance ?? null,
        updated.status,
        id,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM equipment WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    return row ? this.mapEquipment(row) as any : undefined;
  }

  async deleteEquipment(id: string): Promise<boolean> {
    const r = await this.db.execute({ sql: `DELETE FROM equipment WHERE id = ?`, args: [id] });
    return (r.rowsAffected ?? 0) > 0;
  }

  async listAttendance(): Promise<Attendance[]> {
    const r = await this.db.execute(`SELECT * FROM attendance ORDER BY COALESCE(check_out_time, check_in_time) DESC`);
    return (r.rows as unknown[]).map((x: any) => this.mapAttendance(x)) as any;
  }

  async createAttendance(record: InsertAttendance): Promise<Attendance> {
    const id = randomUUID();
    await this.db.execute({
      sql: `INSERT INTO attendance (id, member_id, check_in_time, check_out_time, latitude, longitude, marked_via) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        record.memberId,
        (record as any).checkInTime ?? new Date().toISOString(),
        (record as any).checkOutTime ?? null,
        (record as any).latitude ?? null,
        (record as any).longitude ?? null,
        (record as any).markedVia ?? "manual",
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM attendance WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    if (!row) {
      return {
        id,
        memberId: record.memberId,
        checkInTime: (record as any).checkInTime ?? new Date().toISOString(),
        checkOutTime: (record as any).checkOutTime ?? null,
        latitude: (record as any).latitude ?? null,
        longitude: (record as any).longitude ?? null,
        markedVia: (record as any).markedVia ?? "manual",
      } as any;
    }
    return this.mapAttendance(row) as any;
  }

  async updateAttendance(id: string, record: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const current = await this.db.execute({ sql: `SELECT * FROM attendance WHERE id = ?`, args: [id] });
    const cur = current.rows[0] as any;
    if (!cur) return undefined;
    const updated = { ...cur, ...record } as any;
    await this.db.execute({
      sql: `UPDATE attendance SET member_id=?, check_in_time=?, check_out_time=?, latitude=?, longitude=?, marked_via=? WHERE id=?`,
      args: [
        updated.memberId,
        updated.checkInTime ?? cur.check_in_time,
        updated.checkOutTime ?? null,
        updated.latitude ?? null,
        updated.longitude ?? null,
        updated.markedVia ?? cur.marked_via,
        id,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM attendance WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    return row ? this.mapAttendance(row) as any : undefined;
  }

  async deleteAttendance(id: string): Promise<boolean> {
    const r = await this.db.execute({ sql: `DELETE FROM attendance WHERE id = ?`, args: [id] });
    return (r.rowsAffected ?? 0) > 0;
  }

  // Settings - simple key-value storage
  async getSettings(): Promise<Record<string, any>> {
    try {
      // Check if settings table exists, if not create it
      await this.db.execute({
        sql: `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`,
      });
      
      const result = await this.db.execute({ sql: `SELECT key, value FROM settings` });
      const settings: Record<string, any> = {};
      
      for (const row of result.rows as any[]) {
        const key = row.key;
        let value = row.value;
        // Try to parse JSON, otherwise use as string
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string
        }
        settings[key] = value;
      }
      
      return settings;
    } catch (err) {
      console.error("Error getting settings:", err);
      return {};
    }
  }

  async updateSettings(newSettings: Record<string, any>): Promise<Record<string, any>> {
    try {
      await this.db.execute({
        sql: `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`,
      });

      // Update or insert each setting
      for (const [key, value] of Object.entries(newSettings)) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await this.db.execute({
          sql: `INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          args: [key, valueStr],
        });
      }

      return await this.getSettings();
    } catch (err) {
      console.error("Error updating settings:", err);
      throw err;
    }
  }

  async getMemberByLoginCode(loginCode: string): Promise<Member | undefined> {
    const result = await this.db.execute({
      sql: `SELECT * FROM members WHERE login_code = ?`,
      args: [loginCode],
    });
    const row = result.rows[0];
    return row ? (this.mapMember(row) as any) : undefined;
  }

  // Plans CRUD
  async listPlans(): Promise<Plan[]> {
    try {
      const result = await this.db.execute({
        sql: `SELECT * FROM plans ORDER BY name`,
      });
      return result.rows.map((row: any) => this.mapPlan(row)) as Plan[];
    } catch (error) {
      console.error("listPlans error:", error);
      return [];
    }
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    const result = await this.db.execute({
      sql: `SELECT * FROM plans WHERE id = ?`,
      args: [id],
    });
    const row = result.rows[0];
    return row ? (this.mapPlan(row) as any) : undefined;
  }

  private mapPlan(row: any): Plan {
    return {
      id: row.id,
      name: row.name,
      duration: Number(row.duration || 0),
      price: String(row.price || "0"),
      features: row.features ? (typeof row.features === 'string' ? JSON.parse(row.features) : row.features) : [],
      isActive: Boolean(row.is_active ?? row.isActive ?? true),
    };
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    try {
      const id = `plan_${Date.now().toString().slice(-8)}`;
      const featuresJson = plan.features ? JSON.stringify(plan.features) : null;
      await this.db.execute({
        sql: `INSERT INTO plans (id, name, duration, price, features, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          plan.name,
          plan.duration,
          plan.price,
          featuresJson,
          plan.isActive !== undefined ? (plan.isActive ? 1 : 0) : 1,
        ],
      });
      const created = await this.getPlan(id);
      if (!created) throw new Error("Failed to retrieve created plan");
      return created;
    } catch (error) {
      console.error("createPlan error:", error);
      throw error;
    }
  }

  async updatePlan(id: string, plan: Partial<InsertPlan>): Promise<Plan | undefined> {
    const current = await this.getPlan(id);
    if (!current) return undefined;
    
    const updates: string[] = [];
    const args: any[] = [];
    
    if (plan.name !== undefined) {
      updates.push("name = ?");
      args.push(plan.name);
    }
    if (plan.duration !== undefined) {
      updates.push("duration = ?");
      args.push(plan.duration);
    }
    if (plan.price !== undefined) {
      updates.push("price = ?");
      args.push(plan.price);
    }
    if (plan.features !== undefined) {
      updates.push("features = ?");
      args.push(JSON.stringify(plan.features));
    }
    if (plan.isActive !== undefined) {
      updates.push("is_active = ?");
      args.push(plan.isActive ? 1 : 0);
    }
    
    if (updates.length === 0) return current;
    
    args.push(id);
    await this.db.execute({
      sql: `UPDATE plans SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });
    return await this.getPlan(id);
  }

  async deletePlan(id: string): Promise<boolean> {
    const result = await this.db.execute({
      sql: `DELETE FROM plans WHERE id = ?`,
      args: [id],
    });
    return (result.rowsAffected ?? 0) > 0;
  }
}

export const storage = new TursoStorage();
