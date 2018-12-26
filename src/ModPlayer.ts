
import { Mixer } from "./Mixer"
import { AmigaLowPassFilter } from "./AmigaLowPassFilter"
import { Song } from "./ModLoader"
import { Effect, EffectMap, MOD_EFFECT_MAP } from "./Effects"
import { NoteData } from "./NoteData"

export interface FrequencyType {
	clock: number
}

interface PlayerState {
	freq: FrequencyType
	pos: number
	row: number
	tick: number
	speed: number
	bpm: number
	globalVolume: number
	patternDelay: number
	glissandoControl: number
	breakToRow: any
	jumpToPattern: any
	l_breakToRow: any
	l_jumpToPattern: any
	fastS3MVolumeSlides: number | boolean
	filter: number
}

interface EffectState {
	tremorCount: number
	tremorParam: number
	arpPos: number
	noteDelay: number
	vibratoParams: {
		waveform: number
		pos: number
		depth: number
		speed: number
	},
	tremoloParams: {
		waveform: number
		pos: number
		depth: number
		speed: number
	},
	patternLoop: {
		row: number
		count: number
	},
	invertLoop: {
		pos: number
		delay: number
		sample: any
	}
}

interface ChannelState {
	chan: number
	panPos: number
	volume: number
	lastVolume: number
	period: number
	pitchOfs: number
	lastPeriod: number
	effect: Effect
	effectParameter: number
	effectState: EffectState
}

export class MODPlayer {

	// private static FREQ_NTSC: FrequencyType = { clock: 7159090.5 * 4 }
	private static FREQ_PAL: FrequencyType = { clock: 7093789.2 * 4 }

	private mixer: Mixer
	private playing: boolean
	private loggingEnabled: boolean
	private song: Song
	private playerState: PlayerState
	private channelState: ChannelState[]
	private effectMap: EffectMap

	private AMIGA_FILTERS: any[]

	private stateCallback: (playerState: PlayerState, channelStates: ChannelState[]) => {}

	constructor(mixer: Mixer) {

		this.AMIGA_FILTERS = [new AmigaLowPassFilter(), new AmigaLowPassFilter()]
		this.playing = true
		this.loggingEnabled = false
		this.song = null
		this.stateCallback = null
		this.mixer = mixer
		this.mixer.setPreMixCallback(this.preSampleMix, this)
	}

	public setSong(song: Song) {

		this.song = song
		this.effectMap = song.effectMap || MOD_EFFECT_MAP

		this.playerState = {
			freq: song.defaultFreq || MODPlayer.FREQ_PAL,
			pos: 0,
			row: -1,
			tick: 6,
			speed: song.initialSpeed || 6,
			bpm: song.initialBPM || 125,
			globalVolume: song.globalVolume || 64,
			patternDelay: 0,
			glissandoControl: 0,
			breakToRow: null,
			jumpToPattern: null,
			l_breakToRow: null,
			l_jumpToPattern: null,
			fastS3MVolumeSlides: song.fastS3MVolumeSlides || 0,
			filter: 0
		}

		const defaultPanPos = song.defaultPanPos ||
			[-0.8, 0.8, 0.8, -0.8, -0.8, 0.8, 0.8, -0.8, -0.8, 0.8, 0.8, -0.8, -0.8, 0.8, 0.8, -0.8]

		this.channelState = []
		for (let i = 0; i < song.channels; i++) {
			this.channelState[i] = {
				chan: i,
				panPos: defaultPanPos[i],
				volume: 64,
				lastVolume: undefined,
				period: 0,
				pitchOfs: 1,
				lastPeriod: 0,
				effect: null,
				effectParameter: 0,
				effectState: {
					tremorCount: 0,
					tremorParam: 0,
					arpPos: 0,
					noteDelay: -1,
					vibratoParams: {
						waveform: 0,
						pos: 0,
						depth: 0,
						speed: 0
					},
					tremoloParams: {
						waveform: 0,
						pos: 0,
						depth: 0,
						speed: 0
					},
					patternLoop: {
						row: 0,
						count: null
					},
					invertLoop: {
						pos: 0,
						delay: 0,
						sample: null
					}
				}
			}
			this.mixer.setPanPosition(i, this.channelState[i].panPos)
		}
	}

	public start() {
		this.playing = true
	}

	public stop() {
		this.playing = false
		for (let chan = 0; chan < this.song.channels; chan++) {
			this.mixer.cut(chan)
		}
	}

	public preSampleMix(mixer: Mixer, sampleRate: number) {
		if (!this.playing) {
			return
		}
		const state = this.playerState
		const song = this.song
		if (state.patternDelay > 0) {
			state.patternDelay--
			this.handleTick(song.patterns[song.orders[state.pos]][state.row], state.tick, sampleRate)
		} else {
			if (state.tick === 0) {
				if (this.stateCallback) {
					this.stateCallback(this.playerState, this.channelState)
				}
				this.handleDiv(song.patterns[song.orders[state.pos]][state.row], sampleRate)
			} else {
				this.handleTick(song.patterns[song.orders[state.pos]][state.row], state.tick, sampleRate)
			}
			this.advanceTick()
		}
		if (state.tick === 0) {

			if (state.l_jumpToPattern !== null) {
				state.jumpToPattern = state.l_jumpToPattern
				state.breakToRow = state.l_breakToRow
				state.l_jumpToPattern = null
				state.l_breakToRow = null
			}
			if (state.jumpToPattern !== null) {
				state.pos = state.jumpToPattern
				state.jumpToPattern = null
				if (state.breakToRow !== null) {
					state.row = state.breakToRow
					state.breakToRow = null
				} else {
					state.row = 0
				}
			}
			if (state.breakToRow !== null) {
				if (state.row !== 0) {
					this.advancePos()
				}
				state.row = state.breakToRow
				state.breakToRow = null
			}
		}
		if (this.playerState.filter > 0) {
			this.mixer.setFilters(this.AMIGA_FILTERS)
		} else {
			this.mixer.setFilters(null)
		}
		this.mixer.setGlobalVolume(state.globalVolume)
		this.mixer.setSecondsPerMix(1 / (state.bpm * 2 / 5))
	}

	public nextPos() {
		this.advancePos()
		this.playerState.row = 0
		this.playerState.tick = 0
	}

	public previousPos() {
		this.decrementPos()
		this.playerState.row = 0
		this.playerState.tick = 0
	}

	public advancePos() {
		const state = this.playerState
		const song = this.song

		do {
			state.pos = state.pos + 1
		} while (song.orders[state.pos] === 254)

		if (state.pos >= song.songLength || song.orders[state.pos] === 255) {
			state.pos = 0
		}
	}

	public decrementPos() {
		const state = this.playerState
		const song = this.song

		do {
			state.pos -= 1
		} while (song.orders[state.pos] === 254)

		if (state.pos < 0) {
			state.pos = song.songLength
			do {
				state.pos -= 1
			} while (song.orders[state.pos] === 254)
		}
	}

	public advanceRow() {
		const state = this.playerState
		const song = this.song

		const numRows = song.patterns[song.orders[state.pos]].length
		state.row = state.row + 1

		if (state.row >= numRows) {
			let chan
			for (chan = 0; chan < song.channels; chan++) {
				this.channelState[chan].effectState.patternLoop.row = 0
			}
			state.row = 0
			this.advancePos()
		}
	}

	public advanceTick() {
		const state = this.playerState
		state.tick += 1
		if (state.tick >= state.speed) {
			state.tick = 0
			this.advanceRow()
		}
	}

	public handleTick(row, tick, sampleRate) {
		for (let chan = 0; chan < this.song.channels; chan++) {
			const chanState = this.channelState[chan]
			const effectParameter = chanState.effectParameter
			const effectHandler = chanState.effect
			let volumeEffectHandler
			let volumeEffectParameter
			if (row && row[chan] && row[chan].volumeEffect) {
				volumeEffectHandler = this.effectMap[row[chan].volumeEffect].effect
				volumeEffectParameter = row[chan].volumeEffectParameter
			}
			if (volumeEffectHandler) {
				volumeEffectHandler.tick(
					this.mixer, chan, volumeEffectParameter, this.playerState, chanState, null, null, this.song
				)
			}
			if (effectHandler) {
				effectHandler.tick(this.mixer, chan, effectParameter, this.playerState, chanState, null, null, this.song)
			}
			let periodToPlay = chanState.period
			if (this.playerState.glissandoControl > 0) {
				const noteNum = NoteData.MOD_PERIOD_TABLE.getNote(periodToPlay)
				periodToPlay = NoteData.MOD_PERIOD_TABLE.getPeriod(noteNum)
			}
			const freqHz = (this.playerState.freq.clock / (periodToPlay * 2)) * chanState.pitchOfs
			this.mixer.setFrequency(chan, freqHz)
			this.mixer.setVolume(chan, chanState.volume)
		}
	}

	public handleNote(chan, note, sampleRate) {
		const parms = this.channelState[chan]
		let period = 0
		if (note.note > 0 && note.note !== 254) {
			period = NoteData.MOD_PERIOD_TABLE.getPeriod(note.note)
		}
		const sampleNumber = note.sampleNumber - 1
		parms.effectParameter = note.parameter
		const effectHandler = this.effectMap[note.effect].effect
		let volumeEffectHandler = null
		let volumeEffectParameter = null
		if (note.volumeEffect) {
			volumeEffectHandler = this.effectMap[note.volumeEffect].effect
			volumeEffectParameter = note.volumeEffectParameter
		}
		if (!effectHandler && this.loggingEnabled) {
			// console.log("no effect handler for effect " + note.effect.toString(16) + "/" + note.parameter.toString(16))
		}
		parms.effect = effectHandler

		if (sampleNumber >= 0 && this.song.instruments[sampleNumber]) {

			const instrument = this.song.instruments[sampleNumber]

			let noteToPlay = note.note
			if (noteToPlay < 0) {
				noteToPlay = NoteData.MOD_PERIOD_TABLE.getNote(parms.period)
			}
			if (noteToPlay > 0) {
				const sampleNum = instrument.metadata.noteToSampleMap[noteToPlay]
				const sample = instrument.samples[sampleNum]

				this.mixer.setSample(chan, sample)

				parms.pitchOfs = sample.metadata.pitchOfs || 1
				if ((effectHandler && effectHandler.allowVolumeChange === true) || !effectHandler) {
					parms.volume = sample.metadata.volume
					parms.lastVolume = sample.metadata.volume
				}
			}

		}
		if (period > 0) {
			if ((effectHandler && effectHandler.allowPeriodChange === true) || !effectHandler) {
				parms.period = period
				parms.lastPeriod = period
				if ((effectHandler && effectHandler.allowSampleTrigger === true) || !effectHandler) {
					this.mixer.setSamplePosition(chan, 0)
				}
			}
		}
		const volume = note.volume
		if (volume >= 0) {
			if ((effectHandler && effectHandler.allowVolumeChange === true) || !effectHandler) {
				parms.volume = volume
				parms.lastVolume = volume
			}
		}
		if (note.note === 254) {
			this.mixer.cut(chan)
		}
		if (volumeEffectHandler) {
			volumeEffectHandler.div(this.mixer, chan, volumeEffectParameter, this.playerState, parms, period, note, this.song)
		}
		if (effectHandler) {
			effectHandler.div(this.mixer, chan, parms.effectParameter, this.playerState, parms, period, note, this.song)
		}
		let periodToPlay = parms.period
		if (this.playerState.glissandoControl > 0) {
			const noteNum = NoteData.MOD_PERIOD_TABLE.getNote(periodToPlay)
			periodToPlay = NoteData.MOD_PERIOD_TABLE.getPeriod(noteNum)
		}

		this.mixer.setVolume(chan, parms.volume)
		const freqHz = this.playerState.freq.clock / (periodToPlay * 2) * parms.pitchOfs
		this.mixer.setFrequency(chan, freqHz)

	}

	public handleDiv(row, sampleRate) {
		if (this.loggingEnabled) {
			// console.log(this.rowToText(row))
		}
		for (let chan = 0; chan < this.song.channels; chan++) {
			const note = row[chan]
			this.handleNote(chan, note, sampleRate)
		}
	}

	public rowToText(row) {
		let chan
		let text = "" +
			("000" + this.playerState.pos.toString(16)).slice(-3) + "/" +
			("00" + this.playerState.row.toString(16)).slice(-2) + ": | "

		for (chan = 0; chan < this.song.channels; chan++) {
			const note = row[chan]
			if (note.note > 0) {
				text = text + NoteData.MOD_PERIOD_TABLE.getName(note.note) + " "
			} else {
				text = text + "--- "
			}
			if (note.sampleNumber > 0) {
				text = text + ("0" + note.sampleNumber.toString(16)).slice(-2) + " "
			} else {
				text = text + "-- "
			}
			if (note.volume > 0) {
				text = text + ("0" + note.volume.toString(16)).slice(-2) + " "
			} else {
				text = text + "-- "
			}

			text = text + this.effectMap[note.effect].code + " "
			text = text + ("0" + note.parameter.toString(16)).slice(-2)
			text = text + " | "
		}
		return text
	}

	public registerCallback(callback: (playerState: PlayerState, channelStates: ChannelState[]) => {}) {
		this.stateCallback = callback
	}
}
