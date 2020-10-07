class VolumeProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.instant = 0.0;
		this.averaged = 0.0;
	}
	process(inputs, outputs, parameters) {
		// take the first output
		const input = inputs[0];
		// fill each channel with random values multiplied by gain
		if (input.length == 0) {
			return true;
		}
		const samples = input[0];

		let sum = 0.0;
		for (let i = 0; i < samples.length; i++) {
			sum += samples[i] * samples[i];
		}
		this.instant = Math.sqrt(sum / samples.length);
		this.averaged = 0.95 * this.averaged + 0.05 * this.instant;
		this.port.postMessage({ volume: this.averaged });
		// console.log(this.averaged);
		return true;
	}
}
registerProcessor('volume-processor', VolumeProcessor);
