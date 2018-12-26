import { merge } from "./Global"

export class Instrument {

	private static DEFAULT_INSTRUMENT_METADATA = {
		noteToSampleMap: [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
		],

		volumeType: 0,
		volumeEnvelope: [],
		numVolumePoints: 0,
		volumeSustainPoint: 0,
		volumeLoopStartPoint: 0,
		volumeLoopEndPoint: 0,

		panningType: 0,
		panningEnvelope: [],
		numPanningPoints: 0,
		panningSustainPoint: 0,
		panningLoopStartPoint: 0,
		panningLoopEndPoint: 0,

		vibratoType: 0,
		vibratoSweep: 0,
		vibratoDepth: 0,
		vibratoRate: 0,

		volumeFadeout: 0
	}

	public metadata: any
	public samples: any[]

	constructor(metadata, samples) {
		this.metadata = merge(Instrument.DEFAULT_INSTRUMENT_METADATA, metadata)
		this.samples = samples
	}
}
