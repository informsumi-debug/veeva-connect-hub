import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Circle, Settings, Globe, User } from "lucide-react";

interface Configuration {
  id: string;
  configuration_name: string;
  environment_name: string;
  veeva_url: string;
  username: string;
  is_active: boolean;
  created_at: string;
  last_sync: string | null;
}

interface VeevaConfigurationSelectorProps {
  onConfigurationSelected: () => void;
}

const VeevaConfigurationSelector = ({ onConfigurationSelected }: VeevaConfigurationSelectorProps) => {
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('veeva_configurations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigurations(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateConfiguration = async (configId: string) => {
    try {
      setActivating(configId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Deactivate all configurations first
      await supabase
        .from('veeva_configurations')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Activate the selected configuration
      const { error } = await supabase
        .from('veeva_configurations')
        .update({ is_active: true })
        .eq('id', configId);

      if (error) throw error;

      toast({
        title: "Configuration activated",
        description: "Successfully switched to the selected configuration.",
      });

      // Refresh configurations and notify parent
      await fetchConfigurations();
      onConfigurationSelected();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to activate configuration",
        variant: "destructive",
      });
    } finally {
      setActivating(null);
    }
  };

  const getEnvironmentColor = (env: string) => {
    switch (env.toLowerCase()) {
      case 'production': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'sandbox': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'validation': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'development': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">Select Your Veeva Environment</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which Veeva CTMS configuration to use for syncing data
        </p>
      </div>

      {configurations.map((config) => (
        <Card 
          key={config.id} 
          className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
            config.is_active ? 'ring-2 ring-primary' : ''
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {config.is_active ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-base">{config.configuration_name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge className={getEnvironmentColor(config.environment_name)}>
                      {config.environment_name}
                    </Badge>
                    {config.is_active && (
                      <Badge variant="outline" className="text-primary border-primary">
                        Active
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant={config.is_active ? "default" : "outline"}
                size="sm"
                disabled={activating === config.id}
                onClick={() => handleActivateConfiguration(config.id)}
              >
                {activating === config.id ? "Activating..." : config.is_active ? "Active" : "Select"}
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span className="truncate">{config.veeva_url}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{config.username}</span>
              </div>
              {config.last_sync && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  <span>Last sync: {new Date(config.last_sync).toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default VeevaConfigurationSelector;