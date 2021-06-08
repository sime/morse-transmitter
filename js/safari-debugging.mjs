let log_el;
function visual_log(color, message) {
	if (!log_el) {
		log_el = document.createElement('div');
		document.body.appendChild(log_el);
	}
	log_el.insertAdjacentHTML('beforeend', `
		<div style="color: ${color};">
			${message}
		</div>`);
}
// Debug Safari
if ('webkitAudioContext' in window) {
	console.log = visual_log.bind(null, 'white');
	console.warn = visual_log.bind(null, 'yellow');
	console.error = visual_log.bind(null, 'red');
}

window.addEventListener('unhandledrejection', ({ reason }) => {
	console.error(reason);
});