import { mode } from './options.mjs';

const flash = document.getElementById('screen-flash');

const audio = new AudioContext();
const synth = audio.createOscillator();
const gain = audio.createGain();
synth.connect(gain);
gain.connect(audio.destination);
synth.start();

export function rename_me() {
	const m = mode();
	if (m == 'screen') {
		return [
			() => flash.requestFullscreen(),
			() => flash.style.backgroundColor = 'white',
			() => flash.style.backgroundColor = 'black',
			() => {
				flash.style.backgroundColor = '';
				if (flash == document.fullscreenElement) {
					document.exitFullscreen();
				}
			}
		];
	} else if (m == 'audio') {
		return [
			() => {
				audio.resume();
				gain.gain.value = 0;
			},
			() => gain.gain.value = 1,
			() => gain.gain.value = 0,
			() => {
				audio.suspend();
			}
		];
	} else if (m == 'torch') {
		return [
			// TODO: Camera Torch
		];
	}
	throw new Error();
}