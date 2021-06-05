// Customize install:
window.addEventListener('beforeinstallprompt', e => {
	e.preventDefault();

	const btn = document.querySelector('#install button');
	btn.addEventListener('click', () => {
		e.prompt().finally(() => btn.style.display = 'none');
	});

	btn.style.display = '';
}, { once: true });