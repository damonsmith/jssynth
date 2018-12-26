/* tslint:disable:no-unused-variable */

import { NoteData } from "./NoteData"
import { MODLoader } from "./ModLoader"

export interface Effect {
	div: (mixer, chan, param: number, playerState, channelState, period?, note?, song?) => void
	tick: (mixer, chan, param: number, playerState, channelState, period?, note?, song?) => void
	allowSampleTrigger: boolean
	allowVolumeChange: boolean
	allowPeriodChange: boolean
}

const MIN_SLIDE_PERIOD = 54
const MAX_SLIDE_PERIOD = 1712 * 4

const VIBRATO_TABLE = [

	[   0,  24,  49,  74,  97, 120, 141, 161, 180, 197, 212, 224, 235, 244, 250, 253,
		255, 253, 250, 244, 235, 224, 212, 197, 180, 161, 141, 120,  97,  74,  49,  24,
		0, -24, -49, -74, -97, -120, -141, -161, -180, -197, -212, -224, -235, -244, -250, -253,
		-255, -253, -250, -244, -235, -224, -212, -197, -180, -161, -141, -120, -97, -74, -49, -24],

	[ 255, 246, 238, 230, 222, 214, 206, 198, 190, 182, 173, 165, 157, 149, 141, 133,
		125, 117, 109, 100,  92,  84,  76,  68, 60,  52,  44,  36,  27,  19,  11,   3,
		-4, -12, -20, -28, -36, -45, -53, -61, -69, -77, -85, -93, -101, -109, -118, -126,
		-134, -142, -150, -158, -166, -174, -182, -191, -199, -207, -215, -223, -231, -239, -247, -255],

	[ 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
		255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
		-255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255,
		-255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255 ],

	[ 81, -123, 63, -138, 153, -84, 208, 97, 160, -195, 173, -94, 162, 30, 34, -135,
		-102, -82, 24, -141, -167, -137, -232, -229, 224, 145, -212, 181, 60, 64, -55, 36,
		-26, 46, 120, 163, -132, -16, -208, -87, 179, 122, 244, 91, 179, -175, 202, -207,
		168, 191, -241, 236, -192, -146, -185, 12, 6, 81, 214, 151, 196, -10, -95, -155]
]

const INVERT_LOOP_TABLE = [ 0, 5, 6, 7, 8, 10, 11, 13, 16, 19, 22, 26, 32, 43, 64, 128 ]

const S3M_RETRIG_TABLE = [
	function(vol) { return vol },
	function(vol) { return vol - 1 },
	function(vol) { return vol - 2 },
	function(vol) { return vol - 4 },
	function(vol) { return vol - 8 },
	function(vol) { return vol - 16 },
	function(vol) { return vol * 2 / 3 },
	function(vol) { return vol / 2 },
	function(vol) { return vol },
	function(vol) { return vol + 1 },
	function(vol) { return vol + 2 },
	function(vol) { return vol + 4 },
	function(vol) { return vol + 8 },
	function(vol) { return vol + 16 },
	function(vol) { return vol * 3 / 2 },
	function(vol) { return vol * 2 }
]

const effectTypes: {[index: string]: Effect} = {
	EMPTY_EFFECT: {
		div(mixer, chan, param, playerState, channelState) {},
		tick(mixer, chan, param, playerState, channelState) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_ARPEGGIO: {
		div(mixer, chan, param, playerState, channelState) {
			const currentNote = NoteData.MOD_PERIOD_TABLE.getNote(channelState.lastPeriod)
			if (param !== 0x00) {
				if (currentNote < 0 || currentNote > 108) {
					channelState.effectState.arpTable = [ channelState.period, channelState.period, channelState.period]
				} else {
					const a = (param & 0xf0) / 16
					const b = (param & 0x0f)
					channelState.effectState.arpTable = [
						NoteData.MOD_PERIOD_TABLE.getPeriod(currentNote),
						NoteData.MOD_PERIOD_TABLE.getPeriod(currentNote + a),
						NoteData.MOD_PERIOD_TABLE.getPeriod(currentNote + b)
					]
					channelState.effectState.arpPos = 0
				}
			}
		},
		tick(mixer, chan, param, playerState, channelState) {
			if (param !== 0x00) {
				channelState.effectState.arpPos = (channelState.effectState.arpPos + 1) % 3
				channelState.period = channelState.effectState.arpTable[channelState.effectState.arpPos]
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PORTA_UP: {
		div(mixer, chan, param, playerState, channelState) {
			channelState.effectState.portAmt = param * 4
		},
		tick(mixer, chan, param, playerState, channelState) {
			channelState.period -= channelState.effectState.portAmt
			if (channelState.period < MIN_SLIDE_PERIOD) {
				channelState.period = MIN_SLIDE_PERIOD
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PORTA_DOWN: {
		div(mixer, chan, param, playerState, channelState) {
			channelState.effectState.portAmt = param * 4
		},
		tick(mixer, chan, param, playerState, channelState) {
			channelState.period += channelState.effectState.portAmt
			if (channelState.period > MAX_SLIDE_PERIOD) {
				channelState.period = MAX_SLIDE_PERIOD
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PORTA_TO_NOTE: {
		div(mixer, chan, param, playerState, channelState, period) {
			if (period !== 0) {
				channelState.effectState.portToNoteDestPeriod = period
				if (!channelState.effectState.portToNoteSpeed) {
					channelState.effectState.portToNoteSpeed = 0x00
				}
				channelState.lastPeriod = period
			}
			if (param !== 0x00) {
				channelState.effectState.portToNoteSpeed = param * 4
			}
		},
		tick(mixer, chan, param, playerState, channelState) {

			if (channelState.effectState.portToNoteDestPeriod && channelState.effectState.portToNoteSpeed) {
				if (channelState.effectState.portToNoteDestPeriod > channelState.period) {
					channelState.period += channelState.effectState.portToNoteSpeed
					if (channelState.period > channelState.effectState.portToNoteDestPeriod) {
						channelState.period = channelState.effectState.portToNoteDestPeriod
						channelState.lastPeriod = channelState.period
					}
				}
				if (channelState.effectState.portToNoteDestPeriod < channelState.period) {
					channelState.period -= channelState.effectState.portToNoteSpeed
					if (channelState.period < channelState.effectState.portToNoteDestPeriod) {
						channelState.period = channelState.effectState.portToNoteDestPeriod
						channelState.lastPeriod = channelState.period
					}
				}
			}
		},
		allowPeriodChange: false,
		allowSampleTrigger: true,
		allowVolumeChange: true
	},
	MOD_VIBRATO: {
		div(mixer, chan, param, playerState, channelState, period) {
			const vibParams = channelState.effectState.vibratoParams || {
				waveform: 0,
				pos: 0,
				depth: 0,
				speed: 0
			}
			if (vibParams.waveform <= 3 && period > 0) {
				vibParams.pos = 0
			}
			if (param > 0x00) {
				const newDepth = param & 0x0f
				if (newDepth > 0) {
					vibParams.depth = newDepth
				}
				const newSpeed = ((param & 0xf0) / 16)
				if (newSpeed > 0) {
					vibParams.speed = newSpeed
				}
			}
			channelState.effectState.vibratoParams = vibParams
		},
		tick(mixer, chan, param, playerState, channelState) {
			const lookupPeriodOffset = function(p) { return (VIBRATO_TABLE[p.waveform & 0x03][p.pos] * p.depth / 128) }
			const updatePos = function(p) { p.pos = (p.pos + p.speed) % 64 }
			const vibParams = channelState.effectState.vibratoParams
			if (vibParams) {
				updatePos(vibParams)
				channelState.period = channelState.lastPeriod + lookupPeriodOffset(vibParams) * 4
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true

	},
	MOD_PORTA_PLUS_VOL_SLIDE: {

		div(mixer, chan, param, playerState, channelState, period) {
			if (period !== 0) {
				channelState.effectState.portToNoteDestPeriod = period
				if (!channelState.effectState.portToNoteSpeed) {
					channelState.effectState.portToNoteSpeed = 0x00
				}
			}
		},
		tick(mixer, chan, param, playerState, channelState) {
			effectTypes.MOD_PORTA_TO_NOTE.tick(mixer, chan, param, playerState, channelState)
			effectTypes.MOD_VOLUME_SLIDE.tick(mixer, chan, param, playerState, channelState)
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: false
	},
	MOD_VIBRATO_PLUS_VOL_SLIDE: {
		div() {
		},
		tick(mixer, chan, param, playerState, channelState) {
			effectTypes.MOD_VOLUME_SLIDE.tick(mixer, chan, param, playerState, channelState)
			effectTypes.MOD_VIBRATO.tick(mixer, chan, param, playerState, channelState)
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_TREMOLO: {
		div(mixer, chan, param, playerState, channelState, period) {
			const tremParams = channelState.effectState.tremoloParams || {
				waveform: 0,
				pos: 0,
				depth: 0,
				speed: 0
			}
			if (tremParams.waveform <= 3 && period > 0) {
				tremParams.pos = 0
			}
			if (param > 0x00) {
				const newDepth = param & 0x0f
				if (newDepth > 0) {
					tremParams.depth = newDepth
				}
				const newSpeed = ((param & 0xf0) / 16)
				if (newSpeed > 0) {
					tremParams.speed = newSpeed
				}
			}
			channelState.effectState.tremoloParams = tremParams
		},
		tick(mixer, chan, param, playerState, channelState) {
			const lookupVolumeOffset = function(p) { return (VIBRATO_TABLE[p.waveform & 0x03][p.pos] * p.depth / 64) }
			const updatePos = function(p) { p.pos = (p.pos + p.speed) % 64 }
			const tremParams = channelState.effectState.tremoloParams
			if (tremParams) {
				updatePos(tremParams)
				channelState.volume = channelState.lastVolume + lookupVolumeOffset(tremParams)
				channelState.volume = Math.round(channelState.volume < 0 ? 0 : channelState.volume > 64 ? 64 : channelState.volume)
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PAN: {
		div(mixer, chan, param, playerState, channelState, period) {
			if (param <= 0x80) {
				channelState.panPos.left = (128 - param) / 128
				channelState.panPos.right = param / 128
			} else if (param === 0xa4) {
				channelState.panPos.left = 1
				channelState.panPos.right = -1
			}
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true

	},
	MOD_SAMPLE_OFFSET: {
		div(mixer, chan, param, playerState, channelState, period) {
			mixer.setSamplePosition(chan, param * 256)
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_VOLUME_SLIDE: {
		div(mixer, chan, param, playerState, channelState, period) {
		},
		tick(mixer, chan, param, playerState, channelState) {
			const upAmt = (param & 0xf0) / 16
			let downAmt = param & 0x0f
			if (upAmt !== 0x00 && downAmt !== 0x00) {
				downAmt = 0x00
			}
			channelState.volume += upAmt - downAmt
			channelState.volume = channelState.volume < 0 ? 0 : channelState.volume > 64 ? 64 : channelState.volume
			channelState.lastVolume = channelState.volume
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true

	},
	MOD_JUMP_TO_PATTERN: {
		div(mixer, chan, param, playerState, channelState) {
			playerState.jumpToPattern = param
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_SET_VOLUME: {
		div(mixer, chan, param, playerState, channelState) {
			channelState.volume = param < 0 ? 0 : param > 0x40 ? 0x40 : param
			channelState.lastVolume = channelState.volume
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PATTERN_BREAK: {
		div(mixer, chan, param, playerState, channelState) {
			const x = ((param & 0xf0) / 16)
			const y = param & 0x0f
			const newRow = x * 10 + y
			playerState.breakToRow = newRow
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PROTRACKER: {
		div(mixer, chan, param, playerState, channelState, period, note, song) {
			const newEffect = 0xe0 + ((param & 0xf0) / 16)
			const newParam = param & 0x0f
			effectTypes[newEffect].div(mixer, chan, newParam, playerState, channelState, period, note, song)
		},
		tick(mixer, chan, param, playerState, channelState) {
			const newEffect = 0xe0 + ((param & 0xf0) / 16)
			const newParam = param & 0x0f
			effectTypes[newEffect].tick(mixer, chan, newParam, playerState, channelState)
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_SET_FILTER: {
		div(mixer, chan, param, playerState, channelState, period) {
			playerState.filter = param
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_FINE_PORTA_UP: {
		div(mixer, chan, param, playerState, channelState, period) {},
		tick(mixer, chan, param, playerState, channelState) {
			channelState.period -= param * 4
			channelState.lastPeriod = channelState.period
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_FINE_PORTA_DOWN: {
		div(mixer, chan, param, playerState, channelState, period) {},
		tick(mixer, chan, param, playerState, channelState) {
			channelState.period += param * 4
			channelState.lastPeriod = channelState.period
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_GLISSANDO_CONTROL: {
		div(mixer, chan, param, playerState, channelState, period) {},
		tick(mixer, chan, param, playerState, channelState) {
			playerState.glissandoControl = param
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_SET_VIBRATO_WAVEFORM: {
		div(mixer, chan, param, playerState, channelState) {
			channelState.effectParams.vibratoParams.waveform = param & 0x07
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_SET_FINETUNE: {
		div(mixer, chan, param, playerState, channelState, period, note, song) {
			if (note.sampleNumber !== 0) {
				const instrument = song.instruments[note.sampleNumber - 1]
				instrument.metadata.pitchOfs = Math.pow(MODLoader.EIGHTH_SEMITONE_MULTIPLIER, (param < 8 ? param : (param - 16)))
			}
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_PATTERN_LOOP: {
		div(mixer, chan, param, playerState, channelState, period, note, song) {
			const doLoop = function() {
				channelState.effectState.patternLoop.count--
				playerState.l_breakToRow = channelState.effectState.patternLoop.row
				playerState.l_jumpToPattern = playerState.pos
			}
			if (param === 0x00) {

				channelState.effectState.patternLoop.row = playerState.row
			} else {
				if (channelState.effectState.patternLoop.count == null) {
					channelState.effectState.patternLoop.count = param
					doLoop()
				} else {
					if (channelState.effectState.patternLoop.count !== 0) {
						doLoop()
					} else {
						channelState.effectState.patternLoop.count = null
					}
				}
			}
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_SET_TREMOLO_WAVEFORM: {
		div(mixer, chan, param, playerState, channelState) {
			channelState.effectState.tremoloParams.waveform = param & 0x07
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_16_POS_PAN: {
		div(mixer, chan, param, playerState, channelState) {
			channelState.panPos.left = (15 - param) / 15
			channelState.panPos.right = param / 15
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_RETRIG_NOTE: {
		div(mixer, chan, param, playerState, channelState, period) {},
		tick(mixer, chan, param, playerState, channelState) {
			if ((playerState.tick + 1) % param === 0) {
				mixer.setSamplePosition(chan, 0)
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_FINE_VOLSLIDE_UP: {
		div(mixer, chan, param, playerState, channelState) {
			channelState.volume += param
			if (channelState.volume >  64) {
				channelState.volume = 64
			}
			channelState.lastVolume = channelState.volume
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_FINE_VOLSLIDE_DOWN: {
		div(mixer, chan, param, playerState, channelState) {
			channelState.volume -= param
			if (channelState.volume < 0) {
				channelState.volume = 0
			}
			channelState.lastVolume = channelState.volume
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_CUT_NOTE: {
		div(mixer, chan, param, playerState, channelState) {},
		tick(mixer, chan, param, playerState, channelState) {
			if (playerState.tick >= param) {
				channelState.volume = 0
			}
			channelState.lastVolume = channelState.volume
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_DELAY_NOTE: {
		div(mixer, chan, param, playerState, channelState, period, note, song) {
			let noteToPlay = note.note
			if (noteToPlay < 0) {
				noteToPlay = NoteData.MOD_PERIOD_TABLE.getNote(period)
			}
			const instrument = note.sampleNumber > 0 ? song.instruments[note.sampleNumber - 1] : null
			let sample = null
			if (instrument && noteToPlay > 0) {
				const sampleNum = instrument.metadata.noteToSampleMap[noteToPlay]
				sample = instrument.samples[sampleNum]
			}
			channelState.effectState.noteDelay = {
				delay: param,
				note,
				sample
			}
		},
		tick(mixer, chan, param, playerState, channelState) {
			if (playerState.tick === (param - 1)) {
				const note = channelState.effectState.noteDelay.note

				const period = note.note < 0 ? 0 : NoteData.MOD_PERIOD_TABLE.getPeriod(note.note)
				const volume = note.volume
				const sample =  channelState.effectState.noteDelay.sample
				if (sample) {
					mixer.setSample(chan, sample)
					channelState.volume = sample.metadata.volume
					channelState.lastVolume = sample.metadata.volume
				}
				if (period > 0) {
					channelState.period = period
					channelState.lastPeriod = period
					mixer.setSamplePosition(chan, 0)
				}
				if (volume >= 0) {
					channelState.volume = volume
					channelState.lastVolume = volume
				}
			}
		},
		allowPeriodChange: false,
		allowSampleTrigger: false,
		allowVolumeChange: false
	},
	MOD_PT_DELAY_PATTERN: {
		div(mixer, chan, param, playerState) {
			playerState.patternDelay = param * playerState.speed
		},
		tick(mixer, chan, param, playerState, channelState) {
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_PT_INVERT_LOOP: {
		div(mixer, chan, param, playerState, channelState, period, note, song) {
			channelState.effectState.invertLoop.delay = 0
			const ins = channelState.sample
			if (ins > 0) {
				channelState.effectState.invertLoop.sample = song.instruments[ins]
			}
		},
		tick(mixer, chan, param, playerState, channelState) {
			const currentSample = channelState.effectState.invertLoop.sample

			channelState.effectState.invertLoop.delay += INVERT_LOOP_TABLE[param]
			if (currentSample && currentSample.metadata.repeatLength > 2 && channelState.effectState.invertLoop.delay >= 128) {
				channelState.effectState.invertLoop.delay = 0

				channelState.effectState.invertLoop.pos ++
				if (channelState.effectState.invertLoop.pos > currentSample.metadata.repeatLength) {
					channelState.effectState.invertLoop.pos = 0
				}

				currentSample.data[currentSample.metadata.repeatStart + channelState.effectState.invertLoop.pos] =
					(0 - currentSample.data[currentSample.metadata.repeatStart + channelState.effectState.invertLoop.pos])
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	MOD_SET_SPEED: {
		div(mixer, chan, param, playerState, channelState) {
			if (param <= 0x20) {
				playerState.speed = param
			} else {
				playerState.bpm = param
			}
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_SET_SPEED: {
		div(mixer, chan, param, playerState, channelState) {
			playerState.speed = param
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_SET_TEMPO: {
		div(mixer, chan, param, playerState, channelState) {
			playerState.bpm = param
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_VOLUME_SLIDE: {
		div(mixer, chan, param, playerState, channelState, period) {
			if (param === 0x00) {
				param = channelState.effectState.lastS3MVolSlide || 0x00
			}
			channelState.effectState.lastS3MVolSlide = param
			const a = (param & 0xf0) / 16
			const b = param & 0x0f
			if (playerState.fastS3MVolumeSlides) {
				if (b === 0x00 && a !== 0x00) {
					channelState.volume += a
				} else if (a === 0x00 && b !== 0x00) {
					channelState.volume -= b
				}
			}
			if (b === 0x0f) {
				channelState.volume += a
			} else if (a === 0x0f) {
				channelState.volume -= b
			}
			channelState.volume = channelState.volume < 0 ? 0 : channelState.volume > 64 ? 64 : channelState.volume
			channelState.lastVolume = channelState.volume
		},
		tick(mixer, chan, param, playerState, channelState) {
			const slideAmt = channelState.effectState.lastS3MVolSlide
			const a = (slideAmt & 0xf0) / 16
			const b = (slideAmt & 0x0f)
			if (b === 0x00 && a !== 0x00) {
				channelState.volume += a
			} else if (a === 0x00 && b !== 0x00) {
				channelState.volume -= b
			}
			channelState.volume = channelState.volume < 0 ? 0 : channelState.volume > 64 ? 64 : channelState.volume
			channelState.lastVolume = channelState.volume
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_PORTA_DOWN: {
		div(mixer, chan, param, playerState, channelState, period) {
			if (param === 0x00) {
				param = channelState.effectState.lastS3MPortDown || 0x00
			}
			channelState.effectState.lastS3MPortDown = param
			const a = (param & 0xf0) / 16
			const b = param & 0x0f
			if (a === 0x0f) {
				channelState.period += b * 4
			} else if (a === 0x0e) {
				channelState.period += b
			}
			if (channelState.period > MAX_SLIDE_PERIOD) {
				channelState.period = MAX_SLIDE_PERIOD
			}
		},
		tick(mixer, chan, param, playerState, channelState) {
			const slideAmt = channelState.effectState.lastS3MPortDown
			const a = (slideAmt & 0xf0) / 16
			const b = (slideAmt & 0x0f)
			if (a < 0x0e) {
				channelState.period += ((a * 16) + b) * 4
			}
			if (channelState.period > MAX_SLIDE_PERIOD) {
				channelState.period = MAX_SLIDE_PERIOD
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_PORTA_UP: {
		div(mixer, chan, param, playerState, channelState, period) {
			if (param === 0x00) {
				param = channelState.effectState.lastS3MPortUp || 0x00
			}
			channelState.effectState.lastS3MPortUp = param
			const a = (param & 0xf0) / 16
			const b = param & 0x0f
			if (a === 0x0f) {
				channelState.period -= b * 4
			} else if (a === 0x0e) {
				channelState.period -= b
			}
			if (channelState.period < MIN_SLIDE_PERIOD) {
				channelState.period = MIN_SLIDE_PERIOD
			}
		},
		tick(mixer, chan, param, playerState, channelState) {
			const slideAmt = channelState.effectState.lastS3MPortUp
			const a = (slideAmt & 0xf0) / 16
			const b = (slideAmt & 0x0f)
			if (a < 0x0e) {
				channelState.period -= ((a * 16) + b) * 4
			}
			if (channelState.period < MIN_SLIDE_PERIOD) {
				channelState.period = MIN_SLIDE_PERIOD
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_RETRIG_PLUS_VOLUME_SLIDE: {
		div(mixer, chan, param, playerState, channelState, period) {
			if ((param & 0xf0) !== 0x00) {
				channelState.effectState.lastS3MRetrigVolSldParam = (param & 0xf0) / 16
			}
			if ((param & 0x0f) !== 0x00) {
				channelState.effectState.lastS3MRetrigRetrigTickParam = (param & 0x0f)
			}

		},
		tick(mixer, chan, param, playerState, channelState) {
			const retrigTicks = channelState.effectState.lastS3MRetrigRetrigTickParam || 0x00
			const volSld = channelState.effectState.lastS3MRetrigVolSldParam || 0x00
			if ((playerState.tick + 1) % retrigTicks === 0) {
				mixer.setSamplePosition(chan, 0)
				channelState.volume = S3M_RETRIG_TABLE[volSld](channelState.volume)
			}
			channelState.volume = channelState.volume < 0 ? 0 : channelState.volume > 64 ? 64 : channelState.volume
			channelState.lastVolume = channelState.volume
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_EXTENDED: {
		div(mixer, chan, param, playerState, channelState, period, note, song) {
			const newEffect = 0x130 + ((param & 0xf0) / 16)
			const newParam = param & 0x0f
			S3M_EFFECT_MAP[newEffect].effect.div(mixer, chan, newParam, playerState, channelState, period, note, song)
		},
		tick(mixer, chan, param, playerState, channelState) {
			const newEffect = 0x130 + ((param & 0xf0) / 16)
			const newParam = param & 0x0f
			S3M_EFFECT_MAP[newEffect].effect.tick(mixer, chan, newParam, playerState, channelState)
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_FINE_VIBRATO: {
		div(mixer, chan, param, playerState, channelState, period) {
			const vibParams = channelState.effectState.vibratoParams || {
				waveform: 0,
				pos: 0,
				depth: 0,
				speed: 0
			}
			if (vibParams.waveform <= 3 && period > 0) {
				vibParams.pos = 0
			}
			if (param > 0x00) {
				const newDepth = param & 0x0f
				if (newDepth > 0) {
					vibParams.depth = newDepth
				}
				const newSpeed = ((param & 0xf0) / 16)
				if (newSpeed > 0) {
					vibParams.speed = newSpeed
				}
			}
			channelState.effectState.vibratoParams = vibParams
		},
		tick(mixer, chan, param, playerState, channelState) {
			const lookupPeriodOffset = function(p) { return (VIBRATO_TABLE[p.waveform & 0x03][p.pos] * p.depth / 128) }
			const updatePos = function(p) { p.pos = (p.pos + p.speed) % 64 }
			const vibParams = channelState.effectState.vibratoParams
			if (vibParams) {
				updatePos(vibParams)
				channelState.period = channelState.lastPeriod + lookupPeriodOffset(vibParams)
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true

	},
	S3M_TREMOR: {
		div(mixer, chan, param, playerState, channelState) {
			// console.log("S3M Tremor; Does this sound okay?!")
			if (param > 0x00) {
				channelState.effectState.tremorParam = param
			}
		},
		tick(mixer, chan, param, playerState, channelState) {
			const x = (param & 0xf0) / 16
			const y = param & 0x0f
			channelState.effectState.tremorCount = ((channelState.effectState.tremorCount + 1) % (x + y))
			if (channelState.effectState.tremorCount < x) {
				channelState.volume = channelState.lastVolume
			} else {
				channelState.volume = 0
			}
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_SET_GLOBAL_VOLUME: {
		div(mixer, chan, param, playerState, channelState) {
			playerState.globalVolume = param
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	S3M_STEREO_CONTROL: {
		div(mixer, chan, param, playerState, channelState) {
			if (param > 7) {
				param = param - 16
			}
			param = param + 8
			channelState.panPos.left = (15 -  param) / 15
			channelState.panPos.right = param / 15
		},
		tick(mixer, chan, param, playerState, channelState, period) {},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	},
	XM_GLOBAL_VOLUME_SLIDE: {
		div(mixer, chan, param, playerState, channelState, period) {
			if (param === 0x00) {
				param = channelState.effectState.lastXMGlobalVolSlide || 0x00
			}
			channelState.effectState.lastXMGlobalVolSlide = param
			const a = (param & 0xf0) / 16
			const b = param & 0x0f
			if (playerState.fastS3MVolumeSlides) {
				if (b === 0x00 && a !== 0x00) {
					playerState.globalVolume += a
				} else if (a === 0x00 && b !== 0x00) {
					playerState.globalVolume -= b
				}
			}
			if (b === 0x0f) {
				playerState.globalVolume += a
			} else if (a === 0x0f) {
				playerState.globalVolume -= b
			}
			playerState.globalVolume = playerState.globalVolume < 0 ?
				0 : playerState.globalVolume > 64 ?
					64 : playerState.globalVolume
		},
		tick(mixer, chan, param, playerState, channelState) {
			const slideAmt = channelState.effectState.lastXMGlobalVolSlide
			const a = (slideAmt & 0xf0) / 16
			const b = (slideAmt & 0x0f)
			if (b === 0x00 && a !== 0x00) {
				playerState.globalVolume += a
			} else if (a === 0x00 && b !== 0x00) {
				playerState.globalVolume -= b
			}
			playerState.globalVolume = playerState.globalVolume < 0 ?
				0 : playerState.globalVolume > 64 ?
					64 : playerState.globalVolume
		},
		allowSampleTrigger: true,
		allowVolumeChange: true,
		allowPeriodChange: true
	}
}

interface EffectMapEntry {
	code: string
	effect: Effect
}

export interface EffectMap {[index: string]: EffectMapEntry }

export const MOD_EFFECT_MAP: EffectMap = {
	0x00: { code: "0", effect: effectTypes.MOD_ARPEGGIO },
	0x01: { code: "1", effect: effectTypes.MOD_PORTA_UP },
	0x02: { code: "2", effect: effectTypes.MOD_PORTA_DOWN },
	0x03: { code: "3", effect: effectTypes.MOD_PORTA_TO_NOTE },
	0x04: { code: "4", effect: effectTypes.MOD_VIBRATO },
	0x05: { code: "5", effect: effectTypes.MOD_PORTA_PLUS_VOL_SLIDE },
	0x06: { code: "6", effect: effectTypes.MOD_VIBRATO_PLUS_VOL_SLIDE },
	0x07: { code: "7", effect: effectTypes.MOD_TREMOLO },
	0x08: { code: "8", effect: effectTypes.MOD_PAN },
	0x09: { code: "9", effect: effectTypes.MOD_SAMPLE_OFFSET },
	0x0a: { code: "a", effect: effectTypes.MOD_VOLUME_SLIDE },
	0x0b: { code: "b", effect: effectTypes.MOD_JUMP_TO_PATTERN },
	0x0c: { code: "c", effect: effectTypes.MOD_SET_VOLUME },
	0x0d: { code: "d", effect: effectTypes.MOD_PATTERN_BREAK },
	0x0e: { code: "e", effect: effectTypes.MOD_PROTRACKER },
	0x0f: { code: "f", effect: effectTypes.MOD_SET_SPEED },
	0x10: { code: "g", effect: effectTypes.EMPTY_EFFECT },
	0x11: { code: "h", effect: effectTypes.EMPTY_EFFECT  },
	0x12: { code: "i", effect: effectTypes.EMPTY_EFFECT  },
	0x13: { code: "j", effect: effectTypes.EMPTY_EFFECT  },
	0x14: { code: "k", effect: effectTypes.EMPTY_EFFECT  },
	0x15: { code: "l", effect: effectTypes.EMPTY_EFFECT  },
	0x16: { code: "m", effect: effectTypes.EMPTY_EFFECT  },
	0x17: { code: "n", effect: effectTypes.EMPTY_EFFECT  },
	0x18: { code: "o", effect: effectTypes.EMPTY_EFFECT  },
	0x19: { code: "p", effect: effectTypes.EMPTY_EFFECT  },
	0x1a: { code: "q", effect: effectTypes.EMPTY_EFFECT  },
	0x1b: { code: "r", effect: effectTypes.EMPTY_EFFECT  },
	0x1c: { code: "s", effect: effectTypes.EMPTY_EFFECT  },
	0x1d: { code: "t", effect: effectTypes.EMPTY_EFFECT  },
	0x1e: { code: "u", effect: effectTypes.EMPTY_EFFECT  },
	0x1f: { code: "v", effect: effectTypes.EMPTY_EFFECT  },
	0x20: { code: "w", effect: effectTypes.EMPTY_EFFECT  },
	0x21: { code: "x", effect: effectTypes.EMPTY_EFFECT  },
	0x22: { code: "y", effect: effectTypes.EMPTY_EFFECT  },
	0x23: { code: "z", effect: effectTypes.EMPTY_EFFECT  },

	0xe0: { code: "null", effect: effectTypes.MOD_PT_SET_FILTER },
	0xe1: { code: "null", effect: effectTypes.MOD_PT_FINE_PORTA_UP },
	0xe2: { code: "null", effect: effectTypes.MOD_PT_FINE_PORTA_DOWN },
	0xe3: { code: "null", effect: effectTypes.MOD_PT_GLISSANDO_CONTROL },
	0xe4: { code: "null", effect: effectTypes.MOD_PT_SET_VIBRATO_WAVEFORM },
	0xe5: { code: "null", effect: effectTypes.MOD_PT_SET_FINETUNE },
	0xe6: { code: "null", effect: effectTypes.MOD_PT_PATTERN_LOOP },
	0xe7: { code: "null", effect: effectTypes.MOD_PT_SET_TREMOLO_WAVEFORM },
	0xe8: { code: "null", effect: effectTypes.MOD_PT_16_POS_PAN },
	0xe9: { code: "null", effect: effectTypes.MOD_PT_RETRIG_NOTE },
	0xea: { code: "null", effect: effectTypes.MOD_PT_FINE_VOLSLIDE_UP },
	0xeb: { code: "null", effect: effectTypes.MOD_PT_FINE_VOLSLIDE_DOWN },
	0xec: { code: "null", effect: effectTypes.MOD_PT_CUT_NOTE },
	0xed: { code: "null", effect: effectTypes.MOD_PT_DELAY_NOTE },
	0xee: { code: "null", effect: effectTypes.MOD_PT_DELAY_PATTERN },
	0xef: { code: "null", effect: effectTypes.MOD_PT_INVERT_LOOP }
}

export const S3M_EFFECT_MAP: EffectMap = {
	  0x00: { code: "-", effect: effectTypes.EMPTY_EFFECT  },
	  0x01: { code: "A", effect: effectTypes.S3M_SET_SPEED },
	  0x02: { code: "B", effect: effectTypes.MOD_JUMP_TO_PATTERN },
	  0x03: { code: "C", effect: effectTypes.MOD_PATTERN_BREAK },
	  0x04: { code: "D", effect: effectTypes.S3M_VOLUME_SLIDE },
	  0x05: { code: "E", effect: effectTypes.S3M_PORTA_DOWN },
	  0x06: { code: "F", effect: effectTypes.S3M_PORTA_UP },
	  0x07: { code: "G", effect: effectTypes.MOD_PORTA_TO_NOTE },
	  0x08: { code: "H", effect: effectTypes.MOD_VIBRATO },
	  0x09: { code: "I", effect: effectTypes.S3M_TREMOR },
	  0x0a: { code: "J", effect: effectTypes.MOD_ARPEGGIO },
	  0x0b: { code: "K", effect: effectTypes.MOD_VIBRATO_PLUS_VOL_SLIDE },
	  0x0c: { code: "L", effect: effectTypes.MOD_PORTA_PLUS_VOL_SLIDE },
	  0x0d: { code: "M", effect: effectTypes.EMPTY_EFFECT  },
	  0x0e: { code: "N", effect: effectTypes.EMPTY_EFFECT  },
	  0x0f: { code: "O", effect: effectTypes.MOD_SAMPLE_OFFSET },
	  0x10: { code: "P", effect: effectTypes.EMPTY_EFFECT  },
	  0x11: { code: "Q", effect: effectTypes.S3M_RETRIG_PLUS_VOLUME_SLIDE },
	  0x12: { code: "R", effect: effectTypes.MOD_TREMOLO },
	  0x13: { code: "S", effect: effectTypes.S3M_EXTENDED },
	0x130: { code: "x", effect: effectTypes.MOD_PT_SET_FILTER },
	0x131: { code: "x", effect: effectTypes.MOD_PT_GLISSANDO_CONTROL },
	0x132: { code: "x", effect: effectTypes.MOD_PT_SET_FINETUNE },
	0x133: { code: "x", effect: effectTypes.MOD_PT_SET_VIBRATO_WAVEFORM },
	0x134: { code: "x", effect: effectTypes.MOD_PT_SET_TREMOLO_WAVEFORM },
	0x135: { code: "x", effect: effectTypes.EMPTY_EFFECT  },
	0x136: { code: "x", effect: effectTypes.EMPTY_EFFECT  },
	0x137: { code: "x", effect: effectTypes.EMPTY_EFFECT  },
	0x138: { code: "x", effect: effectTypes.MOD_PT_16_POS_PAN },
	0x139: { code: "x", effect: effectTypes.EMPTY_EFFECT  },
	0x13a: { code: "x", effect: effectTypes.S3M_STEREO_CONTROL },
	0x13b: { code: "x", effect: effectTypes.MOD_PT_PATTERN_LOOP },
	0x13c: { code: "x", effect: effectTypes.MOD_PT_CUT_NOTE },
	0x13d: { code: "x", effect: effectTypes.MOD_PT_DELAY_NOTE },
	0x13e: { code: "x", effect: effectTypes.MOD_PT_DELAY_PATTERN },
	0x13f: { code: "x", effect: effectTypes.MOD_PT_INVERT_LOOP },
	  0x14: { code: "T", effect: effectTypes.S3M_SET_TEMPO },
	  0x15: { code: "U", effect: effectTypes.S3M_FINE_VIBRATO },
	  0x16: { code: "V", effect: effectTypes.S3M_SET_GLOBAL_VOLUME }

}

export const XM_EFFECT_MAP: EffectMap = {
	0x00: { code: "0", effect: effectTypes.MOD_ARPEGGIO },
	0x01: { code: "1", effect: effectTypes.MOD_PORTA_UP },
	0x02: { code: "2", effect: effectTypes.MOD_PORTA_DOWN },
	0x03: { code: "3", effect: effectTypes.MOD_PORTA_TO_NOTE },
	0x04: { code: "4", effect: effectTypes.MOD_VIBRATO },
	0x05: { code: "5", effect: effectTypes.MOD_PORTA_PLUS_VOL_SLIDE },
	0x06: { code: "6", effect: effectTypes.MOD_VIBRATO_PLUS_VOL_SLIDE },
	0x07: { code: "7", effect: effectTypes.MOD_TREMOLO },
	0x08: { code: "8", effect: effectTypes.MOD_PAN },
	0x09: { code: "9", effect: effectTypes.MOD_SAMPLE_OFFSET },
	0x0a: { code: "a", effect: effectTypes.MOD_VOLUME_SLIDE },
	0x0b: { code: "b", effect: effectTypes.MOD_JUMP_TO_PATTERN },
	0x0c: { code: "c", effect: effectTypes.MOD_SET_VOLUME },
	0x0d: { code: "d", effect: effectTypes.MOD_PATTERN_BREAK },
	0x0e: { code: "e", effect: effectTypes.MOD_PROTRACKER },
	0x0f: { code: "f", effect: effectTypes.MOD_SET_SPEED },

	0x10: { code: "G", effect: effectTypes.S3M_SET_GLOBAL_VOLUME },
	0x11: { code: "H", effect: effectTypes.XM_GLOBAL_VOLUME_SLIDE },
	0x12: { code: "I", effect: effectTypes.EMPTY_EFFECT  },
	0x13: { code: "J", effect: effectTypes.EMPTY_EFFECT  },
	0x14: { code: "K", effect: effectTypes.EMPTY_EFFECT  },
	0x15: { code: "L", effect: effectTypes.EMPTY_EFFECT  },
	0x16: { code: "M", effect: effectTypes.EMPTY_EFFECT  },
	0x17: { code: "N", effect: effectTypes.EMPTY_EFFECT  },
	0x18: { code: "O", effect: effectTypes.EMPTY_EFFECT  },
	0x19: { code: "P", effect: effectTypes.EMPTY_EFFECT  },
	0x1a: { code: "R", effect: effectTypes.S3M_RETRIG_PLUS_VOLUME_SLIDE },
	0x1b: { code: "S", effect: effectTypes.EMPTY_EFFECT  },
	0x1c: { code: "T", effect: effectTypes.S3M_TREMOR },
	0x1d: { code: "U", effect: effectTypes.EMPTY_EFFECT  },
	0x1e: { code: "V", effect: effectTypes.EMPTY_EFFECT  },
	0x1f: { code: "W", effect: effectTypes.EMPTY_EFFECT  },
	0x20: { code: "X", effect: effectTypes.EMPTY_EFFECT  },

	0xe0: { code: "X", effect: effectTypes.MOD_PT_SET_FILTER  },
	0xe1: { code: "X", effect: effectTypes.MOD_PT_FINE_PORTA_UP  },
	0xe2: { code: "X", effect: effectTypes.MOD_PT_FINE_PORTA_DOWN  },
	0xe3: { code: "X", effect: effectTypes.MOD_PT_GLISSANDO_CONTROL  },
	0xe4: { code: "X", effect: effectTypes.MOD_PT_SET_VIBRATO_WAVEFORM  },
	0xe5: { code: "X", effect: effectTypes.MOD_PT_SET_FINETUNE  },
	0xe6: { code: "X", effect: effectTypes.MOD_PT_PATTERN_LOOP  },
	0xe7: { code: "X", effect: effectTypes.MOD_PT_SET_TREMOLO_WAVEFORM  },
	0xe8: { code: "X", effect: effectTypes.MOD_PT_16_POS_PAN  },
	0xe9: { code: "X", effect: effectTypes.MOD_PT_RETRIG_NOTE  },
	0xea: { code: "X", effect: effectTypes.MOD_PT_FINE_VOLSLIDE_UP  },
	0xeb: { code: "X", effect: effectTypes.MOD_PT_FINE_VOLSLIDE_DOWN },
	0xec: { code: "X", effect: effectTypes.MOD_PT_CUT_NOTE  },
	0xed: { code: "X", effect: effectTypes.MOD_PT_DELAY_NOTE  },
	0xee: { code: "X", effect: effectTypes.MOD_PT_DELAY_PATTERN  },
	0xef: { code: "X", effect: effectTypes.MOD_PT_INVERT_LOOP }
}
