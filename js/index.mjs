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
const note_freq = 500;
const sampleRate = 44100;
async function render_message(times) {
	// Now that we have the times, we can create the offline context and schedule the times
	const actx = new OfflineAudioContext({
		sampleRate,
		length: sampleRate * times[times.length - 1] / 1000,
		numberOfChannels: 1 // The output is mono-channel
	});
	const osc = new OscillatorNode(actx, {
		frequency: 0,
		type: 'triangle'
	});
	osc.connect(actx.destination);
	osc.start(0);

	// Schedule the times:
	while (times.length) {
		const start = times.shift() / 1000;
		const end = times.shift() / 1000;

		osc.frequency.setValueAtTime(note_freq, start);
		osc.frequency.setValueAtTime(0, end);
	}

	return await actx.startRendering();
}
function abort() {
	return new Promise(resolve => {
		transmit_btn.addEventListener('click', resolve, { once: true });
		flash_el.addEventListener('fullscreenchange', flash_handle);
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

		// Setup the audio context
		if (!actx) {
			actx = new (window.AudioContext || webkitAudioContext)();
		}

		// I wish JS had `loop`
		while (true) {
			const { code, repeat, audio, torch, screen, dot_time } = get_settings();

			if (!audio && !torch && !screen) {
				alert("Please select at least one transmission type");
				break;
			}

			const times = make_times(code, dot_time);
			let torch_track;
			if (torch) {
				torch_track = await get_torch();
				if (!torch_track) {
					alert("No camera with a suitable torch found.  Transmission cancelled.");
					break;
				}
			}

			// Screen
			if (screen) {
				if (document.fullscreenElement !== flash_el) {
					if ('requestFullscreen' in flash_el) {
						await flash_el.requestFullscreen();
					} else if ('webkitRequestFullscreen' in flash_el) {
						await flash_el.webkitRequestFullscreen();
					}
				}
			}
			// Audio
			let absn;
			if (audio) {
				absn = new AudioBufferSourceNode(actx);
				absn.connect(actx.destination);

				// STATE: render_audio; TRANSITIONS: [rendered]
				const buffer = await render_message(Array.from(times));
				absn.buffer = buffer;
				absn.start();
			}
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
				// Audio
				if (absn) absn.stop();
				// Screen
				if (document.fullscreenElement == flash_el) await document.exitFullscreen();
				// Flash
				if (torch_track) torch_track.stop();

				break;
			}
		}

		transmit_btn.innerText = "Transmit";
	}
})();

/*
// Handle transmission:
let abort = false;


async function transmit() {
	const code = encoded();
	const ot = dot_time();
	const at = 3 * ot;

	// The transmission can only be cancelled during a delay.
	function delay(ms = 100) {
		const start = document.timeline.currentTime || performance.now();
		return new Promise((resolve, reject) => {
			function cancel() {
				clearTimeout(id);
				reject(new TransmitCancel('Abort Signal'))
			}
			function cont() {
				resolve();
				abort.signal.removeEventListener('abort', cancel);
			}
			const t = Math.max(0, Math.round(start + ms - performance.now()));
			const id = setTimeout(cont, t);
			abort.signal.addEventListener('abort', cancel);
		});
	}

	try {
		await init();

		// Wait for 1sec before beginning transmission:
		await delay(1000);

		do {
			for (const sym of code) {
				if (sym == '.') {
					await on();
					await delay(ot);
				} else if (sym == '-') {
					await on();
					await delay(at);
				} else if (sym == ' ') {
					await off();
					await delay(ot);
				} else {
					console.log("Can't transmit character: ", sym);
				}
				await off();
				await delay(ot);
			}
		} while (repeat_on());
	} catch (e) {
		// Only catch transmission cancel errors.
		if (!(e instanceof TransmitCancel)) {
			throw e;
		}
	} finally {
		await close();
		abort = false;
	}
}


const button = document.querySelector('.transmit button');
button.addEventListener('click', ({ target }) => {
	if (abort) {
		abort.abort();
	} else {
		abort = new AbortController();
		target.innerText = "Transmitting...";
		transmit().finally(() => target.innerText = "Transmit");
	}
});
button.disabled = false;
*/