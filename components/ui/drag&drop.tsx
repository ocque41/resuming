// components/DragAndDropUpload.tsx
import React, { useCallback} from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'

const DragAndDropUpload: React.FC = () => {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('/api/upload-cv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      console.log('Upload successful:', response.data)
    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div
      {...getRootProps()}
      className={`w-full max-w-lg mx-auto border-2 border-dashed rounded-md p-6 transition-colors duration-200 
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'} 
        focus:outline-none focus:ring-2 focus:ring-blue-500`}
    >
      <input {...getInputProps()} />
      <div className="text-center">
        {isDragActive ? (
          <p className="text-blue-600 font-medium">Drop your CV here...</p>
        ) : (
          <p className="text-gray-500">
            Drag &amp; drop your CV here, or{' '}
            <span className="underline cursor-pointer text-blue-600">
              click to select a file
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

export default DragAndDropUpload
