import table from './morse-table.mjs';
import './install.mjs';

// Setup service worker
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js');
	});
}


// Get elements
const transmit_btn = document.querySelector('#transmit button');
const message_area = document.querySelector('textarea');
const repeat_check = document.getElementById('repeat-on');
const audio_check = document.getElementById('audio-on');
const torch_check = document.getElementById('torch-on');
const screen_check = document.getElementById('screen-on');
const dot_time_number = document.getElementById('dot-duration');
const code_output = document.getElementById('translated');
// const wpm_el = document.getElementById('wpm');


// Show the code as the user types their message
function update_output() {
	code_output.innerText = get_code();
}
update_output();
message_area.addEventListener('input', update_output);



// Helper functions
function wait(target, ev, options = {}) {
	return new Promise(res => target.addEventListener(ev, res, {
		once: true,
		...options
	}));
}
function get_code() {
	let code = "";
	for (const ch of message_area.value) {
		code += (table[ch.toLowerCase()] ?? ch) + ' ';
	}
	return code;
}
// Audio Constants:
const note_freq = 500;
const sampleRate = 44100;
async function render_message(code) {
	const dot_time = Number.parseInt(dot_time_number.value) / 1000;

	// Interleaved start / stop times starting with the first start time
	let times = [];

	let time = 1; // minimum initial delay of 1sec
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

	// Now that we have the times, we can create the offline context and schedule the times
	const actx = new OfflineAudioContext({
		sampleRate,
		length: sampleRate * time,
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
		const start = times.shift();
		const end = times.shift();
		console.assert(start && end);
		console.assert(end > start);

		osc.frequency.setValueAtTime(note_freq, start);
		osc.frequency.setValueAtTime(0, end);
	}

	return await actx.startRendering();
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

		// Setup the audio context
		if (!actx) {
			actx = new (window.AudioContext || webkitAudioContext)();
		}

		const absn = new AudioBufferSourceNode(actx);
		absn.connect(actx.destination);
		function change_loop() {
			absn.loop = repeat_check.checked;
		}
		repeat_check.addEventListener('change', change_loop);
		change_loop();

		// STATE: render_audio; TRANSITIONS: [rendered]
		const buffer = await render_message(get_code());
		absn.buffer = buffer;
		absn.start();

		const t_ended = wait(absn, 'ended');
		const t_aborted = wait(transmit_btn, 'click').then(() => {
			absn.stop();
		});

		// STATE: transmitting; TRANSITIONS: [ended, aborted]
		await Promise.race([t_ended, t_aborted]);

		absn.disconnect();
		repeat_check.removeEventListener('change', change_loop);

		transmit_btn.innerText = "Transmit";
	}
})();

/*
// Handle transmission:
let abort = false;

const flash = document.getElementById('screen-flash');
flash.addEventListener('click', () => {
	if (document.body.classList.contains('blinking')) {
		if (abort) abort.abort();
		document.exitFullscreen();
	}
});
// This makes it so that even if the user exits full screen by not clicking flash (like pressing escape) the transmission will still be aborted.
flash.addEventListener('fullscreenchange', () => {
	if (flash !== document.fullscreenElement && abort) {
		abort.abort();
	}
});

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