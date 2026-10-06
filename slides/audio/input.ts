import { computed, reactive, shallowRef } from 'vue'
import { unlock } from './audio'

// Every note comes in here: MIDI devices and the on-screen keyboard both send
// raw MIDI bytes through `receive`, so the log, the held keys and (later) the
// synth can't tell them apart.

export type MidiStatus = 'unsupported' | 'waiting' | 'denied' | 'ready'

export const midi = reactive({
  status: 'waiting' as MidiStatus,
  // Names of the connected input devices.
  devices: [] as string[],
  // The on-screen keyboard counts as a device while its drawer is open.
  onScreen: false,
})

const ON_SCREEN = 'On-screen keyboard'
// Every connected input, the on-screen keyboard included.
export const inputs = computed(() => (midi.onScreen ? [...midi.devices, ON_SCREEN] : midi.devices))

export interface MidiMessage {
  id: number
  source: string
  data: number[]
}

const LOG_SIZE = 20
// Newest first.
export const messages = shallowRef<MidiMessage[]>([])
export function clearMessages() {
  messages.value = []
}

// Notes that are down right now, and which source pressed them.
export const held = reactive(new Map<number, string>())

export interface NoteListener {
  noteOn: (note: number, velocity: number) => void
  noteOff: (note: number) => void
}
const listeners = new Set<NoteListener>()
export function onNote(listener: NoteListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const NOTE_ON = 0x90
const NOTE_OFF = 0x80
// Clock, active sensing and other real-time bytes. Some keyboards send them
// many times a second; they'd bury the notes in the log.
const REALTIME = 0xf8

let nextId = 0

export function receive(bytes: ArrayLike<number>, source: string) {
  const data = Array.from(bytes)
  const [status = 0, note = 0, velocity = 0] = data
  if (status >= REALTIME) return
  messages.value = [{ id: nextId++, source, data }, ...messages.value].slice(0, LOG_SIZE)

  const type = status & 0xf0
  // Many keyboards send "note on, velocity 0" instead of a note off.
  if (type === NOTE_ON && velocity > 0) {
    held.set(note, source)
    listeners.forEach((l) => l.noteOn(note, velocity))
  } else if (type === NOTE_OFF || type === NOTE_ON) {
    held.delete(note)
    listeners.forEach((l) => l.noteOff(note))
  }
}

// The on-screen keyboard. Pressing a key is a user gesture, so it unlocks audio.
export function pressKey(note: number, velocity: number) {
  unlock()
  receive([NOTE_ON, note, velocity], ON_SCREEN)
}
export function releaseKey(note: number) {
  receive([NOTE_OFF, note, 64], ON_SCREEN)
}
export function connectOnScreen(on: boolean) {
  midi.onScreen = on
  if (!on) disconnect(ON_SCREEN)
}

// A device unplugged mid-note never sends its note offs, so send them for it.
// Then forget its messages: the log only shows what connected devices sent.
function disconnect(source: string) {
  for (const [note, from] of held) if (from === source) receive([NOTE_OFF, note, 64], source)
  messages.value = messages.value.filter((m) => m.source !== source)
}

function watch(access: MIDIAccess) {
  const update = () => {
    const devices: string[] = []
    access.inputs.forEach((input) => {
      if (input.state !== 'connected') return
      const name = input.name || 'MIDI device'
      devices.push(name)
      // Setting the handler also opens the port.
      input.onmidimessage = (e) => e.data && receive(e.data, name)
    })
    midi.devices.filter((name) => !devices.includes(name)).forEach(disconnect)
    midi.devices = devices
  }
  access.onstatechange = update
  update()
  midi.status = 'ready'
}

// Always listening, from the moment the deck loads, so a keyboard plugged in
// mid-talk just works.
if (typeof navigator !== 'undefined') {
  if (!navigator.requestMIDIAccess) midi.status = 'unsupported'
  else navigator.requestMIDIAccess().then(watch, () => (midi.status = 'denied'))
}

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
// 60 → "C4" (middle C).
export const noteName = (note: number) => `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`
export const isBlack = (note: number) => NAMES[note % 12].length > 1
