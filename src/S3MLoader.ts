
import { Song } from "./ModLoader"
import { Sample } from "./Sample"
import { Instrument } from "./Instrument"
import { S3M_EFFECT_MAP } from "./Effects"

export function readS3Mfile(data): Song {
	let ofs: number = 0
	let i: number
	const readWord = (ofs1: number) => {
		return (data.charCodeAt(ofs1 + 1) * 256 + data.charCodeAt(ofs1) )
	}
	const readByte = (ofs2) => {
		return (data.charCodeAt(ofs2))
	}

	const s3mHeader = data.substring(0x2c, 0x30)
	if (s3mHeader !== "SCRM" || readWord(0x1c) !== 0x101a ) {
		throw new Error("Invalid S3M file")
	}

	const numOrders = readWord(0x20)
	const numInstruments = readWord(0x22)
	const numPatterns = readWord(0x24)
	const flags = readWord(0x26)
	const createdWithTrackerVersion = readWord(0x28)
	const fileFormatInformation = readWord(0x2a)

	const channelMap = []
	let numChannels = 0
	for (i = 0; i < 32; i++) {
		const chanSettings = readByte(0x40 + i)
		if (chanSettings !== 255 && chanSettings < 128) {
			channelMap[i] = numChannels++
		}
	}

	const masterVolume = readByte(0x33)
	const initialSpeed = readByte(0x31)

	const song: Song = {
		name: data.substring(0, 0x1c),
		type: "S3M",
		masterVolume: masterVolume & 0x7f,
		globalVolume: readByte(0x30),
		initialSpeed: readByte(0x31),
		bpm: null,
		initialBPM: readByte(0x32),
		defaultFreq: { clock: 7159090.5 * 4 },
		effectMap: S3M_EFFECT_MAP,
		fastS3MVolumeSlides: (createdWithTrackerVersion === 0x1300 || (flags && 0x40)),
		channels: numChannels,
		songLength: numOrders,
		songLengthPos: 0,
		orders: [],
		defaultPanPos: [],
		patterns: [],
		instruments: [],
		speed: initialSpeed
	}

	for (i = 0; i < numOrders; i++) {
		const candidateOrder = readByte(0x60 + i)
		song.orders[i] = candidateOrder
	}

	const ppOfs = 0x60 + numOrders
	const instrumentParapointerOfs = ppOfs
	const patternParapointerOfs = ppOfs + numInstruments * 2
	const panPosOfs = patternParapointerOfs + numPatterns * 2

	const defaultPanPos = []

	for (i = 0; i < 32; i++) {
		if (song.masterVolume & 0x80) {
			// console.log("Default pan pos = mono")
			defaultPanPos[i] = 0
		} else {
			if (i % 16 <= 7) {
				defaultPanPos[i] = -0.8
			} else {
				defaultPanPos[i] = 0.8
			}
		}
	}

	const dp = readByte(0x35)
	if (dp === 252) {

		for (i = 0; i < 32; i++) {
			const pp = readByte(panPosOfs + i)
			let panPos
			if (pp & 0x20) {
				panPos = defaultPanPos[i]
			} else {
				const pp2 = pp & 0x0f
				panPos = (pp2 - 7.5) / 7.5
			}
			song.defaultPanPos[channelMap[i]] = panPos
		}
	} else {
		for (i = 0; i < 32; i++) {
			song.defaultPanPos[channelMap[i]] = defaultPanPos[i]
		}
	}

	for (i = 0; i < numPatterns; i++) {
		const pattern = []
		const startOfs = ofs = readWord(patternParapointerOfs + i * 2) * 16
		const ppLength = readWord(ofs + 0)
		ofs += 2
		let row = 0
		while (row < 64) {
			const rowData = []
			let chan
			for (chan = 0; chan < numChannels; chan++) {
				rowData[chan] = {
					sampleNumber: -1,
					note: -1,
					effect: 0,
					parameter: 0,
					volume: -1
				}
			}
			let key = readByte(ofs++)
			while (key !== 0x00) {
				const note = {
					sampleNumber: -1,
					note: -1,
					effect: 0,
					parameter: 0,
					volume: -1
				}
				chan = key & 0x1f
				if (key & 0x20) {
					const b = readByte(ofs++)
					if (b === 255) {
						note.note = -1
					} else if (b === 254) {
						note.note = 254
					} else  {
						const oct = (b & 0xf0) / 16
						const noteNum = b & 0x0f
						note.note = oct * 12 + noteNum
					}
					note.sampleNumber = readByte(ofs++)
				}
				if (key & 0x40) {
					note.volume = readByte(ofs++)
				}
				if (key & 0x80) {
					note.effect = (readByte(ofs++))
					note.parameter = (readByte(ofs++))
				}
				rowData[channelMap[chan]] = note
				key = readByte(ofs++)
			}
			pattern[row] = rowData
			row++
		}
		if ((ofs - startOfs)  !== ppLength) {
			throw new Error("Expected pattern #" + i + " to be " + ppLength + " bytes; actually got " + (ofs - startOfs))
		}
		song.patterns[i] = pattern
	}

	const samples = []
	for (i = 0; i < numInstruments; i++) {
		ofs = readWord(instrumentParapointerOfs + i * 2) * 16
		const insType = data.substring(ofs + 0x4c, ofs + 0x4c + 4)
		if (insType === "SCRS" && readByte(ofs) === 1) {

			const flags2 = readByte(ofs + 0x1f)
			const c2speed = readWord(ofs + 0x20) + (readWord(ofs + 0x22) * 65536)
			const samp =  new Sample(data, {
				name: data.substring(ofs + 1, ofs + 12),
				bits: (flags2 & 0x04) === 0x00 ? 8 : 16,
				channels: (flags2 & 0x02) === 0x00 ? 1 : 2,
				signed: false,
				pitchOfs: c2speed / 8363,
				sampleLength: readWord(ofs + 0x10) + (readWord(ofs + 0x12) * 65536),
				volume: readByte(ofs + 0x1c),
				repeatType: (flags2 & 0x01) !== 0x00 ? "REP_NORMAL" : "NON_REPEATING",
				repeatStart: readWord(ofs + 0x14) + (readWord(ofs + 0x16) * 65536),
				repeatEnd: readWord(ofs + 0x18) + (readWord(ofs + 0x1a) * 65536)
			}, (readByte(ofs + 0x0d) * 65536 + readWord(ofs + 0x0e)) * 16)

			samples[i] = new Instrument({name: "S3M instrument", numSamples: 1}, [samp])

		} else {
			samples[i] = new Instrument({name: "Empty instrument", numSamples: 0}, [{
				name: "--",
				sampleLength: 0,
				repeatStart: 0,
				repeatEnd: 0,
				volume: 0,
				repeatType: "NON_REPEATING",
				bits: 8,
				channels: 1,
				pitchOfs: 1,
				samples: []
			}])
		}
	}
	song.instruments = samples

	return song
}
