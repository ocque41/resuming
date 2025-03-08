// Mock implementation of the database for development
export const db = {
  query: {
    cv: {
      findFirst: async (options: { where: any }) => {
        console.log('Mock DB query cv.findFirst', options);
        return {
          id: 'mock-cv-id',
          userId: 'mock-user-id',
          fileName: 'mock-cv.pdf',
          rawText: 'PROFILE\nExperienced professional...\n\nSKILLS\n• Skill 1\n• Skill 2',
          optimizedText: 'PROFILE\nOptimized professional experience...\n\nSKILLS\n• Enhanced Skill 1\n• Advanced Skill 2',
          optimizedAt: new Date().toISOString(),
          isOptimizationAccepted: false
        };
      }
    }
  },
  update: (table: any) => {
    console.log('Mock DB update', table);
    return {
      set: (data: any) => {
        console.log('Mock DB update set', data);
        return {
          where: (condition: any) => {
            console.log('Mock DB update where', condition);
            return Promise.resolve({ success: true });
          }
        };
      }
    };
  }
}; 