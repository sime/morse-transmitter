// import './safari-debugging.mjs';
import { transmit_btn, get_settings } from './elements.mjs';
import './install.mjs';

// The fullscreen element that does screen flashing:
const flash_el = document.getElementById('screen-flash');
flash_el.addEventListener('click', () => {
	if (document.fullscreenElement == flash_el) {
		document.exitFullscreen();
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
	// Interleaved start / stop times starting with the first start time
	let times = [];

	let time = 1000; // minimum initial delay of 1sec
	for (const ch of code) {
		if (ch == '.' || ch == '-') {
			times.push(time);
			time += ((ch == '.') ? 1 : 3) * dot_time;
			times.push(time);
		} else if (ch == ' ') {
			time += 3 * dot_time;
		} else {
			console.warn('skipping character: ', ch);
		}
		time += dot_time;
	}
	return times;
}
function wait(target, ev, options = {}) {
	return new Promise(res => target.addEventListener(ev, res, {
		once: true,
		...options
	}));
}
// Audio Constants:
const sampleRate = 44100;
async function render_message(times, waveform, frequency) {
	// IOS sucks. I hate it.
	const length = sampleRate * times[times.length - 1] / 1000;
	const actx = ('OfflineAudioContext' in window) ? new window.OfflineAudioContext({
		sampleRate,
		length,
		numberOfChannels: 1 // The output is mono-channel
	}) : new window.webkitOfflineAudioContext(1, length, sampleRate);
	const osc = actx.createOscillator();
	osc.type = waveform;
	osc.frequency.value = 0;
	osc.connect(actx.destination);
	osc.start(0);

	// Schedule the times:
	while (times.length) {
		const start = times.shift() / 1000;
		const end = times.shift() / 1000;

		osc.frequency.setValueAtTime(frequency, start);
		osc.frequency.setValueAtTime(0, end);
	}

	// Can't use the promise version of startRendering because Safari doesn't support it
	actx.startRendering();
	return await wait(actx, 'complete').then(({ renderedBuffer }) => renderedBuffer);
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
function wait_till(stamp) {
	return new Promise(resolve => {
		const diff = stamp - performance.now();
		if (diff > 0) setTimeout(resolve, diff);
		else resolve();
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
	transmit_btn.disabled = false;

	let actx;

	while (true) {
		const t_transmit = wait(transmit_btn, 'click');

		// STATE: Waiting; TRANSITIONS: [transmit]
		await t_transmit;

		transmit_btn.innerText = "Transmitting...";

		// Handle aborting the transmission
		let aborted = false;
		const t_abort = abort().then(() => aborted = true);

		// I wish JS had `loop`
		while (true) {
			const {
				code,
				repeat,
				audio, torch, screen,
				dot_time,
				waveform, frequency
			} = get_settings();

			if (!audio && !torch && !screen) {
				alert("Please select at least one transmission type");
				break;
			}

			const times = make_times(code, dot_time);

			let torch_track, absn, dummy;
			// Parallelize the initialization calls:
			const inits = [];
			if (torch) {
				inits.push(get_torch().then(v => torch_track = v));
			}
			if (screen && document.fullscreenElement !== flash_el) {
				document.body.classList.add('blinking');
				if ('requestFullscreen' in flash_el) {
					inits.push(flash_el.requestFullscreen());
				} else if ('webkitRequestFullscreen' in flash_el) {
					inits.push(flash_el.webkitRequestFullscreen());
				}
			}
			if (audio) {
				// Setup the audio context
				if (!actx || actx.state == 'closed') {
					actx = new (window.AudioContext || webkitAudioContext)();
				} else if (actx.state == 'suspended') {
					actx.resume();
				}
				absn = actx.createBufferSource();
				absn.connect(actx.destination);

				inits.push(render_message(Array.from(times), waveform, frequency).then(buffer => absn.buffer = buffer));
			}
			try {
				// STATE: Initialization; TRANSITIONS: [success, failed]
				await Promise.all(inits);
			} catch (e) {
				console.error(e);
				break;
			}

			if (torch && !torch_track) {
				alert("No camera with a suitable torch found.  Transmission cancelled.");
				break;
			}

			if (dummy) dummy.stop();
			if (absn) absn.start();
			const start = performance.now();

			// Main thread flashing:
			while (times.length) {
				let on = times.shift() + start;
				let off = times.shift() + start;

				let t_delay = wait_till(on);
				// STATE: black; TRANSITIONS: [abort, delay]
				await Promise.race([t_abort, t_delay]);

				// We only abort during black so that we know that screen / flash are in their off states
				if (aborted) break;

				// Turn On:
				if (screen) {
					flash_el.style.backgroundColor = "white";
				}
				if (torch_track) {
					// Technically, applyConstraints returns a promise, but we're not waiting it because we don't want to lose our timing.
					torch_track.applyConstraints({ advanced: [{ torch: true }] });
				}

				t_delay = wait_till(off);
				// STATE: white; TRANSITIONS: [delay]
				await t_delay;

				// Turn Off:
				if (screen) {
					flash_el.style.backgroundColor = "black";
				}
				if (torch_track) {
					torch_track.applyConstraints({ advanced: [{ torch: false }] });
				}
			}

			if (!repeat || aborted) {
				document.body.classList.remove('blinking');
				let closes = [];
				// Audio
				if (absn) absn.stop();
				if (actx && actx.state == 'running') {
					closes.push(actx.suspend());
				}
				// Screen
				if (document.fullscreenElement == flash_el) {
					closes.push(document.exitFullscreen());
				}
				// Flash
				if (torch_track) torch_track.stop();

				// STATE: Closing; TRANSITIONS: [closed]
				await Promise.all(closes);

				break;
			}
		}

		transmit_btn.innerText = "Transmit";
	}
})();