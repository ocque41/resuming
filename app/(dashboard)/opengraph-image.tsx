import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'Resuming - The First Engineer-Recruiter AI Platform';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

// Create a timestamp for cache busting
const timestamp = Date.now();

// Image generation
export default async function Image() {
  // Use the public 1.png image directly with cache busting
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          background: '#050505',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img 
          src={`https://resuming.ai/1.png?v=${timestamp}`}
          alt="Resuming - Engineer-Recruiter AI Platform"
          width={1200} 
          height={630} 
          style={{ objectFit: 'cover' }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
} 