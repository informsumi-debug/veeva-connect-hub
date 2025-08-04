import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Settings, Globe, User, Trash2, Calendar, Database } from "lucide-react";

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
}

const VeevaConfigurationSelector = ({ onConfigurationDeleted }: VeevaConfigurationSelectorProps) => {
  const [activeConfiguration, setActiveConfiguration] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchActiveConfiguration();
  }, []);

  const fetchActiveConfiguration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('veeva_configurations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setActiveConfiguration(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load active configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfiguration = async () => {
    if (!activeConfiguration) return;

    try {
      setDeleting(true);

      // Delete the configuration
      const { error } = await supabase
        .from('veeva_configurations')
        .delete()
        .eq('id', activeConfiguration.id);

      if (error) throw error;

      toast({
        title: "Configuration deleted",
        description: "Your Veeva CTMS configuration has been removed successfully.",
      });

      setActiveConfiguration(null);
      onConfigurationDeleted?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete configuration",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
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

  if (!activeConfiguration) {
    return (
      <div className="text-center py-8">
        <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Active Configuration</h3>
        <p className="text-sm text-muted-foreground">
          No active Veeva CTMS configuration found. Please create a new configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">Active Veeva Configuration</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your current active Veeva CTMS configuration
        </p>
      </div>

      <Card className="border-2 border-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">{activeConfiguration.configuration_name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge className={getEnvironmentColor(activeConfiguration.environment_name)}>
                    {activeConfiguration.environment_name}
                  </Badge>
                  <Badge variant="outline" className="text-primary border-primary">
                    Active
                  </Badge>
                </CardDescription>
              </div>
            </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this Veeva CTMS configuration? This action cannot be undone and you will need to reconfigure your connection.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteConfiguration}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4 flex-shrink-0" />
              <span className="break-all">{activeConfiguration.veeva_url}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 flex-shrink-0" />
              <span>{activeConfiguration.username}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>Created: {new Date(activeConfiguration.created_at).toLocaleDateString()}</span>
            </div>
            {activeConfiguration.last_sync && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Settings className="h-4 w-4 flex-shrink-0" />
                <span>Last sync: {new Date(activeConfiguration.last_sync).toLocaleString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VeevaConfigurationSelector;