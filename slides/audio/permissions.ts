import { reactive } from 'vue'
import { ctx, unlock } from './audio'
import { requestMidi } from './input'

// What the deck is allowed to do, kept in sync with Chrome: the audio
// context's state, and the MIDI and mic permissions from the Permissions API.
// The settings chips on the first slide show these and ask for each one.

export type Access = 'granted' | 'prompt' | 'denied' | 'unknown'

export const access = reactive({
  audio: ctx.state,
  midi: 'unknown' as Access,
  mic: 'unknown' as Access,
})

ctx.addEventListener('statechange', () => (access.audio = ctx.state))

// Follows a permission as it changes, including from Chrome's site settings.
async function follow(name: 'midi' | 'microphone', key: 'midi' | 'mic') {
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName })
    access[key] = status.state
    status.addEventListener('change', () => (access[key] = status.state))
  } catch {
    // Not a permission this browser knows; leave it unknown.
  }
}

if (typeof navigator !== 'undefined') {
  follow('midi', 'midi')
  follow('microphone', 'mic')
}

export { requestMidi, unlock as requestAudio }

// Opens the mic just long enough for Chrome to ask, then turns it off. The
// mic slide opens its own stream when it needs one.
export async function requestMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
  } catch {
    // A denial shows up in `access.mic`; nothing else to do here.
  }
}
