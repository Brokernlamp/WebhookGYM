import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Clock, DollarSign, Users, Save, Key, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

export default function Settings() {
  const { toast } = useToast();
  const [gymInfo, setGymInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    gstNumber: "",
  });

  const [operatingHours, setOperatingHours] = useState({
    weekdayOpen: "06:00",
    weekdayClose: "22:00",
    weekendOpen: "07:00",
    weekendClose: "21:00",
  });

  const [gpsSettings, setGpsSettings] = useState({
    enabled: true,
    latitude: "",
    longitude: "",
    radius: "100",
  });


  const [paymentSettings, setPaymentSettings] = useState({
    razorpayKey: "",
    stripeKey: "",
    taxRate: "18",
  });

  // Load settings
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings && !isLoading && Object.keys(settings).length > 0) {
      setGymInfo({
        name: settings.gymName || "",
        address: settings.gymAddress || "",
        phone: settings.gymPhone || "",
        email: settings.gymEmail || "",
        gstNumber: settings.gymGstNumber || "",
      });
      setOperatingHours({
        weekdayOpen: settings.weekdayOpen || "06:00",
        weekdayClose: settings.weekdayClose || "22:00",
        weekendOpen: settings.weekendOpen || "07:00",
        weekendClose: settings.weekendClose || "21:00",
      });
      setGpsSettings({
        enabled: settings.gpsEnabled ?? true,
        latitude: settings.gpsLatitude || "",
        longitude: settings.gpsLongitude || "",
        radius: settings.gpsRadius || "100",
      });
      setPaymentSettings({
        razorpayKey: settings.razorpayKey || "",
        stripeKey: settings.stripeKey || "",
        taxRate: settings.taxRate || "18",
      });
    }
  }, [settings, isLoading]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/settings", {
        gymName: gymInfo.name,
        gymAddress: gymInfo.address,
        gymPhone: gymInfo.phone,
        gymEmail: gymInfo.email,
        gymGstNumber: gymInfo.gstNumber,
        weekdayOpen: operatingHours.weekdayOpen,
        weekdayClose: operatingHours.weekdayClose,
        weekendOpen: operatingHours.weekendOpen,
        weekendClose: operatingHours.weekendClose,
        gpsEnabled: gpsSettings.enabled,
        gpsLatitude: gpsSettings.latitude,
        gpsLongitude: gpsSettings.longitude,
        gpsRadius: gpsSettings.radius,
        razorpayKey: paymentSettings.razorpayKey,
        stripeKey: paymentSettings.stripeKey,
        taxRate: paymentSettings.taxRate,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your gym configuration and preferences</p>
        </div>
        <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} data-testid="button-save-settings" className="min-w-[140px]">
          {saveSettings.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <CardTitle>Gym Information</CardTitle>
          </div>
          <CardDescription>Basic information about your gym facility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gym-name">Gym Name</Label>
              <Input
                id="gym-name"
                value={gymInfo.name}
                onChange={(e) => setGymInfo({ ...gymInfo, name: e.target.value })}
                data-testid="input-gym-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={gymInfo.phone}
                onChange={(e) => setGymInfo({ ...gymInfo, phone: e.target.value })}
                data-testid="input-phone"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={gymInfo.address}
              onChange={(e) => setGymInfo({ ...gymInfo, address: e.target.value })}
              data-testid="input-address"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={gymInfo.email}
                onChange={(e) => setGymInfo({ ...gymInfo, email: e.target.value })}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst">GST Number</Label>
              <Input
                id="gst"
                value={gymInfo.gstNumber}
                onChange={(e) => setGymInfo({ ...gymInfo, gstNumber: e.target.value })}
                data-testid="input-gst"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Operating Hours</CardTitle>
          </div>
          <CardDescription>Set your gym's operating hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-3">Weekdays (Mon - Fri)</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weekday-open">Opening Time</Label>
                <Input
                  id="weekday-open"
                  type="time"
                  value={operatingHours.weekdayOpen}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, weekdayOpen: e.target.value })
                  }
                  data-testid="input-weekday-open"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekday-close">Closing Time</Label>
                <Input
                  id="weekday-close"
                  type="time"
                  value={operatingHours.weekdayClose}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, weekdayClose: e.target.value })
                  }
                  data-testid="input-weekday-close"
                />
              </div>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-medium mb-3">Weekend (Sat - Sun)</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weekend-open">Opening Time</Label>
                <Input
                  id="weekend-open"
                  type="time"
                  value={operatingHours.weekendOpen}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, weekendOpen: e.target.value })
                  }
                  data-testid="input-weekend-open"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekend-close">Closing Time</Label>
                <Input
                  id="weekend-close"
                  type="time"
                  value={operatingHours.weekendClose}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, weekendClose: e.target.value })
                  }
                  data-testid="input-weekend-close"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>GPS Attendance Settings</CardTitle>
          </div>
          <CardDescription>Configure location-based attendance verification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable GPS Verification</Label>
              <p className="text-sm text-muted-foreground">
                Require members to be within gym location to mark attendance
              </p>
            </div>
            <Switch
              checked={gpsSettings.enabled}
              onCheckedChange={(checked) =>
                setGpsSettings({ ...gpsSettings, enabled: checked })
              }
              data-testid="switch-gps-enabled"
            />
          </div>
          {gpsSettings.enabled && (
            <>
              <Separator />
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Gym Latitude</Label>
                  <Input
                    id="latitude"
                    placeholder="19.0760"
                    value={gpsSettings.latitude}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, latitude: e.target.value })
                    }
                    data-testid="input-latitude"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Gym Longitude</Label>
                  <Input
                    id="longitude"
                    placeholder="72.8777"
                    value={gpsSettings.longitude}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, longitude: e.target.value })
                    }
                    data-testid="input-longitude"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radius">Allowed Radius (meters)</Label>
                  <Input
                    id="radius"
                    type="number"
                    placeholder="100"
                    value={gpsSettings.radius}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, radius: e.target.value })
                    }
                    data-testid="input-radius"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Members must be within {gpsSettings.radius}m of the gym location to mark attendance
              </p>
            </>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>Payment Gateway</CardTitle>
          </div>
          <CardDescription>Configure payment processing settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="razorpay-key">Razorpay API Key</Label>
            <Input
              id="razorpay-key"
              type="password"
              value={paymentSettings.razorpayKey}
              onChange={(e) =>
                setPaymentSettings({ ...paymentSettings, razorpayKey: e.target.value })
              }
              data-testid="input-razorpay-key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stripe-key">Stripe API Key</Label>
            <Input
              id="stripe-key"
              type="password"
              value={paymentSettings.stripeKey}
              onChange={(e) =>
                setPaymentSettings({ ...paymentSettings, stripeKey: e.target.value })
              }
              data-testid="input-stripe-key"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax Rate (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              placeholder="18"
              value={paymentSettings.taxRate}
              onChange={(e) =>
                setPaymentSettings({ ...paymentSettings, taxRate: e.target.value })
              }
              data-testid="input-tax-rate"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>User Roles & Permissions</CardTitle>
          </div>
          <CardDescription>Manage access levels for staff members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { role: "Admin", description: "Full access to all features", count: 2 },
              { role: "Receptionist", description: "Member check-in and payment processing", count: 3 },
              { role: "Trainer", description: "Class management and member tracking", count: 5 },
            ].map((role) => (
              <div
                key={role.role}
                className="flex items-center justify-between p-4 border rounded-md"
              >
                <div>
                  <div className="font-medium">{role.role}</div>
                  <div className="text-sm text-muted-foreground">{role.description}</div>
                </div>
                <div className="text-sm text-muted-foreground">{role.count} users</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
