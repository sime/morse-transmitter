
self.addEventListener('install', e => e.waitUntil((async () => {
	const static_assets = await caches.open('static_assets');

	await static_assets.addAll([
		// Main page
		'/',
		'index.html',

		'manifest.json',
		'icons/logo-small.svg', // Needed for the page icon.

		'style.css',
		'index.mjs',
		'options.mjs',
		'morse-table.mjs',
		'modes.mjs',

		'lib/computed.mjs',
		'lib/context.mjs',
		'lib/get-or-set.mjs',
		'lib/index.mjs',
		'lib/signal.mjs',
		'lib/wrap-signal.mjs'
	]);
})()));

self.addEventListener('fetch', e => {
	e.respondWith(
		caches.match(e.request).then(res => res || fetch(e.request))
	);
});