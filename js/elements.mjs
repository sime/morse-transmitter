import table from './morse-table.mjs';

// Get elements
export const transmit_btn = document.querySelector('#transmit button');
const message_area = document.querySelector('textarea');
const repeat_check = document.getElementById('repeat-on');
const audio_check = document.getElementById('audio-on');
const torch_check = document.getElementById('torch-on');
const screen_check = document.getElementById('screen-on');
const code_output = document.getElementById('translated');
const dot_time_number = document.getElementById('dot-duration');
const wpm_number = document.getElementById('wpm');
const waveform_select = document.getElementById('waveform');
const frequency_number = document.getElementById('frequency');

// Call once helper (Sometimes it's nice to call an event listener once to initialize without having to name it.)
function co(func) {
	func();
	return func;
}

function get_code() {
	let code = "";
	for (const ch of message_area.value) {
		code += (table[ch.toLowerCase()] ?? ch) + ' ';
	}
	return code;
}

export function get_settings() {
	return {
		code: get_code(),
		audio: audio_check.checked,
		torch: torch_check.checked,
		screen: screen_check.checked,
		repeat: repeat_check.checked,
		dot_time: Number.parseInt(dot_time_number.value),
		waveform: waveform_select.value,
		frequency: Number.parseInt(frequency_number.value)
	}
}

// Check if the browser knows about the 'torch' camera capability (Currently just Chrome and Opera)
if ('mediaDevices' in navigator && navigator.mediaDevices.getSupportedConstraints()['torch']) {
	torch_check.removeAttribute('disabled');
}

// Load and save settings to local / session storage
const setting_defs = [
	[message_area, 'message', sessionStorage, 'value'],
	[repeat_check, 'repeat', localStorage, 'checked'],
	[audio_check, 'audio', localStorage, 'checked'],
	[torch_check, 'torch', localStorage, 'checked'],
	[screen_check, 'screen', localStorage, 'checked'],
	[waveform_select, 'waveform', localStorage, 'value'],
	[frequency_number, 'frequency', localStorage, 'value']
];
for (const [el, key, store, type] of setting_defs) {
	const val = store.getItem(key);
	function store_fn() {
		store.setItem(key, el[type]);
	}
	if (type === 'value') {
		el.addEventListener('input', store_fn);
	} else if (type === 'checked') {
		el.addEventListener('change', store_fn);
	} else {
		debugger; // Unknown type
	}
	if (val !== null) {
		el[type] = (type == 'checked') ? val === 'true' : val;
	}
}

// Show the code as the user types their message
message_area.addEventListener('input', co(() => code_output.innerText = get_code()));

// dot-time / wpm setting:
dot_time_number.addEventListener('input', co(() => {
	const dot_time = Number.parseInt(dot_time_number.value);
	localStorage.setItem('dot_time', dot_time);

	wpm_number.value = 1200 / dot_time;
}));
wpm_number.addEventListener('input', () => {
	const dot_time = 1200 / Number.parseInt(wpm_number.value);
	localStorage.setItem('dot_time', dot_time);

	dot_time_number.value = dot_time;
});
wpm_number.disabled = false;

// Enable the little plus and minus buttons before / after the input[type="number"]
for (const el of [dot_time_number, wpm_number]) {
	el.previousElementSibling.addEventListener('click', () => {
		el.value = Number.parseInt(el.value) - 1;
		el.dispatchEvent(new Event('input'));
	});
	el.nextElementSibling.addEventListener('click', () => {
		el.value = Number.parseInt(el.value) + 1;
		el.dispatchEvent(new Event('input'));
	});
}
