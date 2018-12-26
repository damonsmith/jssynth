
export function clone(obj) {
	const newObj = {}

	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			newObj[key] = obj[key]
		}
	}
	return newObj
}

export function merge(existingObj, toMerge) {
	const newObj = clone(existingObj)

	if (toMerge !== undefined && toMerge !== null) {
		for (const key in toMerge) {
			if (toMerge.hasOwnProperty(key)) {
				newObj[key] = toMerge[key]
			}
		}
	}
	return newObj
}

export function makeArrayOf(value: any, length: number): any[] {
	const arr = []
	let i = length
	while (i--) {
		arr[i] = value
	}
	return arr
}

export function additiveSynth(length, sampleRate, baseFreq, harmonics, globalVolume, state) {
	const results = makeArrayOf(0.0, length)
	const synthState = state || {}

	if (synthState.ofs === undefined) {
		synthState.ofs = 0
	}
	for (let h = 0; h < harmonics.length; h++) {
		let freq = baseFreq * harmonics[h].freqMul
		freq = freq * harmonics[h].random
		if (freq < (sampleRate / 2)) {
			const scale = Math.pow(10, harmonics[h].dB / 10) * (globalVolume / 64)
			for (let i = 0; i < length; i++) {
				results[i] += Math.cos(2 * Math.PI * (freq / sampleRate) * (synthState.ofs + i)) * scale
			}
		}
	}
	synthState.ofs += length
	return results
}
