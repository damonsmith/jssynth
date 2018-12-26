
import { Sample } from "./Sample"
import { Instrument } from "./Instrument"
import { FrequencyType } from "./ModPlayer"
import { MOD_EFFECT_MAP } from "./Effects"
import { NoteData } from "./NoteData"

export interface Song {
	name: string
	type: string
	channels: number
	effectMap: any
	songLengthPos: number
	songLength: number
	orders: number[]
	patterns: number[][]
	instruments: Instrument[]
	defaultFreq: FrequencyType
	speed: number
	bpm: number
	initialSpeed: number
	initialBPM: number
	globalVolume: number
	fastS3MVolumeSlides: number | boolean
	defaultPanPos: number[]
	masterVolume: number
}

interface Note {
	sampleNumber: number
	note: number
	effect: number
	parameter: number
	volume: number
}

interface ModType {
	key: string
	channels: number
	instruments: number
}

export class MODLoader {

	public static EIGHTH_SEMITONE_MULTIPLIER = Math.pow(2, 1 / (12 * 8))

	public static MOD_FINETUNE_TABLE = [ 0, 1, 2, 3, 4, 5, 6, 7, -8, -7, -6, -5, -4, -3, -2, -1 ]

	public static readMODfile(data) {
		let i
		const modType = data.substring(1080, 1084)
		const modTypeData = MODLoader.MODTypes[modType] || { key: "NOIS", channels: 4, instruments: 15 }
		const songLengthPos = 20 + (30 * modTypeData.instruments)

		const song: Song = {
			name: data.substring(0, 20),
			type: modTypeData.key,
			channels: modTypeData.channels,
			effectMap: MOD_EFFECT_MAP,
			songLength: data.charCodeAt(songLengthPos),
			songLengthPos,
			orders: [],
			patterns: [],
			instruments: [],
			defaultPanPos: [],
			defaultFreq: null,
			speed: null,
			bpm: null,
			initialSpeed: null,
			initialBPM: null,
			globalVolume: null,
			masterVolume: null,
			fastS3MVolumeSlides: 0
		}

		let maxPatternNum = 0
		for (i = 0; i < 128; i++) {
			song.orders[i] = data.charCodeAt(songLengthPos + 2 + i)
			if (song.orders[i] > maxPatternNum) {
				maxPatternNum = song.orders[i]
			}
		}

		let patternOfs = songLengthPos + 130
		if (modTypeData.instruments > 15) {
			patternOfs += 4
		}

		for (i = 0; i <= maxPatternNum; i++) {
			const pattern = []
			const ofs = patternOfs + (64 * 4 * modTypeData.channels * i)
			let row
			for (row = 0; row < 64; row++) {
				const rowData = []
				let chan
				for (chan = 0; chan < modTypeData.channels; chan++) {

					const chanOfs = ofs + (row * 4 * modTypeData.channels) + chan * 4
					const b1 = data.charCodeAt(chanOfs)
					const b2 = data.charCodeAt(chanOfs + 1)
					const b3 = data.charCodeAt(chanOfs + 2)
					const b4 = data.charCodeAt(chanOfs + 3)

					const period = (((b1 & 0x0f) * 256) + b2) * 4

					const note: Note = {
						note: (period === 0) ? -1 : NoteData.MOD_PERIOD_TABLE.getNote(period),
						effect: b3 & 0x0f,
						parameter: b4,
						volume: -1,
						sampleNumber: (b1 & 0xf0) + ((b3 & 0xf0) / 16)
					}
					rowData.push(note)
				}
				pattern.push(rowData)
			}
			song.patterns.push(pattern)
		}

		let sampleOfs = patternOfs + (64 * 4 * modTypeData.channels * (maxPatternNum + 1))

		const modInstruments = []

		for (i = 0; i < modTypeData.instruments; i++) {
			const insOffset = 20 + 30 * i

			const sampleLength = this.readWord(insOffset + 22, data) * 2
			const repeatLength = this.readWord(insOffset + 28, data) * 2
			const sampleName = data.substring(insOffset, insOffset + 22)
			const sample = new Sample(data, {
				name: sampleName,
				bits: 8,
				channels: 1,
				signed: true,
				pitchOfs:
					Math.pow(MODLoader.EIGHTH_SEMITONE_MULTIPLIER, MODLoader.MOD_FINETUNE_TABLE[data.charCodeAt(insOffset + 24)]),
				sampleLength,
				volume: data.charCodeAt(insOffset + 25),
				repeatType: repeatLength > 2 ? "REP_NORMAL" : "NON_REPEATING",
				repeatStart: this.readWord(insOffset + 26, data) * 2,
				repeatEnd: this.readWord(insOffset + 26, data) * 2 + repeatLength
			}, sampleOfs)
			sampleOfs += sampleLength

			modInstruments[i] = new Instrument({name: sampleName, numSamples: 1}, [sample])
		}
		song.instruments = modInstruments

		return song
	}

	private static MODTypes: { [key: string]: ModType } = {
		"M.K.": { key: "M.K.", channels: 4, instruments: 31 },
		"M!K!": { key: "M!K!", channels: 4, instruments: 31 },
		"FLT4": { key: "FLT4", channels: 4, instruments: 31 },
		"4CHN": { key: "4CHN", channels: 4, instruments: 31 },
		"6CHN": { key: "6CHN", channels: 6, instruments: 31 },
		"FLT8": { key: "FLT8", channels: 8, instruments: 31 },
		"8CHN": { key: "8CHN", channels: 8, instruments: 31 },
		"16CH": { key: "16CH", channels: 16, instruments: 31 }
	}

	private static readWord(ofs, data) {
		return (data.charCodeAt(ofs) * 256 + data.charCodeAt(ofs + 1) )
	}

}
