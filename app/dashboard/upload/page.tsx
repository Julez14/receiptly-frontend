'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface ReceiptData {
  merchant: string | null
  date: string | null
  total: number | null
  currency: string | null
  items: Array<{
    name: string
    quantity: number | null
    price: number | null
  }>
  category: string
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [ocrData, setOcrData] = useState<ReceiptData | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const supabase = createClient()

  // Open camera using getUserMedia
  const openCamera = async () => {
    try {
      console.log('Requesting camera access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Prefer rear camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      
      console.log('Camera stream obtained:', stream.getVideoTracks().length, 'video tracks')
      setCameraStream(stream)
      setShowCamera(true)
      
      // Wait a bit for modal to render, then set video source
      setTimeout(() => {
        if (videoRef.current && stream) {
          console.log('Setting video srcObject')
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(e => console.error('Video play error:', e))
        }
      }, 100)
      
    } catch (error) {
      console.error('Camera access error:', error)
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('Camera permission denied. Please enable camera access.')
        } else if (error.name === 'NotFoundError') {
          toast.error('No camera found on this device.')
        } else {
          toast.error('Unable to access camera: ' + error.message)
        }
      }
    }
  }

  // Close camera and clean up
  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setShowCamera(false)
  }

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas size to video size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert canvas to blob and create file
    canvas.toBlob((blob) => {
      if (blob) {
        const timestamp = Date.now()
        const capturedFile = new File([blob], `receipt-${timestamp}.jpg`, {
          type: 'image/jpeg'
        })
        
        // Use existing file change handler
        setFile(capturedFile)
        
        // Create preview
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(capturedFile)
        
        // Close camera
        closeCamera()
      }
    }, 'image/jpeg', 0.9)
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setOcrData(null)

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  // Handle GO button click
  const handleGo = async () => {
    if (!file) {
      toast.error('Please select a receipt image first')
      return
    }

    await analyzeReceipt(file)
  }

  const analyzeReceipt = async (fileToAnalyze: File) => {
    setAnalyzing(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://10.0.0.37:8080'

      const formData = new FormData()
      formData.append('image', fileToAnalyze)

      // Log to server terminal (this is for debugging purposes but can be left in production)
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[UPLOAD] Starting OCR analysis for file: ${fileToAnalyze.name}, API URL: ${apiUrl}`
        })
      }).catch(() => {})
    
      const response = await fetch(`${apiUrl}/analyze-receipt`, {
        method: 'POST',
        body: formData,
      })

      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[UPLOAD] API Response Status: ${response.status} ${response.statusText}`
        })
      }).catch(() => {})

      if (response.ok) {
        const data = await response.json()
        setOcrData(data)

        await fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `[UPLOAD] OCR Success - Merchant: ${data.merchant}, Total: ${data.total}`
          })
        }).catch(() => {})

        await saveReceiptToDatabase(fileToAnalyze, data)
      } else {
        const errorText = await response.text()

        await fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `[UPLOAD] OCR API Error (${response.status}): ${errorText}`
          })
        }).catch(() => {})

        toast.error(`Analysis failed: ${errorText || 'Server error'}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorDetails = error instanceof TypeError && errorMessage.includes('fetch')
        ? 'Cannot connect to API server'
        : errorMessage

      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[UPLOAD] OCR Exception: ${errorMessage} | Error Type: ${error instanceof TypeError ? 'TypeError (Network)' : typeof error}`
        })
      }).catch(() => {})

      toast.error(errorDetails)
    } finally {
      setAnalyzing(false)
    }
  }

  const saveReceiptToDatabase = async (fileToSave: File, data: ReceiptData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload image to Supabase Storage
      const fileExt = fileToSave.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, fileToSave)

      if (uploadError) throw uploadError

      const { data: receiptData, error: insertError } = await supabase
        .from('receipts')
        .insert({
          user_id: user.id,
          merchant: data.merchant,
          purchase_at: data.date,
          total: data.total,
          currency: data.currency,
          category: data.category,
          file_path: fileName,
        })
        .select()
        .single()

      if (insertError) throw insertError
      if (!receiptData) throw new Error('Failed to create receipt')

      if (data.items && data.items.length > 0) {
        const itemsToInsert = data.items.map(item => ({
          receipt_id: receiptData.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        }))

        const { error: itemsError } = await supabase
          .from('receipt_items')
          .insert(itemsToInsert)

        if (itemsError) {
          console.error('Failed to insert receipt items:', itemsError)
        }
      }

      toast.success('Receipt saved successfully!')

    } catch (error) {
      console.error('Save error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save receipt')
    }
  }

  const handleUploadAnother = () => {
    setFile(null)
    setPreview(null)
    setOcrData(null)
  }

  // Retake photo - clear current file and reopen camera
  const handleRetakePhoto = () => {
    setFile(null)
    setPreview(null)
    setOcrData(null)
    openCamera()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-black">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-black">Add Receipt</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">

      {!ocrData && !analyzing && (
        <>
          {/* Upload Box */}
          <label className="block">
            <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
              file ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400'
            }`}>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={analyzing}
                className="sr-only"
              />
              <div className="space-y-3">
                {!file ? (
                  <>
                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-black">Tap to upload</p>
                      <p className="text-xs text-gray-500 mt-1">Select receipt image</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mx-auto w-12 h-12 bg-black rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-black truncate px-4">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-1">Tap to change</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </label>

          {/* Take Photo button */}
          <button
            type="button"
            onClick={openCamera}
            disabled={analyzing}
            aria-label="Take a photo of your receipt using your camera"
            className="w-full bg-black text-white font-medium py-3 rounded-lg mt-4 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h2l1.2-1.8A2 2 0 0110 2h4a2 2 0 011.8 1.2L17 5h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm9 10a5 5 0 100-10 5 5 0 000 10z" />
            </svg>
            Take Photo
          </button>

          {/* Retake Photo button - show when file exists */}
          {file && (
            <button
              type="button"
              onClick={handleRetakePhoto}
              disabled={analyzing}
              aria-label="Retake the photo using your camera"
              className="w-full bg-gray-200 text-black font-medium py-3 rounded-lg mt-2 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retake Photo
            </button>
          )}

          {/* Preview Image */}
          {preview && (
            <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <div className="relative w-full bg-gray-50" style={{ height: '300px' }}>
                <Image
                  src={preview}
                  alt="Receipt preview"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          )}

          {/* GO Button */}
          {file && (
            <button
              onClick={handleGo}
              disabled={analyzing}
              className="w-full bg-black text-white font-bold text-lg py-4 rounded-lg mt-4 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? 'Processing...' : 'Analyze Receipt'}
            </button>
          )}
        </>
      )}

      {/* Results Section */}
      {(analyzing || ocrData) && (
        <>
          {/* Loading State */}
          {analyzing && (
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-black"></div>
              </div>
              <p className="text-black font-medium">Analyzing receipt...</p>
            </div>
          )}

          {/* Results Display */}
          {ocrData && !analyzing && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-2xl font-bold text-black mb-1">
                  {ocrData.total ? `${ocrData.currency || '$'}${ocrData.total.toFixed(2)}` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">{ocrData.merchant || 'Unknown'}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {ocrData.date || 'No date'} • {ocrData.category || 'Other'}
                </div>
              </div>

              {/* Line Items */}
              {ocrData.items && ocrData.items.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <p className="text-xs font-medium text-gray-600 uppercase">Items</p>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {ocrData.items.map((item, index) => (
                      <div key={index} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-black truncate">{item.name}</p>
                          {item.quantity && <p className="text-xs text-gray-500">Qty: {item.quantity}</p>}
                        </div>
                        <div className="text-sm font-medium text-black ml-4">
                          {item.price ? `${ocrData.currency || '$'}${item.price.toFixed(2)}` : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUploadAnother}
                  className="flex-1 bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Add Another
                </button>
                <Link
                  href="/dashboard"
                  className="flex-1 bg-gray-200 text-black font-medium py-3 rounded-lg hover:bg-gray-300 transition-colors text-center"
                >
                  View All
                </Link>
              </div>
            </div>
          )}
        </>
      )}
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col h-screen w-screen">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black text-white shrink-0" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <button
              onClick={closeCamera}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close camera"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-medium">Take Receipt Photo</h2>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>

          {/* Video Preview Container */}
          <div className="flex-1 relative overflow-hidden min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover bg-gray-900"
              onLoadedMetadata={() => {
                console.log('Video loaded:', videoRef.current?.videoWidth, videoRef.current?.videoHeight)
              }}
            />
            
            {/* Overlay guide */}
            <div className="absolute inset-4 border-2 border-white border-dashed rounded-lg flex items-center justify-center pointer-events-none">
              <div className="text-white text-center bg-black bg-opacity-50 p-4 rounded-lg">
                <p className="text-sm">Position receipt within frame</p>
              </div>
            </div>
          </div>

          {/* Camera Controls */}
          <div className="p-6 pb-24 bg-black text-center shrink-0">
            <button
              onClick={capturePhoto}
              className="bg-white text-black w-16 h-16 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors mx-auto"
              aria-label="Capture photo"
            >
              <div className="w-8 h-8 bg-black rounded-full"></div>
            </button>
          </div>

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  )
}
