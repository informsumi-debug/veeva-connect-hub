import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import VeevaConfigurationSelector from "./VeevaConfigurationSelector";
import { Settings, Plus, Globe, User, Key, Database } from "lucide-react";

interface VeevaConfigurationDialogProps {
  onConfigurationSaved: () => void;
}

const VeevaConfigurationDialog = ({ onConfigurationSaved }: VeevaConfigurationDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [formData, setFormData] = useState({
    configurationName: "",
    environmentName: "",
    veevaUrl: "",
    username: "",
    password: "",
  });
  const { toast } = useToast();

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

      // Save new configuration as inactive initially
      const { data: newConfig, error } = await supabase
        .from('veeva_configurations')
        .insert({
          user_id: user.id,
          configuration_name: formData.configurationName,
          environment_name: formData.environmentName,
          veeva_url: formData.veevaUrl,
          username: formData.username,
          is_active: false, // Don't activate until user selects it
        })
        .select('id')
        .single();

      if (error) throw error;

      // Test connection and authenticate
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

      toast({
        title: "Configuration saved!",
        description: "Successfully connected to Veeva CTMS.",
      });

      setFormData({
        configurationName: "",
        environmentName: "",
        veevaUrl: "",
        username: "",
        password: "",
      });
      
      // Show configuration selector after successful save
      setShowSelector(true);
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfigurationSelected = () => {
    setShowSelector(false);
    setIsOpen(false);
    onConfigurationSaved();
  };

  const handleConfigurationDeleted = () => {
    // Don't close automatically on delete, let user see remaining configs
    // Only close if no configs remain
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="clinical" className="gap-2">
          <Settings className="h-4 w-4" />
          Configure Veeva CTMS
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px]">
        {showSelector ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Select Configuration
              </DialogTitle>
              <DialogDescription>
                Choose which configuration to activate for Veeva synchronization. The selected configuration will be used to get session ID and sync data.
              </DialogDescription>
            </DialogHeader>
            <VeevaConfigurationSelector 
              onConfigurationSelected={handleConfigurationSelected}
              onConfigurationDeleted={handleConfigurationDeleted} 
            />
            <div className="flex justify-end pt-4">
              <Button onClick={() => setIsOpen(false)}>
                Close
              </Button>
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
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
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