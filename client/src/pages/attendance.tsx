import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AttendanceHeatmap } from "@/components/attendance-heatmap";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  UserCheck,
  Clock,
  TrendingUp,
  Search,
  LogIn,
  Users,
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Attendance() {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const { toast } = useToast();

  const { data: attendance = [] } = useQuery({
    queryKey: ["/api/attendance"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["/api/members"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const formSchema = z.object({ memberId: z.string().min(1, "Please select a member") });
  type FormValues = z.infer<typeof formSchema>;
  const form = useForm<FormValues>({ 
    resolver: zodResolver(formSchema),
    defaultValues: { memberId: "" },
  });
  const manualCheckin = useMutation({
    mutationFn: async (values: FormValues) => {
      await apiRequest("POST", "/api/attendance", { memberId: values.memberId, markedVia: "manual" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      await queryClient.refetchQueries({ queryKey: ["/api/attendance"] });
      await queryClient.refetchQueries({ queryKey: ["/api/members"] });
      setOpen(false);
      form.reset();
      setMemberSearchOpen(false);
      toast({
        title: "Check-in successful",
        description: "Member attendance has been recorded.",
      });
    },
  });
  const memberById = new Map(members.map((m: any) => [m.id, m] as const));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  
  const parseDate = (dateStr: any) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };
  
  const todayCheckIns = attendance
    .filter((a: any) => {
      const checkIn = parseDate(a.checkInTime);
      return checkIn && checkIn.toDateString() === todayStr;
    })
    .map((a: any) => {
      const m = memberById.get(a.memberId);
      return {
        id: a.id,
        name: m?.name ?? a.memberId,
        photoUrl: m?.photoUrl,
        checkInTime: parseDate(a.checkInTime),
        checkOutTime: parseDate(a.checkOutTime),
      };
    })
    .filter((c: any) => c.checkInTime); // Only include valid dates

  const yesterdayCheckIns = attendance.filter((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    return checkIn && checkIn.toDateString() === yesterdayStr;
  });

  // Currently in gym (checked in today without checkout)
  const currentlyInGym = todayCheckIns.filter((c: any) => !c.checkOutTime);

  // Calculate weekly trend (last 7 days)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyTrend = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    const dayName = days[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
    const dayStr = date.toDateString();
    const dayCheckIns = attendance.filter((a: any) => {
      const checkIn = parseDate(a.checkInTime);
      return checkIn && checkIn.toDateString() === dayStr;
    });
    weeklyTrend.push({ day: dayName, checkIns: dayCheckIns.length });
  }

  // Calculate average daily check-ins (last 30 days)
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCheckIns = attendance.filter((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    return checkIn && checkIn >= thirtyDaysAgo;
  });
  const avgDailyCheckIns = Math.round(recentCheckIns.length / 30);

  // Calculate peak hour from attendance data
  const hourCounts = new Map<number, number>();
  attendance.forEach((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    if (checkIn) {
      const hour = checkIn.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
  });
  let peakHour = "N/A";
  let maxCount = 0;
  hourCounts.forEach((count, hour) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = `${hour}:00`;
    }
  });

  // Real heatmap data from attendance
  const heatmapData: { hour: number; day: string; count: number }[] = [];
  attendance.forEach((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    if (!checkIn) return;
    const dayOfWeek = checkIn.getDay();
    const dayName = days[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
    const hour = checkIn.getHours();
    if (hour >= 6 && hour < 20) {
      const existing = heatmapData.find((h) => h.hour === hour && h.day === dayName);
      if (existing) {
        existing.count++;
      } else {
        heatmapData.push({ hour, day: dayName, count: 1 });
      }
    }
  });
  // Fill missing slots with 0
  days.forEach((day) => {
    for (let hour = 6; hour < 20; hour++) {
      if (!heatmapData.find((h) => h.hour === hour && h.day === day)) {
        heatmapData.push({ hour, day, count: 0 });
      }
    }
  });

  // Calculate member frequency from attendance (last 7 days)
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const memberCheckIns = new Map<string, number>();
  attendance.forEach((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    if (checkIn && checkIn >= weekAgo) {
      const count = memberCheckIns.get(a.memberId) || 0;
      memberCheckIns.set(a.memberId, count + 1);
    }
  });
  const regular = Array.from(memberCheckIns.values()).filter((c) => c >= 5).length;
  const moderate = Array.from(memberCheckIns.values()).filter((c) => c >= 3 && c < 5).length;
  const irregular = Array.from(memberCheckIns.values()).filter((c) => c >= 1 && c < 3).length;
  const inactive = members.length - regular - moderate - irregular;
  const memberFrequency = [
    { category: "Regular (5+ days/week)", count: regular, color: "bg-chart-3 text-white" },
    { category: "Moderate (3-4 days/week)", count: moderate, color: "bg-chart-1 text-white" },
    { category: "Irregular (1-2 days/week)", count: irregular, color: "bg-chart-4 text-white" },
    { category: "Inactive (0 days)", count: inactive, color: "bg-destructive text-destructive-foreground" },
  ];

  // Find absent members (7+ days since last visit)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const memberLastVisit = new Map<string, Date>();
  attendance.forEach((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    if (checkIn) {
      const existing = memberLastVisit.get(a.memberId);
      if (!existing || checkIn > existing) {
        memberLastVisit.set(a.memberId, checkIn);
      }
    }
  });
  const absentMembers = members
    .map((m: any) => {
      const lastVisit = memberLastVisit.get(m.id);
      if (!lastVisit || lastVisit < sevenDaysAgo) {
        const daysSince = lastVisit
          ? Math.floor((today.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;
        return {
          name: m.name,
          lastVisit: lastVisit || null,
          daysSince,
        };
      }
      return null;
    })
    .filter((m): m is { name: string; lastVisit: Date | null; daysSince: number } => m !== null && m.daysSince >= 7)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 10); // Top 10 absent members

  const filteredCheckIns = todayCheckIns.filter((checkIn) =>
    checkIn.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance & Check-In</h1>
          <p className="text-muted-foreground">Monitor member attendance and activity</p>
        </div>
        <Button data-testid="button-manual-checkin" onClick={() => setOpen(true)}>
          <LogIn className="h-4 w-4 mr-2" />
          Manual Check-In
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Today's Check-ins"
          value={todayCheckIns.length}
          icon={UserCheck}
          subtitle={yesterdayCheckIns.length > 0 ? `vs ${yesterdayCheckIns.length} yesterday` : undefined}
          trend={
            yesterdayCheckIns.length > 0
              ? {
                  value: Math.abs(((todayCheckIns.length - yesterdayCheckIns.length) / yesterdayCheckIns.length) * 100),
                  isPositive: todayCheckIns.length > yesterdayCheckIns.length,
                }
              : undefined
          }
        />
        <MetricCard
          title="Currently In Gym"
          value={currentlyInGym.length}
          icon={Users}
          subtitle="Active now"
        />
        <MetricCard
          title="Avg. Daily Check-ins"
          value={avgDailyCheckIns}
          icon={Calendar}
        />
        <MetricCard
          title="Peak Hour"
          value={peakHour}
          icon={Clock}
          subtitle="Most active time"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
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
                <Line
                  type="monotone"
                  dataKey="checkIns"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-1))" }}
                  name="Check-ins"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Member Frequency Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {memberFrequency.map((freq) => (
                <div key={freq.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{freq.category}</span>
                    <Badge className={freq.color}>{freq.count}</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-chart-1 transition-all"
                      style={{
                        width: `${members.length > 0 ? (freq.count / members.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AttendanceHeatmap data={heatmapData} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Today's Check-ins ({todayCheckIns.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search check-ins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-checkins"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredCheckIns.map((checkIn) => (
              <div
                key={checkIn.id}
                className="flex items-center justify-between p-4 border rounded-md hover-elevate"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={checkIn.photoUrl} alt={checkIn.name} />
                    <AvatarFallback>{getInitials(checkIn.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{checkIn.name}</div>
                    <div className="text-sm text-muted-foreground">
                      In: {format(checkIn.checkInTime, "HH:mm")}
                      {checkIn.checkOutTime && ` • Out: ${format(checkIn.checkOutTime, "HH:mm")}`}
                    </div>
                  </div>
                </div>
                {!checkIn.checkOutTime ? (
                  <Badge className="bg-chart-3 text-white">In Gym</Badge>
                ) : (
                  <Badge variant="secondary">Completed</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Check-In</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => manualCheckin.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="memberId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Member</FormLabel>
                    <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? members.find((m: any) => m.id === field.value)?.name || `ID: ${field.value}`
                              : "Search member by name or ID..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search member by name or ID..." />
                          <CommandList>
                            <CommandEmpty>No member found.</CommandEmpty>
                            <CommandGroup>
                              {members.map((member: any) => (
                                <CommandItem
                                  value={`${member.name} ${member.id} ${member.loginCode}`}
                                  key={member.id}
                                  onSelect={() => {
                                    form.setValue("memberId", member.id);
                                    setMemberSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      member.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{member.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ID: {member.id} • Code: {member.loginCode}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={manualCheckin.isPending}>Check In</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Absent Members Alert (7+ Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {absentMembers.length > 0 ? (
              absentMembers.map((member, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{member.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {member.lastVisit
                        ? `Last visit: ${format(member.lastVisit, "MMM dd, yyyy")}`
                        : "Never visited"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{member.daysSince} days ago</Badge>
                    <Button size="sm" variant="outline" data-testid={`button-contact-${index}`} onClick={() => {
                      const foundMember = members.find((m: any) => m.name === member.name);
                      if (foundMember?.phone) {
                        window.open(`tel:${foundMember.phone}`, "_blank");
                      } else {
                        toast({
                          title: "No phone number",
                          description: "Phone number not available for this member",
                          variant: "destructive",
                        });
                      }
                    }}>
                    Contact
                  </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">No absent members</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
