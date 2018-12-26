import { merge, clone, makeArrayOf } from "./Global"

export class Mixer {

	private static STEP_FUNCS = {
		REP_NORMAL(samplePos, samplePosStep, repEnd, repLen) {
			samplePos += samplePosStep
			while (samplePos >= repEnd) {
				samplePos -= repLen
			}
			return samplePos
		},
		NON_REPEATING(samplePos, samplePosStep) {
			return samplePos + samplePosStep
		}
	}

	private static DEFAULT_CHANNEL_STATE = {
		panPos: 0,
		playbackFreqHz: 0,
		sample: undefined,
		samplePosition: -1,
		volume: 64,
		enabled: true
	}

	private globalState: any
	private preMixCallback = null
	private preMixObject = null
	private channelState: any[]

	constructor(globalState, defaultChannelState) {
		this.globalState = merge({
			numChannels: 8,
			volume: 64,
			secondsPerMix: 0.1,
			filters: null
		}, globalState)
		this.preMixCallback = null
		this.preMixObject = null
		this.channelState = []
		const dcs = merge(Mixer.DEFAULT_CHANNEL_STATE, defaultChannelState)
		for (let chan = 0; chan < this.globalState.numChannels; chan++) {
			this.channelState[chan] = clone(dcs)
		}
	}

	public setPreMixCallback(f, c) {
		this.preMixCallback = f
		this.preMixObject = c
	}

	public setGlobalVolume(vol) {
		this.globalState.volume = vol
	}

	public setSecondsPerMix(secondsPerMix) {
		this.globalState.secondsPerMix = secondsPerMix
	}

	public triggerSample(channel, sample, freqHz) {
		this.channelState[channel].sample = sample
		this.channelState[channel].playbackFreqHz = freqHz
		this.channelState[channel].samplePosition = 0
		this.channelState[channel].volume = sample.metadata.volume
	}

	public enableChannels(channels) {
		for (let i = 0; i < channels.length ; i++) {
			this.channelState[channels[i]].enabled = true
		}
	}

	public disableChannels(channels) {
		for (let i = 0; i < channels.length ; i++) {
			this.channelState[channels[i]].enabled = false
		}
	}

	public setSample = function(channel, sample) {
		this.channelState[channel].sample = sample
	}

	public setSamplePosition(channel, offset) {
		const sample = this.channelState[channel].sample
		if (sample) {
			const length = sample.metadata.sampleLength
			if (sample.metadata.repeatType !== "NON_REPEATING") {
				const repStart = sample.metadata.repeatStart
				const repEnd = sample.metadata.repeatEnd
				const repLen = repEnd - repStart
				while (offset > length) {
					offset -= repLen
				}
			}
			if (offset < length) {
				this.channelState[channel].samplePosition = offset
			} else {
				this.channelState[channel].samplePosition = -1
			}
		}
	}

	public setFrequency(channel, freqHz) {
		this.channelState[channel].playbackFreqHz = freqHz
	}

	public setVolume(channel, vol) {
		this.channelState[channel].volume = vol
	}

	public setPanPosition(channel, panPos) {
		this.channelState[channel].panPos = panPos
	}

	public cut(channel) {
		this.channelState[channel].samplePosition = -1
		this.channelState[channel].sample = undefined
	}

	public setFilters(filters) {
		if (filters) {
			this.globalState.filters = filters
		} else {
			this.globalState.filters = null
		}
	}

	public calculatePanMatrix(pp) {
		if (pp >= -1 && pp <= 1) {
			pp = (pp + 1) / 2
			return {
				ll: 1 - pp,
				lr: 0,
				rl: 0,
				rr: pp
			}
		} else {
			return {ll: 1, rr: -1 }
		}
	}

	public mix(sampleRate) {
		if (this.preMixCallback) {
			this.preMixCallback.call(this.preMixObject, this, sampleRate)
		}
		let i = 0
		let chan = 0
		const output = []
		const numSamples = Math.floor(sampleRate * this.globalState.secondsPerMix)
		output[0] = makeArrayOf(0.0, numSamples)
		output[1] = makeArrayOf(0.0, numSamples)
		const numChannels = this.globalState.numChannels
		const globalVolume = this.globalState.volume
		for (chan = 0; chan < numChannels; chan++) {
			const state = this.channelState[chan]
			if (!state.enabled) {
				break
			}

			const panPos = this.calculatePanMatrix(state.panPos)
			const sample = state.sample

			const channelVolume = state.volume
			let samplePos = state.samplePosition
			const samplePosStep = state.playbackFreqHz / sampleRate
			const scale = (1 / (numChannels / 2)) * (globalVolume / 64) * (channelVolume / 64)
			const leftScale = scale * panPos.ll
			const rightScale = scale * panPos.rr
			if (sample && sample.data[0] && samplePos >= 0 && samplePosStep > 0) {
				const leftSampleData = sample.data[0]
				const rightSampleData = sample.data[1] || sample.data[0]
				const sampleLength = sample.metadata.sampleLength
				const repStart = sample.metadata.repeatStart
				const repEnd = sample.metadata.repeatEnd
				const repLen = repEnd - repStart
				const stepFunc = Mixer.STEP_FUNCS[sample.metadata.repeatType]
				for (i = 0; (i < numSamples) && (samplePos < sampleLength); i++) {
					output[0][i] += (leftSampleData[Math.floor(samplePos)] * leftScale)
					output[1][i] += (rightSampleData[Math.floor(samplePos)] * rightScale)
					samplePos = stepFunc(samplePos, samplePosStep, repEnd, repLen)
				}
			}
			state.samplePosition = samplePos
		}
		if (this.globalState.filters) {
			const filters = this.globalState.filters
			for (i = 0; i < numSamples; i++) {
				output[0][i] = filters[0].next(output[0][i])
				output[1][i] = filters[1].next(output[1][i])
			}
		}
		return {
			bufferSize: numSamples,
			output
		}
	}
}
