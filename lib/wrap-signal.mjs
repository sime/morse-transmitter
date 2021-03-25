// TODO: Add reference counting / something to automatically abort an operation if it is no longer needed.

export function wrap_signal(signal) {
	const signalPromise = new Promise((_, reject) => {
		signal.addEventListener('abort', _ => {
			reject(new DOMException('Signal was aborted', 'AbortError'));
		});
	});
	signalPromise.catch(_ => { }); // Stop the browser from thinking that not catching a signalPromise is a problem.
	return function wrap(promise) {
		if (signal.aborted) {
			return signalPromise;
		} else {
			return Promise.race([signalPromise, promise]);
		}
	};
}