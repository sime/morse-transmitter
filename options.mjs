/**
 * Turn all the inputs in the page into reactive signals.
 */
import { context, computed, signal } from './lib/index.mjs';
import table from './morse-table.mjs';

// Check if the browser knows about the 'torch' camera capability (Currently just Chrome and Opera)
if ('mediaDevices' in navigator && navigator.mediaDevices.getSupportedConstraints()['torch']) {
	// TODO: See if there's a way to turn on the torch using ImageCapture + fillLightMode
	document.getElementById('torch-on').removeAttribute('disabled');
}

function input_value(el) {
	const [getter, setter] = signal(el.value);
	el.addEventListener('input', () => setter(el.value));
	return getter;
}
function input_checked(el) {
	const [getter, setter] = signal(el.checked);
	el.addEventListener('click', () => setter(el.checked));
	return getter;
}
function manual(func) {
	const [getter, setter] = signal();
	func(setter);
	return getter;
}

export const plain_text = input_value(document.querySelector('textarea'));

export const repeat_on = input_checked(document.getElementById('repeat-on'));
export const audio_on = input_checked(document.getElementById('audio-on'));
export const torch_on = input_checked(document.getElementById('torch-on'));
export const screen_on = input_checked(document.getElementById('screen-on'));

export const dot_time = manual(setter => {
	const dd_el = document.getElementById('dot-duration');
	const wpm_el = document.getElementById('wpm');

	// Setup the little buttons before / after the input[type="number"] elements
	for (const num_el of [dd_el, wpm_el]) {
		num_el.previousElementSibling.addEventListener('click', () => {
			num_el.value = Number.parseInt(num_el.value) - 1;
			num_el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		num_el.nextElementSibling.addEventListener('click', () => {
			num_el.value = Number.parseInt(num_el.value) + 1;
			num_el.dispatchEvent(new Event('input', { bubbles: true }));
		});
	}

	function dd_input() {
		setter(Number.parseInt(dd_el.value));

		wpm_el.value = 1200 / dd_el.value;
	}
	dd_el.addEventListener('input', dd_input);
	wpm_el.addEventListener('input', () => {
		setter(1200 / Number.parseInt(wpm_el.value));

		dd_el.value = 1200 / wpm_el.value;
	});
	dd_input();
	wpm_el.removeAttribute('disabled');
});

export const encoded = computed(() => {
	let encoded = "";
	for (const word of plain_text().split(' ')) {
		for (const ch of word.split('')) {
			const code = table[ch.toLowerCase()];
			if (code !== undefined) {
				encoded += code;
			} else {
				encoded += ch
			}
			encoded += ' ';
		}
		encoded += ' ';
	}
	return encoded;
});

// Update the code element in real-time
const code_el = document.getElementById('translated');
context(() => code_el.innerText = encoded());

// Update local / session storage with options
context(() => {
	sessionStorage.setItem('plain-text', plain_text());
});
context(() => {
	const dd = dot_time().toString();
	localStorage.setItem('dot-duration', dd);
});
context(() => {
	localStorage.setItem('audio-on', audio_on());
});
context(() => {
	localStorage.setItem('torch-on', torch_on());
});
context(() => {
	localStorage.setItem('screen-on', screen_on());
});
context(() => {
	localStorage.setItem('repeat-on', repeat_on());
});