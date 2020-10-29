class VolumeProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.instant = 0.0;
		this.volume = 0.0;
		this.smoothing_factor = 0.98;
		this.minimum_value = 0.01;
		this.updateIntervalMS = 50;
		this.nextUpdateFrame = this.updateIntervalMS;
	}

	process (inputs, outputs, parameters) {
		// take the first output
		if (inputs.length == 0) {
			return true;
		}
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
		this.instant = Math.sqrt(sum / samples.length); // RMS
		this.volume = Math.max(this.instant, this.volume * this.smoothing_factor);
		if (this.volume < this.minimum_value) {
			this.volume = 0;
		}
		this.nextUpdateFrame -= samples.length;
		if (this.nextUpdateFrame < 0) {
			this.nextUpdateFrame += this.intervalInFrames;
			this.port.postMessage({ volume: this.volume });
		}
		return true;
	}

	get intervalInFrames () {
		return this.updateIntervalMS / 1000 * sampleRate;
	}
}
registerProcessor('volume-processor', VolumeProcessor);
