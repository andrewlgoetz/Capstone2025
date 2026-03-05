import React, { useState, useRef } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Alert, LinearProgress, Chip } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import DescriptionIcon from '@mui/icons-material/Description'
import { bulkImportCSV, bulkImportJSON } from '../services/api'

const BulkImportModal = ({ open, onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validExtensions = ['.csv', '.json']
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (!validExtensions.includes(fileExtension)) {
      setError('Please select a CSV or JSON file')
      return
    }

    setSelectedFile(file)
    setError(null)
    setResult(null)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first')
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      let uploadResult

      if (selectedFile.name.endsWith('.csv')) {
        // Upload CSV file
        uploadResult = await bulkImportCSV(selectedFile)
      } else if (selectedFile.name.endsWith('.json')) {
        // Read and parse JSON file
        const fileContent = await selectedFile.text()
        const jsonData = JSON.parse(fileContent)
        uploadResult = await bulkImportJSON(jsonData)
      }

      setResult(uploadResult)

      // Call onSuccess callback if provided
      if (onSuccess && uploadResult.successful > 0) {
        onSuccess(uploadResult)
      }
    } catch (err) {
      console.error('Bulk import error:', err)
      const errorMessage = err.response?.data?.detail || err.message || 'Upload failed'
      setError(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setResult(null)
    setError(null)
    onClose()
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle className="text-lg font-semibold text-slate-800 tracking-tight">
        Bulk Import Inventory
      </DialogTitle>

      <DialogContent className="bg-white p-4">
        <Box className="flex flex-col gap-4">
          {/* Instructions */}
          <Alert severity="info" className="text-sm">
            Upload a CSV or JSON file to import multiple inventory items at once.
            <br />
            <strong>Required fields:</strong> name, quantity
            <br />
            <strong>Optional fields:</strong> category, barcode, unit, expiration_date (YYYY-MM-DD), location_id
          </Alert>

          {/* File Upload Area */}
          <Box
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-slate-500 transition-colors"
            onClick={handleBrowseClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {selectedFile ? (
              <Box className="flex flex-col items-center gap-2">
                <DescriptionIcon className="w-12 h-12 text-slate-600" />
                <Typography variant="body1" className="font-medium text-slate-800">
                  {selectedFile.name}
                </Typography>
                <Typography variant="caption" className="text-slate-500">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </Typography>
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                    setResult(null)
                    setError(null)
                  }}
                >
                  Change File
                </Button>
              </Box>
            ) : (
              <Box className="flex flex-col items-center gap-2">
                <UploadFileIcon className="w-12 h-12 text-slate-400" />
                <Typography variant="body1" className="text-slate-600">
                  Click to browse or drag and drop
                </Typography>
                <Typography variant="caption" className="text-slate-500">
                  Supports CSV and JSON files
                </Typography>
              </Box>
            )}
          </Box>

          {/* Upload Progress */}
          {uploading && (
            <Box className="flex flex-col gap-2">
              <Typography variant="body2" className="text-slate-600">
                Uploading and processing items...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" className="text-sm">
              {error}
            </Alert>
          )}

          {/* Result Summary */}
          {result && (
            <Box className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg">
              <Typography variant="h6" className="font-semibold text-slate-800">
                Import Results
              </Typography>

              <Box className="flex gap-3 flex-wrap">
                <Chip
                  icon={<CheckCircleIcon />}
                  label={`${result.successful} Successful`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  icon={<ErrorIcon />}
                  label={`${result.failed} Failed`}
                  color={result.failed > 0 ? 'error' : 'default'}
                  variant="outlined"
                />
                <Chip
                  label={`${result.total_items} Total`}
                  variant="outlined"
                />
              </Box>

              {/* Error Details */}
              {result.errors && result.errors.length > 0 && (
                <Box className="mt-2">
                  <Typography variant="subtitle2" className="font-medium text-slate-700 mb-2">
                    Error Details:
                  </Typography>
                  <Box className="max-h-40 overflow-y-auto bg-white rounded p-2 border border-gray-200">
                    {result.errors.map((err, idx) => (
                      <Typography
                        key={idx}
                        variant="caption"
                        className="block text-red-600 mb-1"
                      >
                        {err.row ? `Row ${err.row}` : `Item ${err.item_index}`}: {err.error}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Example Format */}
          <Box className="p-3 bg-slate-50 rounded text-xs">
            <Typography variant="caption" className="font-semibold text-slate-700 block mb-1">
              Example CSV Format:
            </Typography>
            <pre className="text-slate-600 overflow-x-auto">
              name,category,barcode,quantity,unit,expiration_date,location_id{'\n'}
              Canned Beans,Canned Goods,012345678901,100,cans,2025-12-31,1{'\n'}
              Rice 5lb Bag,Grains,023456789012,50,bags,2026-06-30,1
            </pre>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <div className="w-full flex justify-end gap-2 px-4 pb-4">
          <button
            type="button"
            className="px-4 py-2 rounded hover:bg-gray-100 text-slate-700 font-medium"
            onClick={handleClose}
          >
            Close
          </button>

          {!result && (
            <button
              type="button"
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white disabled:bg-slate-400 disabled:cursor-not-allowed"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload & Import'}
            </button>
          )}
        </div>
      </DialogActions>
    </Dialog>
  )
}

export default BulkImportModal
