import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { MemberCard } from "@/components/member-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, UserPlus, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Fingerprint } from "lucide-react";

export default function Members() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [viewMemberId, setViewMemberId] = useState<string | null>(null);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [extendMemberId, setExtendMemberId] = useState<string | null>(null);
  const { toast } = useToast();
  const [linkBiometricForId, setLinkBiometricForId] = useState<string | null>(null);
  const [biometricUserId, setBiometricUserId] = useState<string>("");

  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ["/api/members"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: getQueryFn({ on401: "throw" }),
  });


  const formSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(6),
    planId: z.string().optional(),
    status: z.enum(["active", "expired", "pending", "frozen"]).default("active"),
    paymentStatus: z.enum(["paid", "pending", "overdue"]).default("paid"),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", phone: "", planId: "", status: "active", paymentStatus: "paid" },
  });

  const sendInvoicesToday = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/send-invoices-today", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "E-bills sent",
        description: `Attempted: ${data.count}, Sent: ${data.sent}, Failed: ${data.failed}`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send", description: error?.message || "Unknown error", variant: "destructive" });
    },
  });

  const createMember = useMutation({
    mutationFn: async (values: FormValues) => {
      // Get selected plan
      const selectedPlan = plans.find((p: any) => p.id === values.planId);
      const startDate = new Date();
      const expiryDate = selectedPlan 
        ? new Date(startDate.getTime() + selectedPlan.duration * 24 * 60 * 60 * 1000)
        : null;
      
      await apiRequest("POST", "/api/members", {
        ...values,
        loginCode: String(Math.floor(Math.random() * 900000) + 100000),
        planName: selectedPlan?.name,
        startDate: startDate.toISOString(),
        expiryDate: expiryDate?.toISOString(),
      });
    },
    onSuccess: async () => {
      // Invalidate all related queries to ensure sync across pages
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      await queryClient.refetchQueries({ queryKey: ["/api/members"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Member created",
        description: "Member has been added successfully.",
      });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to create member";
      // Try to extract server-provided JSON message if present
      toast({
        title: "Create member failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FormValues }) => {
      await apiRequest("PATCH", `/api/members/${id}`, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setEditMemberId(null);
      editForm.reset();
      toast({ title: "Member updated", description: "Member details have been updated." });
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/members/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Member deleted", description: "Member has been removed." });
    },
  });

  const freezeMember = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/members/${id}`, { status: "frozen" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Membership frozen", description: "Member's membership has been frozen." });
    },
  });

  const extendForm = useForm<{ months: string }>({
    resolver: zodResolver(z.object({ months: z.string().min(1) })),
    defaultValues: { months: "1" },
  });

  const extendMember = useMutation({
    mutationFn: async ({ id, months }: { id: string; months: number }) => {
      const member = members.find((m: any) => m.id === id);
      if (!member) return;
      const currentExpiry = member.expiryDate ? new Date(member.expiryDate) : new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setMonth(newExpiry.getMonth() + months);
      await apiRequest("PATCH", `/api/members/${id}`, { expiryDate: newExpiry.toISOString() });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setExtendMemberId(null);
      extendForm.reset();
      toast({ title: "Membership extended", description: "Member's expiry date has been extended." });
    },
  });

  const linkBiometric = useMutation({
    mutationFn: async ({ memberId, biometricId }: { memberId: string; biometricId: string }) => {
      await apiRequest("POST", "/api/biometric/map-member", { memberId, biometricId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setLinkBiometricForId(null);
      setBiometricUserId("");
      toast({ title: "Linked", description: "Biometric User ID linked successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to link", description: error?.message || "Could not link biometric.", variant: "destructive" });
    },
  });

  const handleSendReminder = (id: string) => {
    const member = members.find((m: any) => m.id === id);
    toast({
      title: "Reminder sent",
      description: member ? `Reminder sent to ${member.name}` : "Reminder sent",
    });
  };

  const handleViewProfile = (id: string) => {
    setViewMemberId(id);
  };

  const handleEdit = (id: string) => {
    const member = members.find((m: any) => m.id === id);
    if (member) {
      editForm.reset({
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.status,
        paymentStatus: member.paymentStatus,
      });
      setEditMemberId(id);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || member.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const biometricLinkedMembers = filteredMembers.filter((m: any) => !!(m.biometricId ?? m.biometric_id));

  const stats = {
    active: members.filter((m: any) => m.status === "active").length,
    expiringThisWeek: 0,
    expired: members.filter((m: any) => m.status === "expired").length,
    paymentPending: members.filter((m: any) => m.paymentStatus === "pending" || m.paymentStatus === "overdue").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-muted-foreground">Manage your gym members</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => sendInvoicesToday.mutate()} disabled={sendInvoicesToday.isPending}>
            {sendInvoicesToday.isPending ? "Sending…" : "Send today's e-bills"}
          </Button>
          <Button data-testid="button-add-member" onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.expiringThisWeek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payment Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.paymentPending}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-members"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="pending">Pending Renewal</SelectItem>
            <SelectItem value="frozen">Frozen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Members</TabsTrigger>
            <TabsTrigger value="biometric">Biometric Linked</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member: any) => {
          // Safely parse dates - handle null, empty strings, and invalid dates
          const parseDate = (dateStr: any) => {
            if (!dateStr) return undefined;
            try {
              const date = new Date(dateStr);
              return isNaN(date.getTime()) ? undefined : date;
            } catch {
              return undefined;
            }
          };
          
            return (
              <MemberCard
                key={member.id}
                id={member.id}
                name={member.name}
                photoUrl={member.photoUrl}
                planName={member.planName}
                expiryDate={parseDate(member.expiryDate)}
                status={member.status}
                paymentStatus={member.paymentStatus}
                lastCheckIn={parseDate(member.lastCheckIn)}
                biometricLinked={Boolean(member.biometricId ?? member.biometric_id)}
                onViewProfile={handleViewProfile}
                onSendReminder={handleSendReminder}
                onFreeze={(id) => freezeMember.mutate(id)}
                onExtend={(id) => setExtendMemberId(id)}
              />
            );
          })}
          </div>
          {filteredMembers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No members found matching your criteria
            </div>
          )}
        </TabsContent>

        <TabsContent value="biometric">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {biometricLinkedMembers.map((member: any) => {
              const parseDate = (dateStr: any) => {
                if (!dateStr) return undefined;
                try {
                  const date = new Date(dateStr);
                  return isNaN(date.getTime()) ? undefined : date;
                } catch {
                  return undefined;
                }
              };
              return (
                <MemberCard
                  key={member.id}
                  id={member.id}
                  name={member.name}
                  photoUrl={member.photoUrl}
                  planName={member.planName}
                  expiryDate={parseDate(member.expiryDate)}
                  status={member.status}
                  paymentStatus={member.paymentStatus}
                  lastCheckIn={parseDate(member.lastCheckIn)}
                  biometricLinked={true}
                  onViewProfile={handleViewProfile}
                  onSendReminder={handleSendReminder}
                  onFreeze={(id) => freezeMember.mutate(id)}
                  onExtend={(id) => setExtendMemberId(id)}
                />
              );
            })}
          </div>
          {biometricLinkedMembers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No biometric-linked members yet. Link a member from their profile.
            </div>
          )}
        </TabsContent>
      </Tabs>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => createMember.mutate(v))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="planId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membership Plan</FormLabel>
                    <Select 
                      value={field.value || undefined} 
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Plan</SelectItem>
                        {plans.filter((p: any) => p.isActive).map((plan: any) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} - ₹{Number(plan.price).toLocaleString()} ({plan.duration} days)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="frozen">Frozen</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMember.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={viewMemberId !== null} onOpenChange={(open) => !open && setViewMemberId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Member Profile</DialogTitle>
          </DialogHeader>
          {viewMemberId && (() => {
            const member = members.find((m: any) => m.id === viewMemberId);
            if (!member) return null;
            const parseDate = (dateStr: any) => {
              if (!dateStr) return null;
              try {
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? null : date;
              } catch {
                return null;
              }
            };
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={member.photoUrl} alt={member.name} />
                    <AvatarFallback>{member.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{member.name}</h3>
                    <p className="text-muted-foreground">{member.email}</p>
                    <p className="text-muted-foreground">{member.phone}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge>{member.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <Badge>{member.paymentStatus}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="font-medium">{member.planName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Login Code</p>
                    <p className="font-mono">{member.loginCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p>{parseDate(member.startDate) ? format(parseDate(member.startDate)!, "MMM dd, yyyy") : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expiry Date</p>
                    <p>{parseDate(member.expiryDate) ? format(parseDate(member.expiryDate)!, "MMM dd, yyyy") : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Check-In</p>
                    <p>{parseDate(member.lastCheckIn) ? format(parseDate(member.lastCheckIn)!, "MMM dd, yyyy HH:mm") : "Never"}</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setViewMemberId(null); handleEdit(viewMemberId!); }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button onClick={() => { setLinkBiometricForId(viewMemberId!); setBiometricUserId(""); }}>
                    <Fingerprint className="h-4 w-4 mr-2" />
                    Link Biometric
                  </Button>
                  <Button variant="destructive" onClick={() => { deleteMember.mutate(viewMemberId!); setViewMemberId(null); }} disabled={deleteMember.isPending}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Link Biometric Dialog */}
      <Dialog open={linkBiometricForId !== null} onOpenChange={(open) => !open && setLinkBiometricForId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Biometric</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the User ID from the fingerprint device (e.g., 41).</p>
            <Input
              placeholder="Device User ID"
              value={biometricUserId}
              onChange={(e) => setBiometricUserId(e.target.value)}
              data-testid="input-biometric-user-id"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkBiometricForId(null)}>Cancel</Button>
            <Button
              onClick={() => linkBiometricForId && linkBiometric.mutate({ memberId: linkBiometricForId, biometricId: biometricUserId.trim() })}
              disabled={linkBiometric.isPending || biometricUserId.trim() === ""}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editMemberId !== null} onOpenChange={(open) => !open && setEditMemberId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((v) => editMemberId && updateMember.mutate({ id: editMemberId, values: v }))} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="frozen">Frozen</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="paymentStatus" render={({ field }) => (
                  <FormItem><FormLabel>Payment Status</FormLabel><Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditMemberId(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMember.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Extend Membership Dialog */}
      <Dialog open={extendMemberId !== null} onOpenChange={(open) => !open && setExtendMemberId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Membership</DialogTitle>
          </DialogHeader>
          <Form {...extendForm}>
            <form onSubmit={extendForm.handleSubmit((v) => extendMemberId && extendMember.mutate({ id: extendMemberId, months: parseInt(v.months) }))} className="space-y-4">
              <FormField control={extendForm.control} name="months" render={({ field }) => (
                <FormItem>
                  <FormLabel>Extend by (months)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setExtendMemberId(null)}>Cancel</Button>
                <Button type="submit" disabled={extendMember.isPending}>Extend</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
