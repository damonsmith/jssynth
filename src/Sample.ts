
import { merge } from "./Global"

interface SampleMetadata {
	name: string
	bits?: number
	channels?: number
	little_endian?: boolean
	delta_encoding?: boolean
	signed?: boolean
	sampleRate?: number
	representedFreq?: number
	pitchOfs?: number
	repeatType?: "NON_REPEATING" | "REP_NORMAL"
	volume?: number
	repeatStart?: number
	repeatEnd?: number
	sampleLength: number
}

type SampleDataFunction = () => number[]

export class Sample {

	private static DEFAULT_SAMPLE_METADATA: SampleMetadata = {
		name: "",
		bits: 24,
		channels: 2,
		little_endian: true,
		delta_encoding: false,
		signed: true,
		sampleRate: 44100,
		representedFreq: 440,
		pitchOfs: 1,
		repeatType: "NON_REPEATING",
		volume: 64,
		repeatStart: 0,
		repeatEnd: 0,
		sampleLength: 0
	}

	private data: number[]
	private metadata: any

	constructor(sampleData: string | SampleDataFunction, metadata: SampleMetadata, offset: number) {
		if (typeof sampleData === "function") {
			this.data = sampleData()
		} else {
			this.data = this.convertSamplesBytesToDoubles(sampleData, metadata, offset)
		}
		this.metadata = merge(Sample.DEFAULT_SAMPLE_METADATA, metadata)
		if (this.metadata.repeatType !== "NON_REPEATING") {
			for (let c = 0; c < this.data.length; c++) {
				this.data[c][metadata.repeatEnd + 1] = this.data[c][metadata.repeatEnd]
			}
		}
	}

	private convertSamplesBytesToDoubles(samples, metadata, offset) {
		const startOfs = offset || 0
		const channelData = []
		const rawData = []
		const meta = merge(Sample.DEFAULT_SAMPLE_METADATA, metadata) as SampleMetadata
		for (let c1 = 0; c1 < meta.channels; c1++) {
			channelData[c1] = []
			rawData[c1] = []
		}
		if (meta.bits % 8 !== 0 || meta.bits > 24) {
			throw new Error("can only read 8, 16 or 24-bit samples")
		}
		const bytesPerSample = meta.bits / 8
		const bytesPerSamplePeriod = bytesPerSample * meta.channels
		const periodsToRead = metadata.sampleLength
		for (let i = 0 ; i < periodsToRead; i++) {
			const ofs = bytesPerSamplePeriod * i
			for (let chan = 0; chan < meta.channels; chan++) {
				const chanOfs = ofs + chan * bytesPerSample
				const startBytePos = chanOfs + (meta.little_endian ? (bytesPerSample - 1) : 0)
				const endBytePos = chanOfs + (meta.little_endian ? -1 : bytesPerSample)
				const bytePosDelta = (meta.little_endian ? -1 : 1)
				let data = 0
				let scale = 0.5
				let mask = 255
				for (let bytePos = startBytePos; bytePos !== endBytePos; bytePos += bytePosDelta) {
					data = data * 256 + samples.charCodeAt(startOfs + bytePos)
					scale = scale * 256
					mask = mask * 256 + 255
				}
				if (meta.signed) {
					data = (data ^ scale) & mask
				}
				if (meta.delta_encoding) {
					const previousVal = ((i === 0) ? 0x00 : rawData[chan][i - 1])
					rawData[chan][i] = (previousVal + ((data ^ scale) & mask)) & 0xff
					channelData[chan][i] = (((rawData[chan][i] ^ scale) & mask) - scale) / scale
				} else {
					data = (data - scale) / scale
					channelData[chan][i] = data
				}
			}
		}
		return channelData
	}
}
