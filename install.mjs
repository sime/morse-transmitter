// Customize install:
window.addEventListener('beforeinstallprompt', e => {
	e.preventDefault();

	const btn = document.querySelector('#install button');
	btn.addEventListener('click', () => {
		e.prompt().finally(() => e.style.display = 'none');
	});

	btn.style.display = '';
}, { once: true });