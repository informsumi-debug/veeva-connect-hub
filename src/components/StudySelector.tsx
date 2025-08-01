import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"

interface Study {
  id: string
  study_id: string
  study_name: string
  phase?: string
  status?: string
}

interface StudySelectorProps {
  onStudySelect: (studyId: string) => void
  selectedStudy?: string
}

const StudySelector = ({ onStudySelect, selectedStudy }: StudySelectorProps) => {
  const [studies, setStudies] = useState<Study[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchStudies = async () => {
    try {
      setIsLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get active configuration
      const { data: configData } = await supabase
        .from('veeva_configurations')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (!configData) return

      // Fetch studies
      const { data: studiesData, error } = await supabase
        .from('study_data')
        .select('*')
        .eq('configuration_id', configData.id)
        .order('study_name')

      if (error) {
        console.error('Error fetching studies:', error)
        return
      }

      setStudies(studiesData || [])
    } catch (error) {
      console.error('Error in fetchStudies:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStudies()
  }, [])

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-success/10 text-success border-success/20'
      case 'completed':
        return 'bg-primary/10 text-primary border-primary/20'
      case 'on_hold':
      case 'suspended':
        return 'bg-warning/10 text-warning border-warning/20'
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20'
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Select Study</label>
      <Select 
        value={selectedStudy} 
        onValueChange={onStudySelect}
        disabled={isLoading || studies.length === 0}
      >
        <SelectTrigger className="w-full bg-background border-border">
          <SelectValue 
            placeholder={
              isLoading 
                ? "Loading studies..." 
                : studies.length === 0 
                  ? "No studies found - try syncing first"
                  : "Choose a study..."
            } 
          />
        </SelectTrigger>
        <SelectContent className="bg-background border-border shadow-lg z-50">
          {studies.map((study) => (
            <SelectItem 
              key={study.id} 
              value={study.study_id}
              className="hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col items-start">
                  <span className="font-medium">{study.study_name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{study.study_id}</span>
                    {study.phase && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Phase {study.phase}
                      </Badge>
                    )}
                    {study.status && (
                      <Badge className={`text-xs px-1 py-0 ${getStatusColor(study.status)}`}>
                        {study.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {studies.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {studies.length} study{studies.length !== 1 ? 'ies' : ''} available
        </p>
      )}
    </div>
  )
}

export default StudySelector