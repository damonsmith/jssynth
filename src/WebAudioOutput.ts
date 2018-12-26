export class WebAudioOutput {

	public context: AudioContext
	public mode: "MODE_WEBKIT"
	public node: ScriptProcessorNode
	public nextSamples: number[]
	public nextSamplesOffset: number

	public audioContextSupported = window.hasOwnProperty("AudioContext")

	constructor(mixer, bufferSize) {

		const DEFAULT_WA_BUF_SIZE = 2048
		const DEFAULT_WA_NUM_OUTPUT_CHANNELS = 2

		if (this.audioContextSupported) {
			this.context = new AudioContext()
			this.mode = "MODE_WEBKIT"
			this.node = this.context.createScriptProcessor(bufferSize || DEFAULT_WA_BUF_SIZE, 0, DEFAULT_WA_NUM_OUTPUT_CHANNELS)
			this.nextSamples = null
			this.nextSamplesOffset = 0

			const processSamples = function(event) {
				const outputBuffer = event.outputBuffer
				const sampleRate = outputBuffer.sampleRate
				const bufferLength = outputBuffer.length
				const channelData = [outputBuffer.getChannelData(0), outputBuffer.getChannelData(1)]
				let outputOfs = 0

				while (outputOfs < bufferLength) {

					let i

					if (!this.nextSamples) {
						this.nextSamples = mixer.mix(sampleRate)
						this.nextSamplesOffset = 0
					}

					for (let chan = 0; chan < DEFAULT_WA_NUM_OUTPUT_CHANNELS; chan++) {
						for (i = 0;
							((this.nextSamplesOffset + i) < this.nextSamples.bufferSize) &&
							((i + outputOfs) < bufferLength);
							i++) {
							channelData[chan][outputOfs + i] = this.nextSamples.output[chan][this.nextSamplesOffset + i]
						}
					}
					outputOfs += i
					this.nextSamplesOffset += i

					if (this.nextSamplesOffset >= this.nextSamples.bufferSize) {
						this.nextSamples = null
					}
				}
			}

			this.node.onaudioprocess = processSamples

		}
	}

	public start() {
		if (this.audioContextSupported) {
			this.node.connect(this.context.destination)
		}
	}

	public stop() {
		if (this.audioContextSupported) {
			this.node.disconnect()
		}
	}
}
