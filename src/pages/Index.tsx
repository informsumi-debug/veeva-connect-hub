import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import LoginForm from "@/components/auth/LoginForm";
import Header from "@/components/Header";
import StudyOverview from "@/components/StudyOverview";
import MilestoneDashboard from "@/components/MilestoneDashboard";
import StatusIndicator from "@/components/StatusIndicator";
import VeevaConfigurationDialog from "@/components/VeevaConfigurationDialog";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<string>();
  const [hasConfiguration, setHasConfiguration] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      checkConfiguration();
      setLastSync(new Date().toLocaleTimeString());
      
      // Simulate real-time updates every 30 seconds
      const interval = setInterval(() => {
        setLastSync(new Date().toLocaleTimeString());
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [user]);

  const checkConfiguration = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('veeva_configurations')
        .select('id, is_active')
        .eq('user_id', user.id)
        .limit(1);

      if (error) throw error;

      const hasConfig = data && data.length > 0;
      setHasConfiguration(hasConfig);
      setIsConnected(hasConfig && data[0].is_active);
    } catch (error) {
      console.error('Error checking configuration:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  const handleConfigurationSaved = () => {
    checkConfiguration();
    toast({
      title: "Configuration saved",
      description: "Your Veeva CTMS connection has been configured successfully.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onSuccess={() => {}} />;
  }

  if (!hasConfiguration) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-4">
                Welcome to Veeva Connect Hub
              </h1>
              <p className="text-lg text-muted-foreground">
                To get started, please configure your Veeva CTMS connection.
              </p>
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <VeevaConfigurationDialog onConfigurationSaved={handleConfigurationSaved} />
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
          
          <div className="flex items-center gap-3">
            <VeevaConfigurationDialog onConfigurationSaved={handleConfigurationSaved} />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
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
