/**
 * Resources:
 * http://soundfile.sapp.org/doc/WaveFormat/
 */

const encoder = new TextEncoder();

export function encode_wav(audio_buffer) {
	// The simplest RIFF WAV file has 44 bytes before the start of the data.  We'll be using 2 bytes per sample.
	const file_size = 44 + 2 * audio_buffer.length;
	const file = new ArrayBuffer(file_size);
	const file_u8 = new Uint8Array(file);
	const view = new DataView(file);
	
	let index = 0;
	function encode_str(str) {
		// TODO: Use .encodeInto when it becomes available.
		const buf = encoder.encode(str);
		file_u8.set(buf, index);
		index += buf.length;
	}
	function encode_u32(num) {
		view.setUint32(index, num, true);
		index += 4;
	}
	function encode_i16(num) {
		view.setInt16(index, num, true);
		index += 2;
	}

	// RIFF chunk descriptor
	encode_str('RIFF');
	encode_u32(file_size - 8);
	encode_str('WAVE');

	// WAVE format sub-chunk
	encode_str("fmt ");
	encode_u32(16);
	encode_i16(1); // Audio format is PCM (1)
	encode_i16(1); // 1 channel
	encode_u32(audio_buffer.sampleRate);
	encode_u32(audio_buffer.sampleRate * 2);
	encode_i16(2);
	encode_i16(16);

	// Data sub-chunk
	encode_str("data");
	encode_u32(audio_buffer.length * 2);
	const data = audio_buffer.getChannelData(0);
	for (const sample of data) {
		// Sample is a float 32 between -1 and 1, but we want an int16
		const i16 = Math.trunc(sample * 32768);
		encode_i16(i16);
	}

	// The user can use revokeObjectUrl to free the blob when they don't need it anymore.
	return URL.createObjectURL(new Blob([file], { type: "audio/wav" }));
}