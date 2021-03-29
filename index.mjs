import { encoded, repeat_on, dot_time } from './options.mjs';
import { init, on, off, close } from './modes.mjs';
import TransmitCancel from './cancel.mjs';

// Customize install:
window.addEventListener('beforeinstallprompt', e => {
	e.preventDefault();

	const btn = document.querySelector('.install button');
	btn.addEventListener('click', () => {
		e.prompt();
	});

	btn.style.display = '';
});

// Handle transmission:
let abort = false;

const flash = document.getElementById('screen-flash');
flash.addEventListener('click', () => {
	if (flash == document.fullscreenElement) {
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

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js');
	});
}