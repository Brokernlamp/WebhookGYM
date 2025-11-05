import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, UserCog, Pause, Eye } from "lucide-react";
import { format } from "date-fns";

interface MemberCardProps {
  id: string;
  name: string;
  photoUrl?: string;
  planName?: string;
  expiryDate?: Date;
  status: "active" | "expired" | "pending" | "frozen";
  paymentStatus: "paid" | "pending" | "overdue";
  lastCheckIn?: Date;
  onViewProfile: (id: string) => void;
  onSendReminder: (id: string) => void;
  onFreeze: (id: string) => void;
  onExtend: (id: string) => void;
}

export function MemberCard({
  id,
  name,
  photoUrl,
  planName,
  expiryDate,
  status,
  paymentStatus,
  lastCheckIn,
  onViewProfile,
  onSendReminder,
  onFreeze,
  onExtend,
}: MemberCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const statusColors = {
    active: "bg-chart-3 text-white",
    expired: "bg-destructive text-destructive-foreground",
    pending: "bg-chart-4 text-white",
    frozen: "bg-muted text-muted-foreground",
  };

  const paymentColors = {
    paid: "bg-chart-3 text-white",
    pending: "bg-chart-4 text-white",
    overdue: "bg-destructive text-destructive-foreground",
  };

  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={photoUrl} alt={name} />
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="font-semibold" data-testid={`text-member-name-${id}`}>{name}</h3>
              {planName && <p className="text-sm text-muted-foreground">{planName}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className={statusColors[status]}>
                {status.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className={paymentColors[paymentStatus]}>
                {paymentStatus.toUpperCase()}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {expiryDate && !isNaN(expiryDate.getTime()) && (
                <div>Expires: {format(expiryDate, "MMM dd, yyyy")}</div>
              )}
              {lastCheckIn && !isNaN(lastCheckIn.getTime()) && (
                <div>Last visit: {format(lastCheckIn, "MMM dd, yyyy")}</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 p-4 pt-0">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewProfile(id)}
          data-testid={`button-view-profile-${id}`}
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSendReminder(id)}
          data-testid={`button-send-reminder-${id}`}
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          WhatsApp
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onExtend(id)}
          data-testid={`button-extend-${id}`}
        >
          <UserCog className="h-4 w-4 mr-1" />
          Extend
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onFreeze(id)}
          data-testid={`button-freeze-${id}`}
        >
          <Pause className="h-4 w-4 mr-1" />
          Freeze
        </Button>
      </CardFooter>
    </Card>
  );
}
