import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Settings, Globe, User, Trash2, Calendar, Database, Circle, Plus } from "lucide-react";

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
  onConfigurationDeleted?: () => void;
  onConfigurationSelected?: () => void;
  onAddNew?: () => void;
}

const VeevaConfigurationSelector = ({ onConfigurationDeleted, onConfigurationSelected, onAddNew }: VeevaConfigurationSelectorProps) => {
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  const handleSelectConfiguration = async (configurationId: string) => {
    setActionLoading(configurationId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // First deactivate all configurations
      await supabase
        .from('veeva_configurations')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Then activate the selected one
      const { error } = await supabase
        .from('veeva_configurations')
        .update({ is_active: true })
        .eq('id', configurationId);

      if (error) throw error;

      toast({
        title: "Configuration activated",
        description: "This configuration is now active and will be used for Veeva sync",
      });

      await fetchConfigurations();
      onConfigurationSelected?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to activate configuration",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfiguration = async (configurationId: string) => {
    setActionLoading(configurationId);
    try {
      const { error } = await supabase
        .from('veeva_configurations')
        .delete()
        .eq('id', configurationId);

      if (error) throw error;

      toast({
        title: "Configuration deleted",
        description: "The configuration has been removed successfully",
      });

      await fetchConfigurations();
      
      // If no configurations left, call the callback
      const remainingConfigs = configurations.filter(c => c.id !== configurationId);
      if (remainingConfigs.length === 0) {
        onConfigurationDeleted?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete configuration",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
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
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (configurations.length === 0) {
    return (
      <div className="text-center py-8">
        <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Configurations Found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          No Veeva CTMS configurations found. Please create a new configuration.
        </p>
        <Button onClick={onAddNew} variant="clinical" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Configuration
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">Select Active Configuration</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which configuration to use for Veeva CTMS synchronization
        </p>
      </div>

      {configurations.map((config) => (
        <Card key={config.id} className={`transition-all ${config.is_active ? 'border-2 border-primary shadow-md' : 'hover:shadow-sm'}`}>
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
              
              <div className="flex items-center gap-2">
                {!config.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectConfiguration(config.id)}
                    disabled={actionLoading === config.id}
                    className="gap-2"
                  >
                    {actionLoading === config.id ? "Activating..." : "Activate"}
                  </Button>
                )}
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete the configuration "{config.configuration_name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteConfiguration(config.id)}
                        disabled={actionLoading === config.id}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {actionLoading === config.id ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4 flex-shrink-0" />
                <span className="break-all">{config.veeva_url}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 flex-shrink-0" />
                <span>{config.username}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>Created: {new Date(config.created_at).toLocaleDateString()}</span>
              </div>
              {config.last_sync && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Settings className="h-4 w-4 flex-shrink-0" />
                  <span>Last sync: {new Date(config.last_sync).toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      
      <div className="mt-6 text-center">
        <Button onClick={onAddNew} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Add New Configuration
        </Button>
      </div>
    </div>
  );
};

export default VeevaConfigurationSelector;