import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Building, MapPin, Calendar, Tag } from 'lucide-react';
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
    
    switch (type.toLowerCase()) {
      case 'person':
      case 'people':
        return <User className={iconClassName} />;
      case 'organization':
      case 'company':
        return <Building className={iconClassName} />;
      case 'location':
      case 'place':
        return <MapPin className={iconClassName} />;
      case 'date':
      case 'time':
        return <Calendar className={iconClassName} />;
      default:
        return <Tag className={iconClassName} />;
    }
  };

  // Function to get background color based on entity type
  const getEntityBgColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'person':
      case 'people':
        return 'bg-[#334155]'; // Slate
      case 'organization':
      case 'company':
        return 'bg-[#1e293b]'; // Slate darker
      case 'location':
      case 'place':
        return 'bg-[#0f172a]'; // Slate darkest
      case 'date':
      case 'time':
        return 'bg-[#262626]'; // Neutral
      default:
        return 'bg-[#171717]'; // Neutral darker
    }
  };

  // Group entities by type
  const entityGroups = entities.reduce((groups, entity) => {
    const type = entity.type.toLowerCase();
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
                <span className="capitalize">{type}s</span>
                <span className="text-[#8A8782] text-xs">({entitiesOfType.length})</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {entitiesOfType.map((entity, index) => (
                  <div 
                    key={`${entity.name}-${index}`} 
                    className={`${getEntityBgColor(type)} px-3 py-1.5 rounded-lg border border-[#333333] flex items-center gap-2`}
                  >
                    <span className="text-[#E2DFD7] text-sm">{entity.name}</span>
                    {entity.count && (
                      <span className="text-[#8A8782] text-xs bg-[#222222] px-1.5 py-0.5 rounded-full">
                        {entity.count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 