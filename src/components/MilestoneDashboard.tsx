import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, RefreshCw } from "lucide-react";
import MilestoneCard from "./MilestoneCard";

const MilestoneDashboard = () => {
  // Mock milestone data - in real implementation, this would come from Veeva API
  const studyMilestones = [
    {
      title: "Database Lock",
      studyId: "VV-001-2024",
      status: "pending" as const,
      dueDate: "2024-08-15",
      progress: 75,
      assignedTo: "Dr. Sarah Johnson",
      priority: "high" as const
    },
    {
      title: "First Patient Visit",
      studyId: "VV-002-2024", 
      status: "completed" as const,
      dueDate: "2024-07-20",
      progress: 100,
      assignedTo: "Clinical Team A",
      priority: "medium" as const
    },
    {
      title: "Interim Analysis",
      studyId: "VV-001-2024",
      status: "overdue" as const,
      dueDate: "2024-07-25",
      progress: 60,
      assignedTo: "Statistics Team",
      priority: "high" as const
    }
  ];

  const siteMilestones = [
    {
      title: "Site Initiation Visit",
      studyId: "VV-001-2024",
      siteName: "Johns Hopkins Medical Center",
      status: "completed" as const,
      dueDate: "2024-06-30",
      progress: 100,
      assignedTo: "CRA Team 1",
      priority: "medium" as const
    },
    {
      title: "Regulatory Approval",
      studyId: "VV-002-2024",
      siteName: "Mayo Clinic Rochester", 
      status: "pending" as const,
      dueDate: "2024-08-10",
      progress: 85,
      assignedTo: "Regulatory Affairs",
      priority: "high" as const
    },
    {
      title: "First Patient Enrollment",
      studyId: "VV-003-2024",
      siteName: "Stanford Medical Center",
      status: "pending" as const,
      dueDate: "2024-08-05",
      progress: 40,
      assignedTo: "Site Team Stanford",
      priority: "medium" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Milestone Tracking</h2>
        <Button variant="clinical" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync with Veeva
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search milestones..."
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      <Tabs defaultValue="study" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="study">Study Milestones</TabsTrigger>
          <TabsTrigger value="site">Site Milestones</TabsTrigger>
        </TabsList>
        
        <TabsContent value="study" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {studyMilestones.map((milestone, index) => (
              <MilestoneCard key={index} {...milestone} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="site" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {siteMilestones.map((milestone, index) => (
              <MilestoneCard key={index} {...milestone} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MilestoneDashboard;