import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import LinearKnob from '@/components/LinearKnob'
import { secondaryColor } from '@/app/globals'
import { midiNoteNumberToFrequency, frequencyToMidiNoteNumber } from '@/util/midi'
import styles from './index.module.css'

// MIDI note 24 - 84 (C1 - C6, 32.7Hz - 8372Hz)
export const minPitch = 24
export const maxPitch = 84
export const MAX_DETUNE = 100

export const scales = {
  free: null,
  chromatic: [1],
  ionian: [2, 2, 1, 2, 2, 2, 1],
  dorian: [2, 1, 2, 2, 2, 1, 2],
  phrygian: [1, 2, 2, 2, 1, 2, 2],
  lydian: [2, 2, 2, 1, 2, 2, 1],
  mixolydian: [2, 2, 1, 2, 2, 1, 2],
  aeolian: [2, 1, 2, 2, 1, 2, 2],
  locrian: [1, 2, 2, 1, 2, 2, 2],
  pentatonic: [2, 2, 3, 2, 3],
  diminished: [2, 1, 2, 1, 2, 1, 2, 1],
  insen: [1, 2, 2, 1, 2, 2],
}
export type ScaleName = keyof typeof scales

interface VoiceProps {
  pitch: number
  setPitch: (value: number) => void
  pitchFreq: number
  setPitchFreq: (value: number) => void
  scale: ScaleName
  label?: string
}

export default function Voice({ pitch, setPitch, pitchFreq, setPitchFreq, scale, label }: VoiceProps) {
  const [localPitch, setLocalPitch] = useState(pitch)
  const pitchRef = useRef(pitch)
  const pitchFreqRef = useRef(pitchFreq)

  useEffect(() => {
    pitchRef.current = pitch
  }, [pitch])
  useEffect(() => {
    pitchFreqRef.current = pitchFreq
  }, [pitchFreq])

  const availablePitches = useMemo<number[]>(() => {
    let currentPitch = minPitch
    const scaleIntervals = scales[scale as ScaleName] || scales.chromatic
    const pitches = [currentPitch]
    let scaleIndex = 0

    while (currentPitch < maxPitch) {
      const nextInterval = scaleIntervals[scaleIndex % scaleIntervals.length]
      currentPitch += nextInterval
      if (currentPitch <= maxPitch) {
        pitches.push(currentPitch)
      }
      scaleIndex++
    }

    return pitches
  }, [scale])

  const updatePitch = useCallback(
    (value: number) => {
      setPitch(availablePitches[value - 1] || minPitch)
    },
    [availablePitches, setPitch]
  )

  const updateLocalPitch = useCallback((localPitch: number) => {
    setLocalPitch(localPitch)
  }, [])

  const lastScale = useRef(scale)
  // update pitch to be diatonic when scale or transpose changes
  useEffect(() => {
    if (scale === 'free' && lastScale.current !== 'free') {
      setPitchFreq(midiNoteNumberToFrequency(pitchRef.current))
    } else if (scale !== 'free' && lastScale.current === 'free') {
      pitchRef.current = frequencyToMidiNoteNumber(pitchFreqRef.current)
    }
    lastScale.current = scale

    if (scale === 'free') return

    // find closest pitch in availablePitches
    let closestIndex = 0
    for (let i = 0; i < availablePitches.length; i++) {
      if (
        Math.abs(availablePitches[i] - pitchRef.current) < Math.abs(availablePitches[closestIndex] - pitchRef.current)
      ) {
        closestIndex = i
      }
    }

    updateLocalPitch(closestIndex + 1)
    updatePitch(closestIndex + 1)
  }, [scale, availablePitches, updatePitch, updateLocalPitch, setPitchFreq])

  const content = useMemo(
    () => (
      <div className={styles.voice}>
        {scale === 'free' ? (
          <LinearKnob
            min={32.7}
            max={8372}
            value={pitchFreq}
            onChange={setPitchFreq}
            strokeColor={secondaryColor}
            label={label}
            taper="log"
            disableReset
          />
        ) : (
          <LinearKnob
            min={1}
            max={availablePitches.length}
            step={1}
            value={localPitch}
            onChange={updateLocalPitch}
            setModdedValue={updatePitch}
            strokeColor={secondaryColor}
            label={label}
            disableReset
          />
        )}
      </div>
    ),
    [scale, availablePitches, localPitch, updatePitch, updateLocalPitch, label, pitchFreq, setPitchFreq]
  )

  return content
}
