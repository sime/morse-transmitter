let log_el;
function visual_log(color, message) {
	if (!log_el) {
		log_el = document.createElement('div');
		log_el.style = "background-color: white; z-index: 1001; color: black;";
		document.body.appendChild(log_el);
	}
	log_el.insertAdjacentHTML('beforeend', `
		<div style="color: ${color};">
			${message}
		</div>`);
}
// Debug Safari
console.log = visual_log.bind(null, 'blue');
console.warn = visual_log.bind(null, 'yellow');
console.error = visual_log.bind(null, 'red');

window.addEventListener('unhandledrejection', ({ reason }) => {
	console.error(reason);
});

console.log("working...");