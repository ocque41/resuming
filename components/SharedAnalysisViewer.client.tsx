"use client";

import { Tabs, Card, Progress, Collapse } from "antd";
import { 
  PieChart, 
  Pie, 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { useState } from "react";

const { Panel } = Collapse;
const { TabPane } = Tabs;

// Color palette for charts
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

interface SharedAnalysisViewerProps {
  analysis: any;
}

export default function SharedAnalysisViewer({ analysis }: SharedAnalysisViewerProps) {
  const [activeKey, setActiveKey] = useState("1");
  
  // Extract analysis data from JSON structure if needed
  const contentAnalysis = analysis.contentAnalysis || analysis.rawAnalysisResponse?.contentAnalysis;
  const sentimentAnalysis = analysis.sentimentAnalysis || analysis.rawAnalysisResponse?.sentimentAnalysis;
  const keyInformation = analysis.keyInformation || analysis.rawAnalysisResponse?.keyInformation;
  const summary = analysis.summary || analysis.rawAnalysisResponse?.summary;
  
  // Overall score from analysis
  const overallScore = summary?.overallScore || 0;
  
  return (
    <div className="shared-analysis-viewer">
      {/* Score overview at the top */}
      <div className="mb-6 flex items-center justify-center">
        <div className="text-center p-6 bg-gray-50 rounded-lg shadow-sm w-full max-w-md mx-auto">
          <h2 className="text-xl font-bold mb-2">Overall Document Score</h2>
          <div className="flex justify-center mb-2">
            <Progress
              type="circle"
              percent={overallScore}
              format={(percent) => `${percent}`}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              width={120}
            />
          </div>
          <p className="text-gray-600">
            {overallScore >= 80 
              ? "Excellent document quality" 
              : overallScore >= 60 
                ? "Good document with some improvement areas" 
                : "Several improvement opportunities identified"}
          </p>
        </div>
      </div>
      
      {/* Tabs for different analysis sections */}
      <Tabs 
        activeKey={activeKey} 
        onChange={setActiveKey} 
        type="card"
        className="analysis-tabs"
      >
        {/* Summary Tab */}
        <TabPane tab="Summary" key="1">
          <Card title="Document Analysis Summary" className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold mb-3">Key Highlights</h3>
                <ul className="list-disc pl-5">
                  {summary?.highlights?.map((highlight: string, index: number) => (
                    <li key={`highlight-${index}`} className="mb-2">
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-bold mb-3">Improvement Suggestions</h3>
                <ul className="list-disc pl-5">
                  {summary?.suggestions?.map((suggestion: string, index: number) => (
                    <li key={`suggestion-${index}`} className="mb-2">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </TabPane>
        
        {/* Content Analysis Tab */}
        <TabPane tab="Content Analysis" key="2">
          <Card title="Content Distribution" className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={contentAnalysis?.contentDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {contentAnalysis?.contentDistribution?.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div>
                <h3 className="text-lg font-bold mb-3">Content Breakdown</h3>
                <ul className="space-y-4">
                  {contentAnalysis?.contentDistribution?.map((item: any, index: number) => (
                    <li key={`content-${index}`}>
                      <div className="flex justify-between mb-1">
                        <span>{item.name}</span>
                        <span className="font-bold">{item.value}%</span>
                      </div>
                      <Progress 
                        percent={item.value} 
                        showInfo={false} 
                        strokeColor={COLORS[index % COLORS.length]} 
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
          
          <Card title="Top Keywords">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={contentAnalysis?.topKeywords || []}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="text" />
                <YAxis label={{ value: 'Relevance Score', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Relevance Score" fill="#8884d8">
                  {contentAnalysis?.topKeywords?.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabPane>
        
        {/* Sentiment Analysis Tab */}
        <TabPane tab="Sentiment Analysis" key="3">
          <Card title="Overall Sentiment" className="mb-4">
            <div className="flex justify-center mb-6">
              <Progress
                type="dashboard"
                percent={Math.round((sentimentAnalysis?.overallScore || 0) * 100)}
                format={(percent) => `${percent}%`}
                strokeColor={{
                  '0%': '#ff4d4f',
                  '50%': '#faad14',
                  '100%': '#52c41a',
                }}
              />
            </div>
            
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold mb-1">
                {(sentimentAnalysis?.overallScore || 0) >= 0.8 
                  ? "Very Positive" 
                  : (sentimentAnalysis?.overallScore || 0) >= 0.6 
                    ? "Positive" 
                    : (sentimentAnalysis?.overallScore || 0) >= 0.4 
                      ? "Neutral" 
                      : "Needs Improvement"}
              </h3>
              <p className="text-gray-600">
                {(sentimentAnalysis?.overallScore || 0) >= 0.7 
                  ? "Your document uses strong, positive language that effectively communicates achievements and skills." 
                  : (sentimentAnalysis?.overallScore || 0) >= 0.5 
                    ? "Your document has a positive tone but could be strengthened with more confident language." 
                    : "Consider revising to use more achievement-oriented and positive language."}
              </p>
            </div>
          </Card>
          
          <Card title="Sentiment by Section">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={sentimentAnalysis?.sentimentBySection || []}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                <YAxis dataKey="section" type="category" width={150} />
                <Tooltip formatter={(value) => `${(Number(value) * 100).toFixed(0)}%`} />
                <Legend />
                <Bar dataKey="score" name="Sentiment Score" fill="#8884d8">
                  {sentimentAnalysis?.sentimentBySection?.map((entry: any) => (
                    <Cell 
                      key={`cell-${entry.section}`} 
                      fill={
                        entry.score >= 0.8 ? "#52c41a" : 
                        entry.score >= 0.6 ? "#85d13a" : 
                        entry.score >= 0.4 ? "#faad14" : 
                        "#ff4d4f"
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabPane>
        
        {/* Key Information Tab */}
        <TabPane tab="Key Information" key="4">
          <div className="grid grid-cols-1 gap-4">
            {/* Contact Information */}
            <Card title="Contact Information">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {keyInformation?.contactInfo?.map((item: any, index: number) => (
                    <tr key={`contact-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {(!keyInformation?.contactInfo || keyInformation.contactInfo.length === 0) && (
                <p className="text-gray-500 p-4 text-center">No contact information detected</p>
              )}
            </Card>
            
            {/* Key Dates */}
            <Card title="Key Dates">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {keyInformation?.keyDates?.map((item: any, index: number) => (
                    <tr key={`date-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {(!keyInformation?.keyDates || keyInformation.keyDates.length === 0) && (
                <p className="text-gray-500 p-4 text-center">No key dates detected</p>
              )}
            </Card>
            
            {/* Entities */}
            <Card title="Top Entities">
              {keyInformation?.entities && keyInformation.entities.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={keyInformation.entities.slice(0, 8)}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
                    <Radar name="Occurrences" dataKey="occurrences" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    <Tooltip />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 p-4 text-center">No significant entities detected</p>
              )}
            </Card>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
} 