import { WaitSet, WaitMap, basic_change_detect } from './context.mjs';

export function signal(initial_value, did_change = basic_change_detect) {
	let value = initial_value;
	let set = new WaitSet();

	function getter() {
		set.aquire();
		return value;
	}
	function setter(next_value) {
		if (did_change(value, next_value)) {
			value = next_value;
			set.queue();
		}
	}
	return [getter, setter];
}

export function state(...args) {
	let t = {};
	setup_state(t);
	attach_state(t, 'value', ...args);
	return t;
}

const Values = Symbol("Holds the values for state attached to a class prototype");
const Waiters = Symbol("Holds the waitsets");
export function setup_state(target) {
	if (!(Values in target) || !(Waiters in target)) {
		target[Values] = {};
		target[Waiters] = new WaitMap();
	}
}
export function attach_state(target, key, initial_value, did_change = basic_change_detect) {
	function old_value(obj) {
		return (key in obj[Values]) ? obj[Values][key] : initial_value;
	}
	Object.defineProperty(target, key, {
		get() {
			this[Waiters].aquire(key);
			return old_value(this);
		},
		set(new_value) {
			if (did_change(old_value(this), new_value)) {
				this[Values][key] = new_value;
				this[Waiters].queue(key);
			}
			return true;
		}
	});
}