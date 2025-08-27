'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import * as Tone from 'tone'
import Voice, { scales, ScaleName, minPitch, maxPitch, MAX_DETUNE } from '@/components/Voice'
import LinearKnob from '@/components/LinearKnob'
import Explanation from '@/components/Explanation'
import { midiNoteNumberToNoteName, midiNoteNumberToFrequency, transposeFreq } from '@/util/midi'
import { constrain } from '@/util/math'
import getNativeContext from '@/util/getNativeContext'
import { secondaryColor } from './globals'
import styles from './page.module.css'

const scaleOptions = Object.keys(scales)
const musicNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default function LAMBVoice() {
  const [initialized, setInitialized] = useState<boolean>(false)
  const [playing, setPlaying] = useState<boolean>(false)
  const [pitch1, setPitch1] = useState<number>(48)
  const [pitch1Freq, setPitch1Freq] = useState<number>(() => midiNoteNumberToFrequency(pitch1))
  const voice1Ref = useRef<Tone.OmniOscillator<Tone.Oscillator> | null>(null)

  const [subLevel, setSubLevel] = useState<number>(0)
  const voice1SubRef = useRef<Tone.OmniOscillator<Tone.Oscillator> | null>(null)
  const voice1SubGainRef = useRef<Tone.Gain | null>(null)
  const updateSubLevel = useCallback((value: number) => {
    setSubLevel(value)
    voice1SubGainRef.current?.set({ gain: value })
  }, [])

  const [wave, setWave] = useState<number>(MAX_DETUNE / 2)
  const updateWave = useCallback((value: number) => {
    setWave(value)
    voice1Ref.current?.set({ spread: value })
    voice1SubRef.current?.set({ spread: value })
  }, [])

  const [transpose, setTranspose] = useState<number>(0)
  const [scale, setScale] = useState<number>(0)

  const pitch1NoteName = useMemo<string | number>(
    () =>
      scaleOptions[scale] === 'free'
        ? transposeFreq(pitch1Freq, transpose)
        : midiNoteNumberToNoteName(constrain(pitch1 + Math.round(transpose), minPitch, maxPitch)),
    [pitch1, transpose, pitch1Freq, scale]
  )

  // update voice pitches
  useEffect(() => {
    if (voice1Ref.current) voice1Ref.current.frequency.value = pitch1NoteName
    if (voice1SubRef.current)
      voice1SubRef.current.frequency.value =
        typeof pitch1NoteName === 'number'
          ? pitch1NoteName / 2
          : midiNoteNumberToNoteName(constrain(pitch1 + transpose - 12, minPitch - 12, maxPitch))
  }, [pitch1NoteName, pitch1, transpose])

  // init audio
  useEffect(() => {
    if (!initialized) return

    voice1Ref.current = new Tone.OmniOscillator({
      volume: -8,
      frequency: pitch1NoteName,
      type: 'fatsawtooth',
    })
      .toDestination()
      .start()
    voice1Ref.current.set({ spread: wave })

    voice1SubGainRef.current = new Tone.Gain({
      gain: subLevel,
    }).toDestination()

    voice1SubRef.current = new Tone.OmniOscillator({
      volume: -8,
      frequency: (pitch1NoteName as number) / 2,
      type: 'fatsawtooth',
    })
      .connect(voice1SubGainRef.current)
      .start()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized])

  const playStop = useCallback(async () => {
    if (!initialized) {
      await Tone.start()
      setInitialized(true)
    }

    setPlaying((playing) => {
      const ctx = getNativeContext()
      if (!playing) {
        ctx.resume()
      } else {
        ctx.suspend()
      }

      return !playing
    })
  }, [initialized])

  // play/stop on spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault() // prevent scrolling
        playStop()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [playStop])

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <Image
          className={styles.playStopButton}
          src={!playing ? '/play.svg' : '/stop.svg'}
          alt="Play/Stop Button"
          width={40}
          height={40}
          onClick={playStop}
        />
        <div className={styles.control}>
          <p className={styles.controlLabel}>PITCH</p>
          <Voice
            pitch={pitch1}
            setPitch={setPitch1}
            pitchFreq={pitch1Freq}
            setPitchFreq={setPitch1Freq}
            scale={scaleOptions[scale] as ScaleName}
            label={
              scaleOptions[scale] === 'free'
                ? (pitch1NoteName as number).toFixed(2) + ' Hz'
                : (pitch1NoteName as string)
            }
          />

          {/* voice global controls */}
          <div className={styles.voiceGlobalControls}>
            <div className={styles.voiceGlobalControl}>
              <LinearKnob
                min={0}
                max={11}
                step={scaleOptions[scale] === 'free' ? undefined : 1}
                value={transpose}
                onChange={setTranspose}
                strokeColor={secondaryColor}
              />
              <p>
                root:
                <br />
                {scaleOptions[scale] === 'free' ? transpose.toFixed(2) : musicNotes[Math.round(transpose)]}
              </p>
            </div>
            <div className={styles.voiceGlobalControl}>
              <LinearKnob
                min={0}
                max={scaleOptions.length - 1}
                step={1}
                value={scale}
                onChange={setScale}
                strokeColor={secondaryColor}
              />
              <p>
                scale:
                <br />
                {scaleOptions[scale]}
              </p>
            </div>
            <svg className={styles.voiceGlobalControlDivider} width="60" height="40">
              <line x1="0" y1="20" x2="60" y2="20" stroke={secondaryColor} strokeWidth="2" />
              <line x1="59" y1="0" x2="59" y2="40" stroke={secondaryColor} strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div className={styles.control}>
          <p className={styles.controlLabel}>WAVE</p>
          <LinearKnob value={wave} onChange={updateWave} min={0} max={MAX_DETUNE} strokeColor={secondaryColor} />
        </div>
        <div className={styles.control}>
          <p className={styles.controlLabel}>SUB</p>
          <LinearKnob value={subLevel} onChange={updateSubLevel} min={0} max={1} strokeColor={secondaryColor} />
        </div>
      </div>

      <Explanation />
    </div>
  )
}
