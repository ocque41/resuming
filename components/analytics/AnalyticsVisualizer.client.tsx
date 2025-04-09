"use client";

import { useState, useEffect } from "react";
import { Card, Progress, Tabs, Empty } from "antd";
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import { FeedbackStats, AnalysisQualityMetrics } from "@/lib/utils/analytics";

const { TabPane } = Tabs;

// Data visualization component for analysis quality metrics
export default function AnalyticsVisualizer() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<AnalysisQualityMetrics | null>(null);
  const [activeTab, setActiveTab] = useState("1");

  // Colors for charts
  const COLORS = ["#B4916C", "#696462", "#444444", "#333333", "#222222"];
  const GOLD_SCALE = ["#B4916C", "#A38563", "#92795A", "#816D51", "#705F48"];
  
  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/document/analyze/analytics');
        
        if (!response.ok) {
          throw new Error(`Error fetching analytics: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setFeedbackStats(data.data.feedbackStats);
          setQualityMetrics(data.data.qualityMetrics);
        } else {
          throw new Error(data.error || 'Unknown error fetching analytics data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics data');
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, []);

  // Format data for rating distribution pie chart
  const getRatingDistributionData = () => {
    if (!feedbackStats) return [];
    
    return Object.entries(feedbackStats.ratingDistribution).map(([rating, count]) => ({
      name: `${rating} Star${rating !== '1' ? 's' : ''}`,
      value: count
    }));
  };
  
  // Format data for document type chart
  const getDocTypeData = () => {
    if (!feedbackStats) return [];
    
    return Object.entries(feedbackStats.feedbackByDocumentType).map(([type, data]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1), // Capitalize first letter
      count: data.count,
      rating: Number(data.averageRating.toFixed(1))
    }));
  };
  
  // Format data for model performance comparison
  const getModelPerformanceData = () => {
    if (!qualityMetrics) return [];
    
    return Object.entries(qualityMetrics.modelPerformance).map(([model, data]) => ({
      name: model,
      accuracy: data.accuracy,
      responseTime: data.averageResponseTime,
      cost: data.costPerAnalysis
    }));
  };

  // Helper component for displaying empty state
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 bg-[#0F0F0F] rounded-md border border-[#222222]">
      <svg className="w-16 h-16 text-[#444444] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-[#F9F6EE]">No analytics data available yet</p>
      <p className="text-[#8A8782] text-sm mt-2">Data will appear as users provide feedback on document analysis</p>
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-t-transparent border-[#B4916C] rounded-full animate-spin mb-4"></div>
        <p className="text-[#F9F6EE]">Loading analytics data...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-[#171717] border border-[#333333] rounded-md text-center">
        <svg className="w-12 h-12 text-[#E57373] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-[#F9F6EE] text-lg font-medium mb-2">Error Loading Analytics</h3>
        <p className="text-[#C5C2BA]">{error}</p>
      </div>
    );
  }

  // Empty state - no data
  if (!feedbackStats || !qualityMetrics || feedbackStats.totalFeedbacks === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultActiveKey="1" activeKey={activeTab} onChange={setActiveTab} className="custom-tabs">
        <TabPane tab="Feedback Overview" key="1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-[#111111] border border-[#222222]">
              <div className="text-center">
                <div className="text-3xl font-safiro text-[#F9F6EE]">{feedbackStats.totalFeedbacks}</div>
                <div className="text-[#8A8782] mt-1">Total Feedbacks</div>
              </div>
            </Card>
            
            <Card className="bg-[#111111] border border-[#222222]">
              <div className="text-center">
                <div className="text-3xl font-safiro text-[#F9F6EE]">{feedbackStats.averageRating.toFixed(1)}/5</div>
                <div className="text-[#8A8782] mt-1">Average Rating</div>
              </div>
            </Card>
            
            <Card className="bg-[#111111] border border-[#222222]">
              <div className="text-center">
                <div className="text-3xl font-safiro text-[#F9F6EE]">{qualityMetrics.successRate.toFixed(0)}%</div>
                <div className="text-[#8A8782] mt-1">Success Rate</div>
              </div>
            </Card>
            
            <Card className="bg-[#111111] border border-[#222222]">
              <div className="text-center">
                <div className="text-3xl font-safiro text-[#F9F6EE]">{qualityMetrics.overallAccuracy.toFixed(0)}%</div>
                <div className="text-[#8A8782] mt-1">Overall Accuracy</div>
              </div>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Rating Distribution" className="bg-[#111111] border border-[#222222]">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getRatingDistributionData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {getRatingDistributionData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${value} feedbacks`, 'Count']}
                      contentStyle={{ backgroundColor: '#171717', borderColor: '#333333' }}
                      itemStyle={{ color: '#F9F6EE' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            
            <Card title="Monthly Rating Trend" className="bg-[#111111] border border-[#222222]">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={feedbackStats.monthlyAverageRatings.map(item => ({
                      month: item.month.substring(5), // Just show MM part
                      rating: item.averageRating
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                    <XAxis dataKey="month" stroke="#8A8782" />
                    <YAxis domain={[0, 5]} stroke="#8A8782" />
                    <Tooltip 
                      formatter={(value) => [`${Number(value).toFixed(1)}`, 'Average Rating']}
                      contentStyle={{ backgroundColor: '#171717', borderColor: '#333333' }}
                      itemStyle={{ color: '#F9F6EE' }}
                    />
                    <Line type="monotone" dataKey="rating" stroke="#B4916C" strokeWidth={2} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          
          <Card title="Recent Feedback" className="mt-6 bg-[#111111] border border-[#222222]">
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {feedbackStats.recentFeedbacks.map((feedback, index) => (
                <div key={index} className="p-3 bg-[#171717] rounded-lg border border-[#222222]">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center mb-1">
                        <span className="px-2 py-1 bg-[#111111] rounded-md text-xs text-[#B4916C] mr-2">
                          {feedback.analysisType}
                        </span>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-4 h-4 ${i < feedback.rating ? 'text-[#B4916C]' : 'text-[#333333]'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      {feedback.feedbackText && (
                        <p className="text-[#F9F6EE] text-sm">"{feedback.feedbackText}"</p>
                      )}
                    </div>
                    <span className="text-[#8A8782] text-xs">
                      {new Date(feedback.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {feedbackStats.recentFeedbacks.length === 0 && (
                <p className="text-center text-[#8A8782] py-6">No feedback data available</p>
              )}
            </div>
          </Card>
        </TabPane>
        
        <TabPane tab="Document Types" key="2">
          <Card className="bg-[#111111] border border-[#222222] mb-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getDocTypeData()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                  <XAxis dataKey="name" stroke="#8A8782" />
                  <YAxis yAxisId="left" orientation="left" stroke="#B4916C" />
                  <YAxis yAxisId="right" orientation="right" stroke="#8A8782" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#333333' }}
                    itemStyle={{ color: '#F9F6EE' }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" name="Number of Analyses" fill="#B4916C" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="rating" name="Average Rating" fill="#696462" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Type-Specific Accuracy" className="bg-[#111111] border border-[#222222]">
              <div className="space-y-4">
                {Object.entries(qualityMetrics.typeSpecificAccuracy).map(([type, accuracy]) => (
                  <div key={type}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#F9F6EE]">{type}</span>
                      <span className="text-[#B4916C]">{accuracy.toFixed(0)}%</span>
                    </div>
                    <Progress 
                      percent={Number(accuracy.toFixed(0))} 
                      showInfo={false}
                      strokeColor={{
                        '0%': '#B4916C',
                        '100%': '#8E714F',
                      }}
                      trailColor="#333333"
                    />
                  </div>
                ))}
                {Object.keys(qualityMetrics.typeSpecificAccuracy).length === 0 && (
                  <p className="text-center text-[#8A8782] py-4">No type-specific data available</p>
                )}
              </div>
            </Card>
            
            <Card title="Processing Times" className="bg-[#111111] border border-[#222222]">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#F9F6EE]">Average Analysis Time</span>
                    <span className="text-[#B4916C]">{qualityMetrics.averageAnalysisTime.toFixed(1)}s</span>
                  </div>
                  <Progress 
                    percent={Math.min(100, (qualityMetrics.averageAnalysisTime / 10) * 100)} 
                    showInfo={false}
                    strokeColor="#B4916C"
                    trailColor="#333333"
                  />
                </div>
                
                <div className="py-2 px-4 bg-[#0F0F0F] rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-[#F9F6EE]">Success Rate</span>
                    <span className="text-[#B4916C]">{qualityMetrics.successRate.toFixed(0)}%</span>
                  </div>
                </div>
                
                <div className="py-2 px-4 bg-[#0F0F0F] rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-[#F9F6EE]">Error Rate</span>
                    <span className="text-[#E57373]">{qualityMetrics.errorRate.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabPane>
        
        <TabPane tab="Model Performance" key="3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {Object.entries(qualityMetrics.modelPerformance).map(([model, data]) => (
              <Card key={model} className="bg-[#111111] border border-[#222222]">
                <h3 className="text-lg font-medium text-[#F9F6EE] mb-4">{model}</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#C5C2BA]">Accuracy</span>
                      <span className="text-[#B4916C]">{data.accuracy.toFixed(1)}%</span>
                    </div>
                    <Progress 
                      percent={data.accuracy} 
                      showInfo={false}
                      strokeColor="#B4916C"
                      trailColor="#333333"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#C5C2BA]">Response Time</span>
                      <span className="text-[#8A8782]">{data.averageResponseTime.toFixed(1)}s</span>
                    </div>
                    <Progress 
                      percent={(data.averageResponseTime / 10) * 100} 
                      showInfo={false}
                      strokeColor="#696462"
                      trailColor="#333333"
                    />
                  </div>
                  
                  <div className="py-2 px-3 bg-[#1A1A1A] rounded-md flex justify-between items-center">
                    <span className="text-[#C5C2BA]">Cost per Analysis</span>
                    <span className="text-[#F9F6EE]">${(data.costPerAnalysis / 100).toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          <Card title="Model Comparison" className="bg-[#111111] border border-[#222222]">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getModelPerformanceData()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                  <XAxis dataKey="name" stroke="#8A8782" />
                  <YAxis stroke="#8A8782" />
                  <Tooltip
                    formatter={(value, name) => {
                      // Convert value to number safely before using numerical operations
                      const numValue = typeof value === 'number' ? value : Number(value);
                      
                      if (name === 'accuracy') return [`${isNaN(numValue) ? 0 : numValue.toFixed(1)}%`, 'Accuracy'];
                      if (name === 'responseTime') return [`${isNaN(numValue) ? 0 : numValue.toFixed(1)}s`, 'Response Time'];
                      if (name === 'cost') return [`$${isNaN(numValue) ? 0 : (numValue / 100).toFixed(2)}`, 'Cost'];
                      return [value, name];
                    }}
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#333333' }}
                    itemStyle={{ color: '#F9F6EE' }}
                  />
                  <Legend />
                  <Bar dataKey="accuracy" name="Accuracy (%)" fill="#B4916C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="responseTime" name="Response Time (s)" fill="#696462" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="Cost (¢)" fill="#444444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
} 