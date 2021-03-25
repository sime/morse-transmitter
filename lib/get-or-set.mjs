// Get a value from a map or set it using a create function if it doesn't exist.
export default function get_or_set(map, key, create_func) {
	let ret = map.get(key);
	if (ret === undefined) {
		ret = create_func();
		map.set(key, ret);
	}
	return ret;
}
