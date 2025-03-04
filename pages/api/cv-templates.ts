import { NextApiRequest, NextApiResponse } from 'next';
import { CV_TEMPLATES } from '@/types/templates';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return all templates
    res.status(200).json({ templates: CV_TEMPLATES });
  } catch (error) {
    console.error('Error fetching CV templates:', error);
    res.status(500).json({ error: 'Failed to fetch CV templates' });
  }
} 