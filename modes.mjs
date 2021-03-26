import { audio_on, torch_on, screen_on } from './options.mjs';

const flash = document.getElementById('screen-flash');
let audio_context;

let flash_style;
let audio;
let torches;

async function get_torches() {
	const torches = [];
	const devices = await navigator.mediaDevices.enumerateDevices();
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
	return torches;
}

export async function init() {
	if (!screen_on() && !audio_on() && !torch_on()) {
		alert('Please select at least one transmit mode and then press transmit.');
		throw new Error("No modes selected.");
	}
	if (screen_on()) {
		flash_style = flash.style;
		flash_style.backgroundColor = 'black';
		if (document.fullscreenElement !== flash) {
			await flash.requestFullscreen();
		}
	}
	if (audio_on()) {
		if (!audio_context) {
			// Audio context should be created as part of a user interaction.
			audio_context = new AudioContext();
			const synth = audio_context.createOscillator();
			synth.connect(audio_context.destination);
			synth.start();
			if (audio_context.state == 'running') {
				audio_context.suspend();
			}
		}
		audio = audio_context;
	}
	if (torch_on()) {
		torches = await get_torches();
	}
}

export async function on() {
	if (flash_style) {
		flash_style.backgroundColor = 'white';
	}
	if (audio && audio.state !== 'running') {
		audio.resume();
	}
	if (torches) {
		for (const track of torches) {
			await track.applyConstraints({ advanced: [{ torch: true }] });
		}
	}
}
export async function off() {
	if (flash_style) {
		flash_style.backgroundColor = 'black';
	}
	if (audio && audio.state == 'running') {
		audio.suspend();
	}
	if (torches) {
		for (const track of torches) {
			await track.applyConstraints({ advanced: [{ torch: false }] });
		}
	}
}
export async function close() {
	flash.style.backgroundColor = '';
	if (document.fullscreenElement == flash) {
		await document.exitFullscreen();
	}
	flash_style = false;

	if (audio && audio.state !== 'suspended') {
		audio.suspend();
	}
	audio = false;

	if (torches) {
		torches.forEach(t => t.stop());
	}
	torches = false;
}