import { transmit_btn, sound_output, get_settings, torch_check } from './elements.mjs';
import { encode_wav } from './encode_wav.mjs';
import { wait_till, stride, wait } from './lib.mjs';
import './install.mjs';

// The fullscreen element that does screen flashing:
const flash_el = document.getElementById('screen-flash');
flash_el.addEventListener('click', () => {
	if (document.fullscreenElement == flash_el) {
		document.exitFullscreen();
	}
});

// Some silence to play between clicking the transmit button and being done rendering the audio.
const silence = encode_wav({
	length: 60,
	sampleRate: 44100,
	getChannelData() {
		return (new Array(60)).fill(0.0);
	}
})

// This transition occurs when a new service worker claims the page.
const t_sw_update = new Promise(resolve => {
	// I sometimes use an http dev server
	if ('serviceWorker' in navigator) {
		let last_controller = navigator.serviceWorker.controller;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (last_controller) resolve();
			last_controller = navigator.serviceWorker.controller;
		});
	} else {
		console.error("no service worker support.");
	}
});
// Setup service worker
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js');
	});
}

// Helper functions
function make_times(code, dot_time) {
	// Interleaved start / stop times starting with the first start time, and ending with the duration to remain stopped
	// Duration of a dash: 3 * dot_time
	// Duration of the space between a dot and a dash: 1 * dot_time
	// Duration of a space between letters: 3 * dot_time
	// Duration of a space between words: 7 * dot_time

	// 1 space in code == letter space
	// 3 spaces in code == word space

	let times = [];

	let time = 1000; // minimum initial delay of 1sec
	for (const ch of code) {
		if (ch == '.' || ch == '-') {
			times.push(time);
			time += ((ch == '.') ? 1 : 3) * dot_time;
			times.push(time);
			
			// Always include 1 dot_time of silence after a dot/dash
			time += dot_time;
		} else if (ch == ' ') {
			// Letter spaces: 1 + 2 = 3
			time += 2 * dot_time;
			// Word spaces: 1 + (3 * 2) = 7
		} else {
			console.warn('skipping character: ', ch);
		}
	}
	time += 100;
	times.push(time); // Closing delay of 100ms

	return times;
}
// Audio Constants:
const sampleRate = 44100;
async function render_message(times, waveform, frequency) {
	// IOS sucks. I hate it.
	const length = sampleRate * (times[times.length - 1]) / 1000;
	const actx = ('OfflineAudioContext' in window) ? new window.OfflineAudioContext({
		sampleRate,
		length,
		numberOfChannels: 1 // The output is mono-channel
	}) : new window.webkitOfflineAudioContext(1, length, sampleRate);
	const osc = actx.createOscillator();
	osc.type = waveform;
	osc.frequency.value = frequency;
	const volume = actx.createGain();
	volume.gain.value = 0;
	osc.connect(volume);
	volume.connect(actx.destination);
	osc.start(0);

	// We want transitions to take ~4ms: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime#choosing_a_good_timeconstant
	const timeConstant = 4 / 1000 / 3;

	// Schedule the times:
	for (const [start, end] of stride(times, 2)) {
		if (end) {
			volume.gain.setTargetAtTime(volume.gain.defaultValue, start / 1000, timeConstant);
			volume.gain.setTargetAtTime(0, end / 1000, timeConstant);
		}
	}

	// Can't use the promise version of startRendering because Safari doesn't support it
	actx.startRendering();
	const audio_buffer = await wait(actx, 'complete').then(({ renderedBuffer }) => renderedBuffer);

	return encode_wav(audio_buffer);
}

function abort() {
	return new Promise(resolve => {
		transmit_btn.addEventListener('click', resolve, { once: true });
		flash_el.addEventListener('fullscreenchange', flash_handle);
		flash_el.addEventListener('click', resolve, { once: true });
		function flash_handle() {
			if (flash_el !== document.fullscreenElement) {
				flash_el.removeEventListener('fullscreenchange', flash_handle);
				resolve();
			}
		}
	});
}
async function get_torch() {
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
				return track;
			} catch (e) {
				if (!(e instanceof DOMException)) {
					// Only catch DOMExceptions
					throw e;
				}
				track.stop();
			}
		}
	}
}

// Transmitter state machine
(async () => {
	while (true) {
		try {
			const t_transmit = wait(transmit_btn, 'click');

			// STATE: Waiting; TRANSITIONS: [transmit, t_sw_update]
			let update;
			await Promise.race([t_transmit, t_sw_update.then(() => update = true)]);

			// Reload the page if the sw has updated:
			if (update) {
				location.reload();
				break;
			}

			transmit_btn.innerText = "Transmitting...";

			// Handle aborting the transmission
			let aborted = false;
			const t_abort = abort().then(() => aborted = true);

			// I wish JS had `loop`
			let last_settings;
			let times, torch_track, audio_src;
			while (true) {
				const settings = get_settings();

				// Close transmission if the message is empty, or if repeat is off and we've already been through, or if we aborted
				if (settings.code == "" || (!settings.repeat && last_settings) || aborted) {
					settings.audio = settings.torch = settings.screen = false;
				}

				// Construct times if needed.
				if (!times ||
					settings.code !== last_settings?.code ||
					settings.dot_time !== last_settings?.dot_time
				) {
					times = make_times(settings.code, settings.dot_time);
				}

				// Parallel initialization:
				let inits = [];

				// Get / release the torch_track as needed
				if (settings.torch && !torch_track) {
					inits.push(get_torch().then(v => torch_track = v));
				} else if (!settings.torch && torch_track) {
					torch_track.stop();
				}

				// Create + play / release + stop the audio as needed
				if (settings.audio && (!audio_src || 
					settings.code !== last_settings?.code ||
					settings.dot_time !== last_settings?.dot_time ||
					settings.waveform !== last_settings?.waveform ||
					settings.frequency !== last_settings?.frequency
				)) {
					sound_output.pause();
					inits.push(render_message(times, settings.waveform, settings.frequency)
						.then(url => {
							audio_src = url;
							sound_output.src = audio_src;
						})
					);
					// Play some silence while waiting for the song to render.  We need to do this because otherwise the transmit button click won't count as user interaction when we play the audio later on.
					sound_output.src = silence;
					sound_output.play().catch(() => {});
				} else if (!settings.audio && audio_src) {
					sound_output.pause();
					URL.revokeObjectURL(audio_src);
				}

				// Fullscreen / exitFullscreen as needed
				if (settings.screen && !document.body.classList.contains('blinking')) {
					document.body.classList.add('blinking');
					if ('requestFullscreen' in flash_el) {
						inits.push(flash_el.requestFullscreen());
					} else if ('webkitRequestFullscreen' in flash_el) {
						inits.push(flash_el.webkitRequestFullscreen());
					}
				} else if (!settings.screen && document.body.classList.contains('blinking')) {
					document.body.classList.remove('blinking');
					if (document.fullscreenElement == flash_el || document.webkitFullscreenElement == flash_el) {
						if ('exitFullscreen' in document) {
							inits.push(document.exitFullscreen());
						} else if ('webkitExitFullscreen' in document) {
							inits.push(document.webkitExitFullscreen());
						}
					}
				}

				if (inits.length) {
					// STATE: Init; TRANSITIONS: [success, failure]
					try {
						await Promise.all(inits);
					} catch (e) {
						console.error(e);
					}
				}

				// End transmission if there's no ouput types selected (Can happen if none are selected or if we're closing because repeat isn't selected.)
				if (!settings.audio && !settings.torch && !settings.screen) {
					break;
				}
				// End transmission if getting a torch failed
				if (settings.torch && !torch_track) {
					alert("No camera with a suitable torch found.  Transmission cancelled.");
					torch_check.checked = false;
					break;
				}
				
				if (settings.audio && sound_output.paused) {
					// STATE: Play; TRANSITIONS: [playing, failed]
					try {
						await sound_output.play();
					} catch(e) {
						console.error(e);
					}
				}

				// Main thread flashing:
				const start = performance.now();
				if (settings.screen || settings.torch) {
					for (const [on, off] of stride(times, 2)) {
						let t_delay = wait_till(start + on);
						// STATE: Off; TRANSITIONS: [abort, delay]
						await Promise.race([t_abort, t_delay]);
	
						// We only abort during Off so that we know that screen / flash are in their off states
						if (aborted) break;
	
						if (off) {
							// Turn On:
							if (settings.screen) {
								flash_el.style.backgroundColor = "white";
							}
							if (torch_track) {
								// Technically, applyConstraints returns a promise, but we're not waiting it because we don't want to lose our timing.
								torch_track.applyConstraints({ advanced: [{ torch: true }] });
							}
		
							t_delay = wait_till(start + off);
							// STATE: On; TRANSITIONS: [delay]
							await t_delay;
		
							// Turn Off:
							if (settings.screen) {
								flash_el.style.backgroundColor = "black";
							}
							if (torch_track) {
								torch_track.applyConstraints({ advanced: [{ torch: false }] });
							}
						}
					}
				} else {
					const t_delay = wait_till(start + times[times.length - 1]);
					// STATE: Off; TRANSITIONS: [abort, delay]
					await Promise.race([t_abort, t_delay]);
				}
				last_settings = settings;
			}

			transmit_btn.innerText = "Transmit";
		} catch (e) {
			console.error(e);
		}
	}
})();