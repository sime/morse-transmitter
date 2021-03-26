import { wrap_signal } from './lib/wrap-signal.mjs';
import { encoded, repeat, dot_time } from './options.mjs';
import { rename_me } from './modes.mjs';

let abort = false;

function delay(ms = 100) {
	return new Promise(resolve => setTimeout(resolve, ms));
};

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
	const wrap = wrap_signal(abort.signal);
	const code = encoded();
	const ot = dot_time();
	const at = 3 * ot;

	let on, off, close;
	try {
		[on, off, close] = await rename_me(abort);

		// Wait for 1sec after going full screen before beginning transmission:
		await wrap(delay(1000));

		do {
			for (const sym of code) {
				if (sym == '.') {
					on();
					await wrap(delay(ot));
				} else if (sym == '-') {
					on();
					await wrap(delay(at));
				} else if (sym == ' ') {
					off();
					await wrap(delay(ot));
				} else {
					console.log("Can't transmit character: ", sym);
				}
				off();
				await wrap(delay(ot));
			}
		} while (repeat());
	} catch (e) { console.warn(e); } finally {
		if (close) {
			await close();
		}
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

