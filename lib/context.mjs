import get_or_set from './get-or-set.mjs';

const stack = [];

export function context(func, signal = false) {
	const waiter = () => {
		if (!signal || !signal.aborted) {
			stack.push(waiter);
			func();
			if (stack.pop() !== waiter) {
				throw new Error("Detected context stack corruption.");
			}
		}
	};
	waiter();
}

export function context_later(func, signalOrStealLast = false) {
	return (...args) => {
		if (signalOrStealLast === true) {
			signalOrStealLast = args.pop();
		}
		context(func.bind(undefined, ...args), signalOrStealLast);
	};
}

let to_update = false;

// This solution may do multiple updates.  But I accept that.
function propagate_changes() {
	for (const waiter of to_update.values()) {
		waiter();
	}
	to_update = false;
}

export class WaitSet extends Set {
	aquire() {
		const current = stack[stack.length - 1];
		if (current !== undefined) {
			this.add(current);
		}
	}
	queue() {
		if (to_update === false) {
			to_update = new Set();
			queueMicrotask(propagate_changes);
		}
		for (const waiter of this.values()) {
			to_update.add(waiter);
		}
		this.clear();
	}
}

export class WaitMap extends Map {
	aquire(key) {
		const set = get_or_set(this, key, () => new WaitSet());
		set.aquire();
	}
	queue(key) {
		const set = this.get(key);
		if (set instanceof WaitSet) {
			set.queue();
		}
	}
}

export function basic_change_detect(a, b) {
	return a !== b;
}