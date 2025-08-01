import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, MapPin, Users, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface MilestoneCardProps {
  title: string;
  studyId: string;
  siteName?: string;
  status: "pending" | "completed" | "overdue";
  dueDate: string;
  plannedFinishDate?: string;
  baselineFinishDate?: string;
  actualFinishDate?: string;
  progress: number;
  assignedTo: string;
  priority: "high" | "medium" | "low";
}

const MilestoneCard = ({ 
  title, 
  studyId, 
  siteName, 
  status, 
  dueDate,
  plannedFinishDate,
  baselineFinishDate,
  actualFinishDate,
  progress, 
  assignedTo, 
  priority 
}: MilestoneCardProps) => {
  const getStatusIcon = () => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "overdue":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "overdue":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-warning/10 text-warning border-warning/20";
    }
  };

  const getPriorityColor = () => {
    switch (priority) {
      case "high":
        return "bg-destructive";
      case "medium":
        return "bg-warning";
      default:
        return "bg-muted";
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-300 border border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold text-foreground leading-tight">
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-8 rounded-full ${getPriorityColor()}`} />
            {getStatusIcon()}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="font-medium text-primary">{studyId}</span>
          {siteName && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{siteName}</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Due: {dueDate}</span>
            </div>
            <Badge className={getStatusColor()}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>Assigned to: {assignedTo}</span>
          </div>
          
          {/* Date fields section */}
          <div className="space-y-1 text-xs border-t pt-2">
            {plannedFinishDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Planned Finish:</span>
                <span className="font-medium">{plannedFinishDate}</span>
              </div>
            )}
            {baselineFinishDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Baseline Finish:</span>
                <span className="font-medium">{baselineFinishDate}</span>
              </div>
            )}
            {actualFinishDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual Finish:</span>
                <span className="font-medium text-success">{actualFinishDate}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MilestoneCard;