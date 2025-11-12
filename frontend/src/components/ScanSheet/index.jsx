import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  Paper,
  Typography,
} from '@mui/material'

const ScanSheet = ({ onClose, onScan }) => {
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState("")
  const [code, setCode] = useState("")
  
  const handleSubmit = () => {
    if (code.trim()) {
      onScan?.(code.trim())
      onClose()
    }
  }

  const videoRef = useRef(null)
  const detectorRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  React.useEffect(() => {
    const hasDetector = "BarcodeDetector" in window
    setSupported(hasDetector)

    async function start() {
      try {
        if (!hasDetector) return
        
        detectorRef.current = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']
        })

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        })
        
        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        
        loop()
      } catch (e) {
        setError(e.message)
      }
    }

    function loop() {
      rafRef.current = requestAnimationFrame(loop)
      detect()
    }

    async function detect() {
      try {
        if (!detectorRef.current || !videoRef.current) return
        
        const codes = await detectorRef.current.detect(videoRef.current)
        if (codes.length > 0) {
          setCode(codes[0].rawValue)
        }
      } catch (e) {
        // Ignore detection errors
      }
    }

    start()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (videoRef.current) videoRef.current.srcObject = null
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop())
    }
  }, [])

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Scan Item</DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!supported && (
            <Alert severity="warning">
              Your browser does not support the native <code>BarcodeDetector</code> API. 
              You can still scan by typing the code below.
            </Alert>
          )}
          
          <Paper
            sx={{
              width: '100%',
              aspectRatio: '16/9',
              backgroundColor: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <video 
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              muted
              playsInline
            />
            {!supported && (
              <Typography
                sx={{
                  position: 'absolute',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '0.875rem',
                }}
              >
                Camera preview (no detection)
              </Typography>
            )}
          </Paper>
          
          {error && <Alert severity="error">{error}</Alert>}
          
          <TextField
            fullWidth
            label="Detected / manual barcode"
            placeholder="000000000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            variant="outlined"
          />
          
          <Typography variant="caption" color="textSecondary">
            Tip: Works best on HTTPS or localhost with good lighting. 
            Supported formats: EAN/UPC, Code128/39, QR.
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          disabled={!code.trim()}
        >
          Use this code
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ScanSheet
