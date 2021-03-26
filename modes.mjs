import { mode } from './options.mjs';

const flash = document.getElementById('screen-flash');
let audio, gain;

export async function rename_me() {
	const m = mode();
	if (m == 'screen') {
		await flash.requestFullscreen();
		return [
			() => flash.style.backgroundColor = 'white',
			() => flash.style.backgroundColor = 'black',
			async () => {
				flash.style.backgroundColor = '';
				if (flash == document.fullscreenElement) {
					document.exitFullscreen();
				}
			}
		];
	} else if (m == 'audio') {
		if (!audio) {
			// Audio context should be created as part of a user interaction.
			audio = new AudioContext();
			const synth = audio.createOscillator();
			gain = audio.createGain();
			synth.connect(gain);
			gain.connect(audio.destination);
			synth.start();
			gain.gain.value = 0;
		}
		if (audio.state == 'suspended') {
			audio.resume();
		}
		return [
			() => gain.gain.value = 1,
			() => gain.gain.value = 0,
			() => {
				audio.suspend();
			}
		];
	} else if (m == 'torch') {
		const devices = await navigator.mediaDevices.enumerateDevices();
		const torches = [];
		for (const device of devices) {
			if (device.kind !== 'videoinput') continue;

			const device_stream = await navigator.mediaDevices.getUserMedia({
				video: { deviceId: device.deviceId }
			});

			for (const track of device_stream.getVideoTracks()) {
				// The last method I tried of checking if 'torch' was in the track's settings (which should be all settings supported and not just the settings we've set) didn't work.
				// New attempt is to just apply the constraint and if the torch constraint isn't supported then we'll get a DOMException saying so.
				try {
					await track.applyConstraints({ advanced: [{ torch: false }] });
					torches.push(track);
				} catch (e) {
					if (!(e instanceof DOMException)) {
						// Only catch DOMExceptions
						throw e;
					}
					track.stop();
				}
			}
		}
		if (torches.length < 1) {
			alert("No camera with a suitable flash found.  Transmission cancelled.");
			throw new Error('No Available Torch');
		}
		return [
			() => torches.forEach(t => t.applyConstraints({ advanced: [{ torch: true }] })),
			() => torches.forEach(t => t.applyConstraints({ advanced: [{ torch: false }] })),
			() => torches.forEach(t => t.stop())
		];
	}
	throw new Error();
}