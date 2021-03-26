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
				if ('torch' in track.getSettings()) {
					torches.push(track);
				}
			}
		}
		alert("No camera with a suitable flash found.  Transmission cancelled.");
		if (torches.length < 1) throw new Error('No Available Torch');
		return [
			() => torches.forEach(t => t.applyConstraints({ torch: true })),
			() => torches.forEach(t => t.applyConstraints({ torch: false })),
			() => torches.forEach(t => t.stop())
		];
	}
	throw new Error();
}