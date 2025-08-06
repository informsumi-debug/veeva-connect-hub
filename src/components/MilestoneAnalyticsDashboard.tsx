import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, TrendingUp, TrendingDown, Clock } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Study {
  id: string
  study_id: string
  study_name: string
  phase?: string
  status?: string
}

interface MilestoneAnalysis {
  id: string
  title: string
  study_id: string
  site_id?: string
  study_name: string
  site_number?: string
  country?: string
  planned_finish_date?: string
  actual_finish_date?: string
  status: string
  progress: number
  milestone_type: string
  is_overdue: boolean
  days_overdue?: number
  risk_score: number
  risk_factors: string[]
}

const MilestoneAnalyticsDashboard = () => {
  const [studies, setStudies] = useState<Study[]>([])
  const [selectedStudy, setSelectedStudy] = useState<string>("")
  const [milestoneAnalytics, setMilestoneAnalytics] = useState<MilestoneAnalysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      setIsLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const configId = await getActiveConfigurationId()

      // Fetch studies
      const { data: studiesData, error: studiesError } = await supabase
        .from('study_data')
        .select('*')
        .eq('configuration_id', configId)

      if (studiesError) throw studiesError

      // Fetch milestone data for analysis
      const { data: milestonesData, error: milestonesError } = await supabase
        .from('milestone_data')
        .select('*')
        .eq('configuration_id', configId)
        .in('title', ['First Subject In', 'Last Subject In', 'Study Site Activation', 'Site Activation'])

      if (milestonesError) throw milestonesError

      setStudies(studiesData || [])
      
      // Process milestone analytics
      const analytics = milestonesData?.map(milestone => {
        const today = new Date()
        const plannedDate = milestone.planned_finish_date ? new Date(milestone.planned_finish_date) : null
        const actualDate = milestone.actual_finish_date ? new Date(milestone.actual_finish_date) : null
        
        let isOverdue = false
        let daysOverdue = 0
        
        if (plannedDate && !actualDate && plannedDate < today) {
          isOverdue = true
          daysOverdue = Math.floor((today.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24))
        }

        // Calculate risk score based on multiple factors
        let riskScore = 0
        const riskFactors: string[] = []

        if (isOverdue) {
          riskScore += Math.min(daysOverdue * 2, 40) // Max 40 points for overdue
          riskFactors.push(`${daysOverdue} days overdue`)
        }

        if (milestone.progress < 50 && plannedDate) {
          const daysToDeadline = Math.floor((plannedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (daysToDeadline <= 30 && daysToDeadline > 0) {
            riskScore += 30
            riskFactors.push('Low progress with approaching deadline')
          }
        }

        if (milestone.status === 'at_risk') {
          riskScore += 25
          riskFactors.push('Marked as at risk')
        }

        if (!milestone.assigned_to) {
          riskScore += 15
          riskFactors.push('No assigned owner')
        }

        // Find study name from studies data
        const studyName = studiesData?.find(s => s.study_id === milestone.study_id)?.study_name || milestone.study_id

        return {
          ...milestone,
          study_name: studyName,
          site_number: milestone.site_id || 'N/A',
          country: 'N/A', // Would need additional data mapping
          is_overdue: isOverdue,
          days_overdue: daysOverdue || undefined,
          risk_score: Math.min(riskScore, 100),
          risk_factors: riskFactors
        }
      }) || []

      setMilestoneAnalytics(analytics)
      
    } catch (error) {
      console.error('Error fetching analytics data:', error)
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
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
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('No active configuration found')
    return data.id
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredMilestones = selectedStudy 
    ? milestoneAnalytics.filter(m => m.study_id === selectedStudy)
    : milestoneAnalytics

  const overdueMilestones = filteredMilestones.filter(m => m.is_overdue)
  const highRiskMilestones = filteredMilestones.filter(m => m.risk_score >= 70)
  const averageRiskScore = filteredMilestones.length > 0 
    ? Math.round(filteredMilestones.reduce((sum, m) => sum + m.risk_score, 0) / filteredMilestones.length)
    : 0

  const getRiskBadge = (score: number) => {
    if (score >= 80) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Critical</Badge>
    if (score >= 60) return <Badge variant="secondary" className="gap-1"><TrendingUp className="h-3 w-3" />High</Badge>
    if (score >= 30) return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Medium</Badge>
    return <Badge variant="default" className="gap-1"><TrendingDown className="h-3 w-3" />Low</Badge>
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading analytics...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Milestone Analytics Dashboard</h2>
        <Button onClick={fetchData} variant="outline" size="sm">
          Refresh Data
        </Button>
      </div>

      {/* Study Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Study</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedStudy} onValueChange={setSelectedStudy}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a study to analyze" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Studies</SelectItem>
              {studies.map((study) => (
                <SelectItem key={study.id} value={study.study_id}>
                  {study.study_name} ({study.study_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredMilestones.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueMilestones.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{highRiskMilestones.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageRiskScore}</div>
            <Progress value={averageRiskScore} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="milestones" className="w-full">
        <TabsList>
          <TabsTrigger value="milestones">Milestone Details</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="milestones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Milestones by Study</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Study</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Planned Date</TableHead>
                    <TableHead>Actual Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMilestones.map((milestone) => (
                    <TableRow key={milestone.id}>
                      <TableCell className="font-medium">{milestone.study_name}</TableCell>
                      <TableCell>{milestone.site_number}</TableCell>
                      <TableCell>{milestone.title}</TableCell>
                      <TableCell>{formatDate(milestone.planned_finish_date)}</TableCell>
                      <TableCell>
                        {milestone.actual_finish_date ? (
                          <span className="text-green-600">{formatDate(milestone.actual_finish_date)}</span>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {milestone.is_overdue ? (
                          <Badge variant="destructive">Overdue ({milestone.days_overdue}d)</Badge>
                        ) : (
                          <Badge variant="outline">{milestone.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={milestone.progress} className="w-16" />
                          <span className="text-sm">{milestone.progress}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Site Risk Scoring</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Study</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Contributing Factors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMilestones
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .map((milestone) => (
                    <TableRow key={milestone.id}>
                      <TableCell className="font-medium">{milestone.study_name}</TableCell>
                      <TableCell>{milestone.site_number}</TableCell>
                      <TableCell>{milestone.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={milestone.risk_score} className="w-16" />
                          <span className="text-sm font-medium">{milestone.risk_score}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getRiskBadge(milestone.risk_score)}</TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {milestone.risk_factors.length > 0 
                            ? milestone.risk_factors.join(', ')
                            : 'No risk factors identified'
                          }
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default MilestoneAnalyticsDashboard