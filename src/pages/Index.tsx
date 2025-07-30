import { useState, useEffect } from "react";
import Header from "@/components/Header";
import StudyOverview from "@/components/StudyOverview";
import MilestoneDashboard from "@/components/MilestoneDashboard";
import StatusIndicator from "@/components/StatusIndicator";

const Index = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [lastSync, setLastSync] = useState<string>();

  useEffect(() => {
    // Simulate connection status and sync time
    setLastSync(new Date().toLocaleTimeString());
    
    // Simulate real-time updates every 30 seconds
    const interval = setInterval(() => {
      setLastSync(new Date().toLocaleTimeString());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Clinical Trial Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time monitoring of study and site-level milestones
            </p>
          </div>
        </div>

        <StatusIndicator isConnected={isConnected} lastSync={lastSync} />
        
        <StudyOverview />
        
        <MilestoneDashboard />
      </main>
    </div>
  );
};

export default Index;
