import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, AlertCircle } from "lucide-react";

interface StatusIndicatorProps {
  isConnected: boolean;
  lastSync?: string;
}

const StatusIndicator = ({ isConnected, lastSync }: StatusIndicatorProps) => {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border">
      <div className="flex items-center gap-2">
        {isConnected ? (
          <Wifi className="h-4 w-4 text-success" />
        ) : (
          <WifiOff className="h-4 w-4 text-destructive" />
        )}
        <span className="text-sm font-medium">
          Veeva CTMS Connection
        </span>
        <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>
      
      {lastSync && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          <span>Last sync: {lastSync}</span>
        </div>
      )}
    </div>
  );
};

export default StatusIndicator;