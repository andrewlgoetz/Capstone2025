import React, { useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Alert, Paper, Typography
} from '@mui/material'
import { BrowserMultiFormatReader } from '@zxing/browser'

const ZXingScanSheet = ({ onClose, onScan }) => {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [deviceId, setDeviceId] = useState(null)

  const videoRef = useRef(null)
  const readerRef = useRef(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    async function start() {
      try {
        // Pick back camera if possible
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const back = devices.find(d =>
          /back|rear|environment/i.test(`${d.label}`)
        )
        const id = back?.deviceId ?? devices[0]?.deviceId
        setDeviceId(id)

        await reader.decodeFromVideoDevice(
          id,
          videoRef.current,
          (result, err) => {
            if (result) {
              const text = result.getText()
              setCode(text)
              // Auto-submit once detected, or leave manual
              // onScan?.(text); onClose();
            }
            // Ignore intermittent decode errors
          }
        )
      } catch (e) {
        setError(e.message || 'Camera error')
      }
    }

    start()

    return () => {
      try { readerRef.current?.reset() } catch {}
    }
  }, [])

  const handleSubmit = () => {
    if (code.trim()) {
      onScan?.(code.trim())
      onClose()
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Scan Item</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Paper sx={{
            width: '100%', aspectRatio: '16/9', bgcolor: '#1a1a1a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative'
          }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
            {!deviceId && (
              <Typography sx={{ position: 'absolute', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                Initializing camera…
              </Typography>
            )}
          </Paper>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            fullWidth label="Detected / manual barcode" placeholder="000000000000"
            value={code} onChange={e => setCode(e.target.value)}
          />

          <Typography variant="caption" color="textSecondary">
            Tip: good lighting, hold the barcode flat. ZXing decodes UPC/EAN/Code128 fast.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!code.trim()}>
          Use this code
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ZXingScanSheet
