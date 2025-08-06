import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Plus, Globe, User, Key, Database, Trash2, CheckCircle, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

interface VeevaConfigurationDialogProps {
  onConfigurationSaved: () => void;
}

const VeevaConfigurationDialog = ({ onConfigurationSaved }: VeevaConfigurationDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    configurationName: "",
    environmentName: "",
    veevaUrl: "",
    username: "",
    password: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && !showForm) {
      fetchConfigurations();
    }
  }, [isOpen, showForm]);

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
      
      // Find the currently active configuration
      const activeConfig = data?.find(config => config.is_active);
      if (activeConfig) {
        setSelectedConfigId(activeConfig.id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load configurations",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Check if configuration with same environment, URL, and username already exists
      const { data: existingConfigs } = await supabase
        .from('veeva_configurations')
        .select('id')
        .eq('user_id', user.id)
        .eq('environment_name', formData.environmentName)
        .eq('veeva_url', formData.veevaUrl)
        .eq('username', formData.username);

      if (existingConfigs && existingConfigs.length > 0) {
        throw new Error('A configuration with this environment, URL, and username combination already exists');
      }

      // Test connection and authenticate first
      const { data: authData, error: authError } = await supabase.functions.invoke('veeva-authenticate', {
        body: {
          veevaUrl: formData.veevaUrl,
          username: formData.username,
          password: formData.password,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (authError || !authData?.success) {
        throw new Error(authData?.error || 'Failed to authenticate with Veeva CTMS');
      }

      // Save new configuration as inactive initially
      const { data: newConfig, error } = await supabase
        .from('veeva_configurations')
        .insert({
          user_id: user.id,
          configuration_name: formData.configurationName,
          environment_name: formData.environmentName,
          veeva_url: formData.veevaUrl,
          username: formData.username,
          is_active: false,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: "Configuration saved!",
        description: "Successfully connected to Veeva CTMS. Please select it from the list to activate.",
      });

      setFormData({
        configurationName: "",
        environmentName: "",
        veevaUrl: "",
        username: "",
        password: "",
      });
      
      // Return to configuration grid view
      setShowForm(false);
      await fetchConfigurations();
    } catch (error: any) {
      toast({
        title: "Configuration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

      setSelectedConfigId(configurationId);
      
      toast({
        title: "Configuration activated",
        description: "This configuration is now active and will be used for Veeva sync",
      });

      await fetchConfigurations();
      setIsOpen(false);
      onConfigurationSaved();
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="clinical" className="gap-2">
          <Settings className="h-4 w-4" />
          Configure Veeva CTMS
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        {!showForm ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Veeva CTMS Configurations
              </DialogTitle>
              <DialogDescription>
                Select a configuration for Veeva synchronization. Only one configuration can be active at a time.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {configurations.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Configurations Found</h3>
                  <p className="text-sm text-muted-foreground">
                    No Veeva CTMS configurations found. Please create a new configuration.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {configurations.map((config) => (
                    <Card 
                      key={config.id} 
                      className={`cursor-pointer transition-all ${
                        selectedConfigId === config.id 
                          ? 'border-2 border-primary shadow-md ring-2 ring-primary/20' 
                          : 'hover:shadow-sm border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedConfigId(config.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {selectedConfigId === config.id ? (
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
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Globe className="h-4 w-4 flex-shrink-0" />
                            <span className="break-all text-xs">{config.veeva_url}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4 flex-shrink-0" />
                            <span className="text-xs">{config.username}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowForm(true)} 
                  variant="clinical" 
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  ADD
                </Button>
                
                {selectedConfigId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        DELETE
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this configuration? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => selectedConfigId && handleDeleteConfiguration(selectedConfigId)}
                          disabled={actionLoading === selectedConfigId}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {actionLoading === selectedConfigId ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                >
                  CANCEL
                </Button>
                {selectedConfigId && (
                  <Button 
                    onClick={() => handleSelectConfiguration(selectedConfigId)} 
                    disabled={actionLoading === selectedConfigId}
                    variant="clinical"
                  >
                    {actionLoading === selectedConfigId ? "Activating..." : "SELECT"}
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Veeva CTMS Configuration
              </DialogTitle>
              <DialogDescription>
                Configure your connection to Veeva CTMS to sync study and milestone data.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="configurationName">Configuration Name</Label>
                <div className="relative">
                  <Plus className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="configurationName"
                    placeholder="e.g., Production Environment"
                    value={formData.configurationName}
                    onChange={(e) => handleInputChange('configurationName', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="environmentName">Environment</Label>
                <Select 
                  value={formData.environmentName} 
                  onValueChange={(value) => handleInputChange('environmentName', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="validation">Validation</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="veevaUrl">Veeva CTMS URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="veevaUrl"
                    type="url"
                    placeholder="https://your-instance.veevavault.com"
                    value={formData.veevaUrl}
                    onChange={(e) => handleInputChange('veevaUrl', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your Veeva CTMS instance URL (e.g., https://company.veevavault.com)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="Your Veeva CTMS username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your Veeva CTMS password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your credentials are encrypted and stored securely
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="clinical"
                  disabled={isLoading}
                >
                  {isLoading ? "Testing Connection..." : "Save & Test Connection"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VeevaConfigurationDialog;