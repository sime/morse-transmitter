export function wait_till(stamp) {
	return new Promise(resolve => {
		const diff = stamp - performance.now();
		if (diff > 0) setTimeout(resolve, diff);
		else resolve();
	});
}
export function* stride(arr, stride) {
	for (let i = 0; i < arr.length; i += stride) {
		const stop = i + stride;
		yield arr.slice(i, stop);
	}
}
export function wait(target, ev, options = {}) {
	return new Promise(res => target.addEventListener(ev, res, {
		once: true,
		...options
	}));
}