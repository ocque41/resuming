import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Building, MapPin, Calendar, Tag, FileText, Briefcase } from 'lucide-react';
import { DocumentEntity } from './types';

interface AnalysisEntitiesProps {
  entities?: DocumentEntity[];
}

export default function AnalysisEntities({ entities = [] }: AnalysisEntitiesProps) {
  if (!entities || entities.length === 0) {
    return null;
  }

  // Function to get icon based on entity type
  const getEntityIcon = (type: string) => {
    const iconClassName = "h-4 w-4 text-[#B4916C]";
    type = type.toUpperCase();
    
    switch (type) {
      case 'PERSON':
      case 'PEOPLE':
        return <User className={iconClassName} />;
      case 'ORGANIZATION':
      case 'COMPANY':
        return <Building className={iconClassName} />;
      case 'LOCATION':
      case 'PLACE':
        return <MapPin className={iconClassName} />;
      case 'DATE':
      case 'TIME':
        return <Calendar className={iconClassName} />;
      case 'DOCUMENT':
        return <FileText className={iconClassName} />;
      case 'WORK_OF_ART':
      case 'PROJECT':
        return <Briefcase className={iconClassName} />;
      default:
        return <Tag className={iconClassName} />;
    }
  };

  // Function to get background color based on entity type
  const getEntityBgColor = (type: string) => {
    type = type.toUpperCase();
    
    switch (type) {
      case 'PERSON':
      case 'PEOPLE':
        return 'bg-[#334155]'; // Slate
      case 'ORGANIZATION':
      case 'COMPANY':
        return 'bg-[#1e293b]'; // Slate darker
      case 'LOCATION':
      case 'PLACE':
        return 'bg-[#0f172a]'; // Slate darkest
      case 'DATE':
      case 'TIME':
        return 'bg-[#262626]'; // Neutral
      case 'DOCUMENT':
        return 'bg-[#2d2117]'; // Brown-ish
      case 'WORK_OF_ART':
      case 'PROJECT':
        return 'bg-[#1a2e35]'; // Cyan-ish dark
      default:
        return 'bg-[#171717]'; // Neutral darker
    }
  };

  // Function to get display label for entity types
  const getEntityTypeLabel = (type: string): string => {
    type = type.toUpperCase();
    
    switch (type) {
      case 'PERSON':
        return 'People';
      case 'ORGANIZATION':
        return 'Organizations';
      case 'LOCATION':
        return 'Locations';
      case 'DATE':
        return 'Dates';
      case 'DOCUMENT':
        return 'Documents';
      case 'WORK_OF_ART':
        return 'Projects';
      default:
        // Make plural by appending 's' and capitalize first letter
        return type.charAt(0) + type.slice(1).toLowerCase() + 's';
    }
  };

  // Group entities by type
  const entityGroups = entities.reduce((groups, entity) => {
    // Ensure type is a string and not undefined
    const type = (entity.type || 'Unknown').toString();
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(entity);
    return groups;
  }, {} as Record<string, DocumentEntity[]>);

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
      <CardHeader className="bg-[#0A0A0A] border-b border-[#222222]">
        <CardTitle className="text-lg font-medium text-[#F9F6EE]">
          Key Entities
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <div className="space-y-4">
          {Object.entries(entityGroups).map(([type, entitiesOfType]) => (
            <div key={type} className="space-y-2">
              <h3 className="text-[#E2DFD7] text-sm font-medium flex items-center gap-2">
                {getEntityIcon(type)}
                <span>{getEntityTypeLabel(type)}</span>
                <span className="text-[#8A8782] text-xs">({entitiesOfType.length})</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {entitiesOfType.map((entity, index) => {
                  // Get either mentions or count, whichever is available
                  const occurrences = entity.mentions || entity.count;
                  
                  return (
                    <div 
                      key={`${entity.name}-${index}`} 
                      className={`${getEntityBgColor(type)} px-3 py-1.5 rounded-lg border border-[#333333] flex items-center gap-2`}
                    >
                      <span className="text-[#E2DFD7] text-sm">{entity.name}</span>
                      {occurrences && (
                        <span className="text-[#8A8782] text-xs bg-[#222222] px-1.5 py-0.5 rounded-full">
                          {occurrences}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 