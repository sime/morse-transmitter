/**
 * Turn all the inputs in the page into reactive signals.
 */
import { context, computed, signal } from './lib/index.mjs';
import table from './morse-table.mjs';

// Check if the browser knows about the 'torch' camera capability (Currently just Chrome and Opera)
if ('mediaDevices' in navigator && navigator.mediaDevices.getSupportedConstraints()['torch']) {
	// TODO: See if there's a way to turn on the torch using ImageCapture + fillLightMode
	document.querySelector('input[value="torch"]').removeAttribute('disabled');
}

function input_value(el) {
	const [getter, setter] = signal(el.value);
	el.addEventListener('input', () => setter(el.value));
	return getter;
}
function manual(func) {
	const [getter, setter] = signal();
	func(setter);
	return getter;
}

export const plain_text = input_value(document.querySelector('textarea'));
export const repeat = manual(setter => {
	const repeat_el = document.getElementById('repeat');
	function get_value() {
		setter(repeat_el.checked);
	}
	repeat_el.addEventListener('click', get_value);
	get_value();
});
export const mode = manual(setter => {
	const mode = document.querySelector('.mode');
	function get_value() {
		setter(mode.querySelector('input:checked').value);
	}
	mode.addEventListener('input', get_value);
	get_value();
});
export const dot_time = manual(setter => {
	const dd_el = document.querySelector('input[name="dot-duration"]');
	const wpm_el = document.querySelector('input[name="wpm"]');
	function dd_input() {
		setter(dd_el.value);

		wpm_el.value = 1200 / dd_el.value;
	}
	dd_el.addEventListener('input', dd_input);
	wpm_el.addEventListener('input', () => {
		setter(1200 / wpm_el.value);

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