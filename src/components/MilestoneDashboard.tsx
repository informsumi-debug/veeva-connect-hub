import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Filter, RefreshCw, Loader2 } from "lucide-react"
import MilestoneCard from "./MilestoneCard"
import StudySelector from "./StudySelector"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Milestone {
  id: string
  title: string
  study_id: string
  site_id?: string
  milestone_type: string
  status: string
  due_date?: string
  planned_finish_date?: string
  baseline_finish_date?: string
  actual_finish_date?: string
  progress: number
  assigned_to?: string
  priority: string
}

interface Study {
  id: string
  study_id: string
  study_name: string
  phase?: string
  status?: string
}

const MilestoneDashboard = () => {
  const [studyMilestones, setStudyMilestones] = useState<Milestone[]>([])
  const [siteMilestones, setSiteMilestones] = useState<Milestone[]>([])
  const [studies, setStudies] = useState<Study[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStudy, setSelectedStudy] = useState<string>("")
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      setIsLoading(true)
      
      // Get user's active configuration
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Fetch studies
      const { data: studiesData, error: studiesError } = await supabase
        .from('study_data')
        .select('*')
        .eq('configuration_id', await getActiveConfigurationId())

      if (studiesError) throw studiesError

      // Fetch milestones
      const { data: milestonesData, error: milestonesError } = await supabase
        .from('milestone_data')
        .select('*')
        .eq('configuration_id', await getActiveConfigurationId())

      if (milestonesError) throw milestonesError

      setStudies(studiesData || [])
      
      // Separate study and site milestones
      const studyMiles = milestonesData?.filter(m => m.milestone_type === 'study') || []
      const siteMiles = milestonesData?.filter(m => m.milestone_type === 'site') || []
      
      setStudyMilestones(studyMiles)
      setSiteMilestones(siteMiles)
      
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Failed to fetch milestone data",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getActiveConfigurationId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('veeva_configurations')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (error || !data) throw new Error('No active configuration found')
    return data.id
  }

  const handleSync = async () => {
    try {
      setIsSyncing(true)
      
      const configId = await getActiveConfigurationId()
      
      const { data, error } = await supabase.functions.invoke('veeva-sync-data', {
        body: { configurationId: configId }
      })

      if (error) throw error

      toast({
        title: "Sync Complete",
        description: `Synchronized ${data.studiesCount} studies and ${data.milestonesCount} milestones`,
      })

      // Refresh data after sync
      await fetchData()
      
    } catch (error) {
      console.error('Sync error:', error)
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync with Veeva",
        variant: "destructive"
      })
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatMilestone = (milestone: Milestone) => ({
    title: milestone.title,
    studyId: milestone.study_id,
    siteName: milestone.site_id ? `Site ${milestone.site_id}` : undefined,
    status: milestone.status.toLowerCase() as "pending" | "completed" | "overdue",
    dueDate: milestone.due_date || "N/A",
    plannedFinishDate: milestone.planned_finish_date,
    baselineFinishDate: milestone.baseline_finish_date,
    actualFinishDate: milestone.actual_finish_date,
    progress: milestone.progress,
    assignedTo: milestone.assigned_to || "Unassigned",
    priority: milestone.priority as "high" | "medium" | "low"
  })

  const filterMilestones = (milestones: Milestone[]) => {
    let filtered = milestones

    // Filter by selected study
    if (selectedStudy) {
      filtered = filtered.filter(milestone => milestone.study_id === selectedStudy)
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(milestone =>
        milestone.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        milestone.study_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        milestone.assigned_to?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading milestones...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Milestone Tracking</h2>
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {isSyncing ? 'Syncing...' : 'Sync with Veeva'}
        </Button>
      </div>

      {/* Study Selector and Search/Filter Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StudySelector 
          onStudySelect={setSelectedStudy}
          selectedStudy={selectedStudy}
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search milestones..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          {selectedStudy && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedStudy("")}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="study" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="study">
            Study Milestones ({filterMilestones(studyMilestones).length})
          </TabsTrigger>
          <TabsTrigger value="site">
            Site Milestones ({filterMilestones(siteMilestones).length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="study" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filterMilestones(studyMilestones).map((milestone) => (
              <MilestoneCard key={milestone.id} {...formatMilestone(milestone)} />
            ))}
          </div>
          {filterMilestones(studyMilestones).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No study milestones found. Click "Sync with Veeva" to fetch data.
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="site" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filterMilestones(siteMilestones).map((milestone) => (
              <MilestoneCard key={milestone.id} {...formatMilestone(milestone)} />
            ))}
          </div>
          {filterMilestones(siteMilestones).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No site milestones found. Click "Sync with Veeva" to fetch data.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default MilestoneDashboard