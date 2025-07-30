import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, Calendar, Target } from "lucide-react";

interface StudyData {
  id: string;
  name: string;
  phase: string;
  status: "active" | "recruiting" | "completed" | "paused";
  enrollment: {
    current: number;
    target: number;
  };
  sites: {
    active: number;
    total: number;
  };
  startDate: string;
  completionRate: number;
}

const StudyOverview = () => {
  // Mock data - in real implementation, this would come from Veeva API
  const studies: StudyData[] = [
    {
      id: "VV-001-2024",
      name: "Oncology Phase III Efficacy Study",
      phase: "Phase III",
      status: "active",
      enrollment: { current: 245, target: 300 },
      sites: { active: 12, total: 15 },
      startDate: "2024-01-15",
      completionRate: 82
    },
    {
      id: "VV-002-2024", 
      name: "Cardiovascular Safety Study",
      phase: "Phase II",
      status: "recruiting",
      enrollment: { current: 89, target: 150 },
      sites: { active: 8, total: 10 },
      startDate: "2024-03-01",
      completionRate: 59
    },
    {
      id: "VV-003-2024",
      name: "Neurological Biomarker Study",
      phase: "Phase I",
      status: "active", 
      enrollment: { current: 28, target: 40 },
      sites: { active: 3, total: 4 },
      startDate: "2024-06-10",
      completionRate: 70
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success border-success/20";
      case "recruiting":
        return "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/20";
      case "completed":
        return "bg-muted/10 text-muted-foreground border-muted/20";
      case "paused":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Active Studies</h2>
        <Badge variant="outline" className="text-muted-foreground">
          {studies.length} Studies
        </Badge>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {studies.map((study) => (
          <Card key={study.id} className="hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold leading-tight">
                    {study.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{study.id}</p>
                </div>
                <Badge className="text-xs bg-gradient-to-r from-clinical-blue to-clinical-green text-white">
                  {study.phase}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={getStatusColor(study.status)}>
                  {study.status.charAt(0).toUpperCase() + study.status.slice(1)}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{study.startDate}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Enrollment</span>
                  </div>
                  <span className="font-medium">
                    {study.enrollment.current}/{study.enrollment.target}
                  </span>
                </div>
                <Progress 
                  value={(study.enrollment.current / study.enrollment.target) * 100} 
                  className="h-2"
                />
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Sites Active</span>
                  </div>
                  <span className="font-medium">
                    {study.sites.active}/{study.sites.total}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Completion</span>
                  </div>
                  <span className="font-medium">{study.completionRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default StudyOverview;