import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentTable } from "@/components/payment-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Wallet,
  Download,
  FileText,
  Plus,
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";

export default function Financial() {
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [open, setOpen] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const { toast } = useToast();

  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const formSchema = z.object({
    memberId: z.string().min(1),
    amount: z.string().min(1),
    paymentMethod: z.enum(["cash", "card", "upi", "online"]).default("cash"),
    status: z.enum(["paid", "pending", "overdue"]).default("paid"),
  });

  type FormValues = z.infer<typeof formSchema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { paymentMethod: "cash", status: "paid" } as any,
  });

  const processPayment = useMutation({
    mutationFn: async (values: FormValues) => {
      await apiRequest("POST", "/api/payments", {
        ...values,
        paidDate: values.status === "paid" ? new Date().toISOString() : null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      await queryClient.refetchQueries({ queryKey: ["/api/payments"] });
      setOpen(false);
      form.reset();
    },
  });
  const { data: members = [] } = useQuery({
    queryKey: ["/api/members"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Parse dates safely
  const parseDate = (dateStr: any) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  // Calculate revenue by plan from paid payments
  const paidPayments = payments.filter((p: any) => p.status === "paid");
  const planRevenue = new Map<string, number>();
  paidPayments.forEach((p: any) => {
    const plan = p.planName || "Unknown Plan";
    planRevenue.set(plan, (planRevenue.get(plan) || 0) + Number(p.amount || 0));
  });
  const chartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];
  const revenueByPlan = Array.from(planRevenue.entries())
    .map(([name, value], idx) => ({
      name,
      value,
      color: chartColors[idx % chartColors.length],
    }))
    .sort((a, b) => b.value - a.value);

  // Calculate monthly revenue for last 6 months
  const now = new Date();
  const sixMonthsAgo = subMonths(now, 5);
  const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });
  const monthlyRevenue = months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthRevenue = paidPayments
      .filter((p: any) => {
        const paid = parseDate(p.paidDate);
        return paid && paid >= monthStart && paid <= monthEnd;
      })
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    return {
      month: format(month, "MMM"),
      revenue: monthRevenue,
      expenses: 0, // Expenses not tracked in DB - set to 0
    };
  });

  const memberById = new Map(members.map((m: any) => [m.id, m] as const));
  
  // Filter pending payments - check payment status directly
  const pendingPayments = payments
    .filter((p: any) => p.status === "pending" || p.status === "overdue")
    .map((p: any) => ({
      id: p.id,
      memberName: memberById.get(p.memberId)?.name ?? p.memberId,
      amount: Number(p.amount ?? 0),
      dueDate: p.dueDate ? new Date(p.dueDate) : undefined,
      status: p.status,
      planName: p.planName ?? undefined,
    }));
  
  // Also add members with pending payment status who don't have payment records yet
  const membersWithPendingPaymentStatus = members
    .filter((m: any) => (m.paymentStatus === "pending" || m.paymentStatus === "overdue") && !pendingPayments.find((p) => memberById.get(p.memberId)?.id === m.id))
    .map((m: any) => ({
      id: `member_pending_${m.id}`,
      memberName: m.name,
      amount: 0, // Amount not specified yet
      dueDate: m.expiryDate ? new Date(m.expiryDate) : undefined,
      status: m.paymentStatus,
      planName: m.planName ?? undefined,
    }));
  
  // Combine both lists
  const allPendingPayments = [...pendingPayments, ...membersWithPendingPaymentStatus];

  // Recent transactions - last 10 paid payments
  const recentTransactions = paidPayments
    .slice()
    .sort((a: any, b: any) => {
      const dateA = parseDate(a.paidDate);
      const dateB = parseDate(b.paidDate);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 10)
    .map((p: any) => {
      const member = memberById.get(p.memberId);
      return {
        id: p.id,
        memberName: member?.name || p.memberId,
        amount: Number(p.amount || 0),
        method: p.paymentMethod || "Unknown",
        date: parseDate(p.paidDate),
        planName: p.planName || "Unknown Plan",
      };
    })
    .filter((t) => t.date); // Only include transactions with valid dates

  // Calculate real metrics
  const currentMonthData = monthlyRevenue[monthlyRevenue.length - 1];
  const totalRevenue = currentMonthData.revenue;
  const totalExpenses = currentMonthData.expenses;
  const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
  
  const totalPayments = payments.length;
  const paidCount = paidPayments.length;
  const collectionRate = totalPayments > 0 ? (paidCount / totalPayments) * 100 : 0;
  
  const activeMemberCount = members.filter((m: any) => m.status === "active").length;
  const avgRevenuePerMember = activeMemberCount > 0 ? Math.round(totalRevenue / activeMemberCount) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          <p className="text-muted-foreground">Track revenue, expenses, and payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export-financial" onClick={() => {
            const csv = [
              ["Member", "Amount", "Method", "Status", "Date"].join(","),
              ...paidPayments.slice().sort((a: any, b: any) => {
                const dateA = parseDate(a.paidDate);
                const dateB = parseDate(b.paidDate);
                if (!dateA || !dateB) return 0;
                return dateB.getTime() - dateA.getTime();
              }).map((p: any) => {
                const member = memberById.get(p.memberId);
                return [
                  member?.name || p.memberId,
                  p.amount || 0,
                  p.paymentMethod || "Unknown",
                  p.status,
                  parseDate(p.paidDate) ? format(parseDate(p.paidDate)!, "yyyy-MM-dd") : "",
                ].join(",");
              }),
            ].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `financial-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: "Report exported", description: "Financial report downloaded as CSV." });
          }}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button data-testid="button-process-payment" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Process Payment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Monthly Revenue"
          value={`₹${totalRevenue.toLocaleString()}`}
          icon={DollarSign}
        />
        <MetricCard
          title="Profit Margin"
          value={`${profitMargin.toFixed(1)}%`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          icon={CreditCard}
          subtitle="Payment success rate"
        />
        <MetricCard
          title="Avg Revenue/Member"
          value={`₹${avgRevenuePerMember.toLocaleString()}`}
          icon={Wallet}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Revenue" />
                <Bar dataKey="expenses" fill="hsl(var(--chart-5))" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueByPlan}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {revenueByPlan.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  formatter={(value: number) => `₹${value.toLocaleString()}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Pending Payments</CardTitle>
          <div className="flex gap-2">
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-[150px]" data-testid="select-payment-method">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
            <PaymentTable
            payments={allPendingPayments}
            onSendReminder={(id) => {
              const payment = allPendingPayments.find((p) => p.id === id);
              toast({
                title: "Reminder sent",
                description: payment ? `Payment reminder sent to ${payment.memberName}` : "Reminder sent",
              });
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => processPayment.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="memberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Member ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Member ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
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
                <Button type="submit" disabled={processPayment.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Recent Transactions</CardTitle>
          <Button size="sm" variant="outline" data-testid="button-view-all-transactions" onClick={() => setShowAllTransactions(!showAllTransactions)}>
            {showAllTransactions ? "Show Less" : "View All"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTransactions.length > 0 ? (
              (showAllTransactions ? recentTransactions : recentTransactions.slice(0, 5)).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{transaction.memberName}</div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.planName} • {transaction.method}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold font-mono">₹{transaction.amount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      {transaction.date ? format(transaction.date, "MMM dd, yyyy") : "N/A"}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">No recent transactions</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expense tracking not implemented in database - removed expense breakdown section */}
    </div>
  );
}
